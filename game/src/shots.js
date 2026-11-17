// The screenshot scenes behind ?shot=start|play|mission|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame.
import { CITY, STEP } from './config.js';
import { blankFrame } from './world.js';
import { SCREEN_COMPLETE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const CITY_STREETS = CITY.streets;

const START_SECONDS = 6;
const PLAY_SECONDS = 20;
const MISSION_SECONDS = 2.5;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function nearestStreet(v) {
  let best = CITY_STREETS[0];
  for (const s of CITY_STREETS) if (Math.abs(s - v) < Math.abs(best - v)) best = s;
  return best;
}

/**
 * Road-following chase driver: waypoints run along the street grid (nearest
 * intersection, then along one street to the target's street, then to the
 * target), so the car stays on roads instead of cutting through blocks.
 */
function makeRoadDriver(state) {
  const waypoints = [];
  return function driveToward(tx, tz) {
    const frame = blankFrame();
    const player = state.player;
    const car = player.inCar !== null ? state.cars[player.inCar] : null;
    if (!car) return frame;
    if (waypoints.length === 0) {
      const sx = nearestStreet(car.x);
      const sz = nearestStreet(car.z);
      waypoints.push({ x: sx, z: sz });
      waypoints.push({ x: nearestStreet(tx), z: sz });
      waypoints.push({ x: nearestStreet(tx), z: nearestStreet(tz) });
      waypoints.push({ x: tx, z: tz });
    }
    const wp = waypoints[0];
    if (Math.hypot(wp.x - car.x, wp.z - car.z) < 7) {
      waypoints.shift();
      if (waypoints.length === 0) return frame;
    }
    const target = waypoints[0];
    const desired = Math.atan2(target.x - car.x, target.z - car.z);
    const diff = wrapAngle(desired - car.heading);
    frame.move.forward = Math.abs(diff) > 2.2 ? -0.6 : 1;
    frame.move.strafe = Math.max(-1, Math.min(1, -diff * 1.6));
    return frame;
  };
}

/** On foot: face the nearest living enemy and shoot; strafe to stay moving. */
function fightFrame(state) {
  const frame = blankFrame();
  const player = state.player;
  let best = null;
  let bestD = 1e9;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - player.x, e.z - player.z);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (best) {
    state.camera.yaw = Math.atan2(best.x - player.x, best.z - player.z);
    frame.shooting = true;
    frame.move.strafe = Math.sin(state.time * 1.4) > 0 ? 1 : -1;
  }
  return frame;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: title over the living city. play: driving chase, 3 stars, mission
 * objective. mission: on-foot plaza shootout. end: all missions done, stats.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name === 'play') {
    // Mission 2 (courier) with the player already in a car, 3 stars, police on the tail.
    state.missions.index = 1;
    const car = state.cars[0];
    state.player.x = car.x;
    state.player.z = car.z;
    state.player.inCar = car.id;
    car.driver = 'player';
    car.parked = false;
    car.heading = Math.atan2(110 - car.x, 110 - car.z);
    state.camera.yaw = car.heading;
    state.missions.active = true;
    state.missions.checkpoints = [
      { x: -110, z: 110 },
      { x: 110, z: -22 },
      { x: 22, z: -154 },
    ];
    state.missions.checkpoint = 0;
    state.missions.timer = 78;
    state.missions.marker = { x: -110, z: 110, label: 'Drop 1/3' };
    state.police.wanted = 3;
    state.police.heat = 1;
    state.cash = 1300;
    const drive = makeRoadDriver(state);
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      const cp = state.missions.checkpoints[state.missions.checkpoint] || { x: 0, z: 0 };
      world.step(STEP, drive(cp.x, cp.z));
    }
    // Freeze the frame as a courier chase: if the autopilot finished the
    // courier early, put the mission back to its chase state for the shot.
    state.missions.index = 1;
    state.missions.active = true;
    state.missions.done = [];
    state.stats.missionsDone = 0;
    state.missions.checkpoint = Math.min(state.missions.checkpoint, 2);
    state.missions.timer = 78;
    state.cash = 1300;
    const cp = state.missions.checkpoints[state.missions.checkpoint];
    state.missions.marker = { x: cp.x, z: cp.z, label: `Drop ${state.missions.checkpoint + 1}/3` };
    state.missions.banner = '';
    state.missions.bannerTimer = 0;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Mission 3 (shootout) at the plaza, player on foot, firing.
    state.missions.index = 2;
    state.missions.active = true;
    state.missions.banner = '';
    state.missions.bannerTimer = 0;
    const plaza = state.city.plaza;
    state.player.x = plaza.x;
    state.player.z = plaza.z + 14;
    state.player.heading = Math.PI;
    state.camera.yaw = Math.PI;
    state.missions.marker = { x: plaza.x, z: plaza.z, label: 'Plaza' };
    state.enemies = [];
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2 + 0.3;
      state.enemies.push({
        x: plaza.x + Math.sin(angle) * 12,
        z: plaza.z + Math.cos(angle) * 12,
        heading: angle + Math.PI,
        health: 100,
        alive: true,
        shotTimer: 1 + i * 0.4,
        strafe: i % 2 === 0 ? -1 : 1,
      });
    }
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) world.step(STEP, fightFrame(state));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    state.missions.done = [0, 1, 2, 3];
    state.missions.completedAll = true;
    state.missions.active = false;
    state.missions.marker = null;
    state.missions.banner = '';
    state.missions.bannerTimer = 0;
    state.cash = 5000;
    state.stats.missionsDone = 4;
    state.stats.carsStolen = 6;
    state.stats.kills = 4;
    const car = state.cars[1];
    // Parked on the beach road facing the marina water: a clean final frame.
    car.x = -22;
    car.z = 148;
    car.heading = 0;
    car.speed = 0;
    state.player.x = car.x;
    state.player.z = car.z;
    state.player.inCar = car.id;
    car.driver = 'player';
    car.parked = false;
    state.camera.yaw = 0;
    state.camera.pitch = 0.85;
    for (let i = 0; i < 2 / STEP; i += 1) world.step(STEP, blankFrame());
    return { screen: SCREEN_COMPLETE };
  }
  // Default: start — title over the living city.
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    const frame = blankFrame();
    frame.attract = true;
    world.step(STEP, frame);
  }
  return { screen: SCREEN_TITLE };
}
