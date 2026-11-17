// Cars: arcade physics, entering/exiting, stealing. A car is a plain record;
// the renderer owns its mesh. `driver` is 'player', 'traffic', 'police' or 'none' (parked).
import { CAR, PALETTE, WANTED } from './config.js';
import { parkedSpot } from './city.js';
import { pick } from './random.js';

const KINDS = ['sedan', 'sport', 'taxi', 'truck'];

export function createCar(rng, id, spot, kind) {
  return {
    id,
    kind: kind || pick(rng, KINDS),
    color: pick(rng, PALETTE.car),
    x: spot.x,
    z: spot.z,
    heading: spot.heading,
    speed: 0,
    steer: 0,
    driver: 'none',
    parked: true,
    wanted: false,
    damage: 0,
  };
}

/** Spawn the parked, stealable cars around the city. */
export function spawnParkedCars(rng, city, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) cars.push(createCar(rng, i, parkedSpot(rng, city)));
  return cars;
}

/** Arcade car step: throttle -1..1, steer -1..1, handbrake boolean. */
export function stepCar(car, dt, throttle, steer, handbrake) {
  const max = throttle >= 0 ? CAR.maxSpeed : CAR.maxReverse;
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed += CAR.reverseAccel * throttle * dt;
  }
  car.speed -= car.speed * (handbrake ? CAR.handbrakeDrag : CAR.drag) * dt;
  if (car.speed > max) car.speed = max;
  if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;
  const turn = steer * CAR.steer * (handbrake ? CAR.handbrakeTurn / CAR.steer : 1);
  car.heading += turn * dt * Math.min(1, Math.abs(car.speed) / 6) * (car.speed >= 0 ? 1 : -1);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
}

/** Nearest car to (x, z) within `range`, or null. */
export function nearestCar(cars, x, z, rangeMeters) {
  let best = null;
  let bestD = rangeMeters;
  for (const car of cars) {
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/**
 * Enter/exit logic. On foot near a car: E takes it (a parked car is a steal and
 * raises the wanted level once). In a car: E steps out beside it.
 * Returns an event string ('enter' | 'steal' | 'exit' | null).
 */
export function tryEnterExit(state, car) {
  const player = state.player;
  if (player.inCar !== null) {
    const current = state.cars[player.inCar];
    if (current) {
      current.driver = 'none';
      current.parked = true;
      current.speed = 0;
    }
    player.inCar = null;
    player.x = current ? current.x + Math.cos(current.heading) * 2.5 : player.x;
    player.z = current ? current.z - Math.sin(current.heading) * 2.5 : player.z;
    player.heading = current ? current.heading : player.heading;
    return 'exit';
  }
  if (!car) return null;
  const stolen = car.parked;
  car.driver = 'player';
  car.parked = false;
  player.inCar = car.id;
  player.x = car.x;
  player.z = car.z;
  state.stats.carsStolen += stolen ? 1 : 0;
  if (stolen && !car.wanted) {
    car.wanted = true;
    state.police.wanted = Math.min(WANTED.max, state.police.wanted + WANTED.steal);
    state.police.heat = 1;
    return 'steal';
  }
  return 'enter';
}

/** Keep a car inside the city; bounce softly off the edge. */
export function clampCar(car, bound) {
  if (car.x < -bound || car.x > bound || car.z < -bound || car.z > bound) {
    car.x = Math.max(-bound, Math.min(bound, car.x));
    car.z = Math.max(-bound, Math.min(bound, car.z));
    car.speed *= 0.5;
    car.heading += Math.PI;
  }
}

/** Circle-vs-box push-out so a car cannot drive through a building. */
export function collideCarBuildings(car, city) {
  const r = 2.1;
  for (const b of city.buildings) {
    const dx = car.x - b.x;
    const dz = car.z - b.z;
    const px = b.w / 2 + r;
    const pz = b.d / 2 + r;
    if (Math.abs(dx) < px && Math.abs(dz) < pz) {
      const ox = px - Math.abs(dx);
      const oz = pz - Math.abs(dz);
      if (ox < oz) car.x += dx >= 0 ? ox : -ox;
      else car.z += dz >= 0 ? oz : -oz;
      car.speed *= 0.6;
    }
  }
}
