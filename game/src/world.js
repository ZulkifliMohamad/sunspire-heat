// The game's rules and state, with no drawing and no browser in it: the
// player, cars, traffic, police, combat and missions, advanced one fixed
// 1/60 s step at a time. step() returns what happened as bit flags so the
// caller can react (sound, save, screens) without the world knowing about them.
import { CITY } from './config.js';
import { createCity } from './city.js';
import { createPlayer, stepPlayer } from './player.js';
import { clampCar, collideCarBuildings, nearestCar, spawnParkedCars, stepCar, tryEnterExit } from './vehicles.js';
import { checkPedHit, spawnTraffic, stepTraffic } from './traffic.js';
import { addWanted, createPolice, stepPolice } from './police.js';
import { createCombat, crimeForShot, fireShot, stepCombat } from './combat.js';
import { beginStory, createMissions, stepMissions } from './missions.js';
import { WANTED } from './config.js';

export const EVENT_OVER = 1;
export const EVENT_BUSTED = 2;
export const EVENT_MISSION = 4;
export const EVENT_STEAL = 8;
export const EVENT_SHOT = 16;

/** A frame of input, built by main.js each step. */
export function blankFrame() {
  return {
    move: { forward: 0, strafe: 0 },
    mouse: { dx: 0, dy: 0 },
    shooting: false,
    jump: false,
    interact: false,
    attract: false,
  };
}

export function createWorld(random) {
  const city = createCity(random);
  const state = {
    rng: random,
    city,
    time: 0,
    player: createPlayer(),
    camera: { yaw: Math.PI, pitch: 0.32 },
    cars: [],
    trafficCars: [],
    peds: [],
    policeCars: [],
    enemies: [],
    police: createPolice(),
    combat: createCombat(),
    missions: createMissions(),
    cash: 0,
    bestCash: 0,
    nearestCar: null,
    stats: { carsStolen: 0, shotsFired: 0, shotsHit: 0, kills: 0, missionsDone: 0, distance: 0 },
  };

  function reset() {
    state.time = 0;
    state.player = createPlayer();
    state.camera = { yaw: Math.PI, pitch: 0.32 };
    state.cars = spawnParkedCars(random, city, 9);
    // Start Rook beside a parked car, so the first job (steal a car) is
    // playable at once instead of a hunt for one.
    const firstCar = state.cars[0];
    state.player.x = firstCar.x + 2.5;
    state.player.z = firstCar.z + 2.5;
    state.camera.yaw = Math.atan2(firstCar.x - state.player.x, firstCar.z - state.player.z);
    const traffic = spawnTraffic(random, city);
    state.trafficCars = traffic.cars;
    state.peds = traffic.peds;
    state.cars.push(...state.trafficCars);
    state.policeCars = [];
    state.enemies = [];
    state.police = createPolice();
    state.combat = createCombat();
    state.missions = createMissions();
    state.cash = 0;
    state.nearestCar = null;
    state.stats = { carsStolen: 0, shotsFired: 0, shotsHit: 0, kills: 0, missionsDone: 0, distance: 0 };
    beginStory(state);
  }

  /**
   * One fixed step. `frame` carries this step's input; with `frame.attract`
   * set (the title screen's backdrop) traffic moves but nothing scores and
   * nobody can be hurt.
   */
  function step(dt, frame) {
    let events = 0;
    state.time += dt;
    const player = state.player;
    const cam = state.camera;

    // Camera: mouse orbit, clamped pitch.
    cam.yaw -= frame.mouse.dx * 0.0032;
    cam.pitch = Math.max(0.05, Math.min(1.1, cam.pitch + frame.mouse.dy * 0.0022));

    stepTraffic(state, dt);

    if (frame.attract) {
      return events;
    }

    // Driving or on foot.
    if (player.inCar !== null) {
      const car = state.cars[player.inCar];
      if (car) {
        const before = { x: car.x, z: car.z };
        stepCar(car, dt, frame.move.forward, -frame.move.strafe, frame.jump);
        clampCar(car, CITY.bound);
        collideCarBuildings(car, city);
        player.x = car.x;
        player.z = car.z;
        player.heading = car.heading;
        state.stats.distance += Math.hypot(car.x - before.x, car.z - before.z);
        // Bumping traffic cars at speed is a crime the police notice.
        for (const other of state.trafficCars) {
          if (Math.hypot(other.x - car.x, other.z - car.z) < 3.4 && Math.abs(car.speed) > 6) {
            other.speed = Math.max(0, other.speed - 4);
          }
        }
        if (checkPedHit(state)) {
          addWanted(state, WANTED.hitPed);
        }
      }
    } else {
      stepPlayer(player, city, dt, frame.move, cam.yaw, frame.jump);
      state.nearestCar = nearestCar(state.cars, player.x, player.z, 4);
    }

    if (frame.interact) {
      const result = tryEnterExit(state, state.nearestCar);
      if (result === 'steal') events |= EVENT_STEAL;
    }

    // Shooting (on foot only).
    if (frame.shooting && player.inCar === null) {
      const result = fireShot(state, cam.yaw);
      if (result === 'hit' || result === 'miss') {
        events |= EVENT_SHOT;
        crimeForShot(state);
      }
    }
    if (stepCombat(state, dt) === 'dead') events |= EVENT_OVER;

    // Health regens slowly out of combat.
    const nearEnemy = state.enemies.some((e) => e.alive && Math.hypot(e.x - player.x, e.z - player.z) < 25);
    if (!nearEnemy && player.health > 0 && player.health < 100) {
      player.health = Math.min(100, player.health + 2 * dt);
    }

    const missionsBefore = state.stats.missionsDone;
    stepMissions(state, dt);
    if (state.stats.missionsDone > missionsBefore) events |= EVENT_MISSION;

    if (stepPolice(state, dt) === 'busted') events |= EVENT_BUSTED;
    if (player.health <= 0) events |= EVENT_OVER;
    return events;
  }

  reset();
  return { state, reset, step };
}
