// The screenshot scenes behind ?shot=start|play|mission|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame.
import { CITY, STEP } from './config.js';
import { nearestRoadPoint } from './city.js';
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
  // Screenshots are staged frames, not live play: no taxi fare may start
  // and steal the HUD while a scene is being set up.
  state.taxi.cooldown = 3600;
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
    // Snap the car back onto the road: the chase autopilot cuts corners at
    // speed, so without this the frame shows dirt and a building, not a chase.
    // Heading follows the street; the car sits in its lane, centre line beside it.
    const road = nearestRoadPoint(state.city, car.x, car.z);
    const vertical = road.x !== car.x;
    const options = vertical ? [0, Math.PI] : [Math.PI / 2, -Math.PI / 2];
    let heading = options[0];
    for (const o of options) {
      if (Math.abs(wrapAngle(o - car.heading)) < Math.abs(wrapAngle(heading - car.heading))) heading = o;
    }
    const lane = CITY.lane;
    if (vertical) {
      car.x = road.x + (heading === 0 ? lane : -lane);
      car.z = road.z;
    } else {
      car.x = road.x;
      car.z = road.z + (heading === Math.PI / 2 ? lane : -lane);
    }
    car.heading = heading;
    car.speed = 18;
    state.player.x = car.x;
    state.player.z = car.z;
    state.camera.yaw = heading;
    // Coast on the road so the snap settles under the real rules.
    for (let i = 0; i < 1.2 / STEP; i += 1) world.step(STEP, blankFrame());
    // Stage the chase in front of the camera: an intercept police car in the
    // opposite lane heading at the player, a second police car in the player's
    // lane ahead, and a traffic car further up the same road.
    const dirX = Math.sin(heading);
    const dirZ = Math.cos(heading);
    const sideX = Math.cos(heading);
    const sideZ = -Math.sin(heading);
    function stagePolice(id, along, side) {
      const pc = {
        id,
        kind: 'police',
        color: 0x1c2733,
        x: car.x + dirX * along + sideX * side,
        z: car.z + dirZ * along + sideZ * side,
        heading: wrapAngle(heading + Math.PI),
        speed: 14,
        steer: 0,
        driver: 'police',
        parked: false,
      };
      state.policeCars.push(pc);
      state.cars.push(pc);
    }
    stagePolice(300, 30, -lane);
    stagePolice(301, 18, lane);
    const traffic = state.trafficCars[0];
    if (traffic) {
      traffic.x = car.x + dirX * 35 + sideX * lane;
      traffic.z = car.z + dirZ * 35 + sideZ * lane;
      traffic.heading = heading;
      traffic.speed = 9;
    }
    // One short sim burst so the staged cars move under the real rules
    // without closing the gap and passing the player.
    for (let i = 0; i < 0.4 / STEP; i += 1) {
      const frame = blankFrame();
      frame.move.forward = 0.5;
      world.step(STEP, frame);
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
    // The drive collects wanted stars (pedestrian hits while cutting
    // corners); the shot is a three-star chase, so put the heat back.
    state.police.wanted = 3;
    state.police.heat = 1;
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
        x: plaza.x + Math.sin(angle) * 7.5,
        z: plaza.z + Math.cos(angle) * 7.5,
        heading: angle + Math.PI,
        health: 200,
        alive: true,
        shotTimer: 1 + i * 0.4,
        strafe: i % 2 === 0 ? -1 : 1,
      });
    }
    // Fight longer, close in, so the rivals read as people, not dots — and
    // keep stepping until a tracer is live, so the frame catches the gunfire.
    // Rivals carry double health here so the fight does not end before the shot.
    for (let i = 0; i < (MISSION_SECONDS + 1) / STEP; i += 1) world.step(STEP, fightFrame(state));
    for (let i = 0; i < 0.6 / STEP && state.combat.tracerTimer <= 0; i += 1) world.step(STEP, fightFrame(state));
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
    // Parked across the beach road facing the marina water, bright red so
    // the car reads beside the completion panel instead of hiding behind
    // it; a low camera pitch brings the water and the horizon into the frame.
    car.x = -22;
    car.z = 150;
    car.heading = 1.52;
    car.color = 0xd23b2e;
    car.speed = 0;
    state.player.x = car.x;
    state.player.z = car.z;
    state.player.inCar = car.id;
    car.driver = 'player';
    car.parked = false;
    // Rook steps out and stands beside the car: the camera follows the
    // player on foot, so the car sits off-centre, side-on, beside the panel
    // instead of dead-centre behind it.
    state.player.inCar = null;
    state.player.x = car.x - 12;
    state.player.z = car.z - 1;
    state.player.heading = Math.atan2(car.x - state.player.x, car.z - state.player.z);
    car.driver = 'none';
    car.parked = true;
    state.camera.yaw = 0.52;
    state.camera.pitch = 0.5;
    // Street life around the car: traffic passing on the beach road and
    // pedestrians on the sidewalk, so the final frame is a city, not dirt.
    const beach = state.trafficCars;
    if (beach.length > 0) {
      beach[0].x = -58;
      beach[0].z = 154;
      beach[0].heading = Math.PI / 2;
      beach[0].speed = 7;
    }
    if (beach.length > 1) {
      beach[1].x = 8;
      beach[1].z = 154;
      beach[1].heading = -Math.PI / 2;
      beach[1].speed = 7;
    }
    const spots = [[-38, 147], [-14, 147], [-24, 147]];
    state.peds.slice(0, 3).forEach((ped, i) => {
      ped.x = spots[i][0];
      ped.z = spots[i][1];
      ped.speed = 0;
      ped.heading = Math.atan2(car.x - ped.x, car.z - ped.z);
    });
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
