// Wanted level (0–5 stars) and the police who respond to it. Police cars spawn
// at the city edge, chase the player, ram their car, and bust them on foot when
// they get close and the player is slow. Heat fades when the player stays out
// of sight; higher stars mean more cars and faster responses.
import { CITY, POLICE, WANTED } from './config.js';
import { collideCarBuildings } from './vehicles.js';
import { range } from './random.js';

export function createPolice() {
  return { wanted: 0, heat: 0, spawnTimer: 0, bustTimer: 0, siren: 0 };
}

/** Raise the wanted level by `stars` (clamped) and refresh the heat. */
export function addWanted(state, stars) {
  state.police.wanted = Math.min(WANTED.max, state.police.wanted + stars);
  state.police.heat = 1;
}

export function playerPosition(state) {
  const player = state.player;
  if (player.inCar !== null) {
    const car = state.cars[player.inCar];
    if (car) return { x: car.x, z: car.z };
  }
  return { x: player.x, z: player.z };
}

function spawnPoliceCar(state) {
  const rng = state.rng;
  const edge = Math.floor(rng() * 4);
  const along = range(rng, -140, 140);
  const pos =
    edge === 0 ? { x: along, z: -170 } :
    edge === 1 ? { x: along, z: 170 } :
    edge === 2 ? { x: -170, z: along } : { x: 170, z: along };
  const target = playerPosition(state);
  const car = {
    id: 200 + state.policeCars.length + Math.floor(rng() * 1000),
    kind: 'police',
    color: 0x1c2733,
    x: pos.x,
    z: pos.z,
    heading: Math.atan2(target.x - pos.x, target.z - pos.z),
    speed: 12,
    steer: 0,
    driver: 'police',
    parked: false,
  };
  state.policeCars.push(car);
  state.cars.push(car);
  return car;
}

function removePoliceCar(state, car) {
  state.policeCars = state.policeCars.filter((c) => c !== car);
  state.cars = state.cars.filter((c) => c !== car);
}

/**
 * One fixed step of the police system. Returns 'busted' when the player is
 * caught on foot, otherwise null.
 */
export function stepPolice(state, dt) {
  const police = state.police;
  const target = playerPosition(state);
  const player = state.player;

  if (police.wanted > 0) {
    police.heat = Math.min(1, police.heat + dt * 0.2);
    police.spawnTimer -= dt;
    const want = Math.min(police.wanted, POLICE.maxCars);
    if (state.policeCars.length < want && police.spawnTimer <= 0) {
      spawnPoliceCar(state);
      police.spawnTimer = POLICE.spawnDelay;
    }
  } else {
    police.heat = Math.max(0, police.heat - dt * POLICE.heatDecay);
    if (state.policeCars.length > 0 && police.heat <= 0.15) {
      removePoliceCar(state, state.policeCars[0]);
    }
  }

  let busted = false;
  for (const car of [...state.policeCars]) {
    const dx = target.x - car.x;
    const dz = target.z - car.z;
    const dist = Math.hypot(dx, dz) || 1;
    const desired = Math.atan2(dx, dz);
    let diff = desired - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff * 2.2 * dt * 10 * 0.1));
    car.speed += (POLICE.maxSpeed - car.speed) * Math.min(1, dt * 0.8);
    if (dist < POLICE.ramRange && player.inCar !== null) {
      const mine = state.cars[player.inCar];
      if (mine) {
        mine.speed *= 0.82;
        mine.x += (dx / dist) * 0.6;
        mine.z += (dz / dist) * 0.6;
        car.speed *= 0.7;
      }
    }
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    collideCarBuildings(car, state.city);
    if (Math.abs(car.x) > CITY.bound + 20 || Math.abs(car.z) > CITY.bound + 20) {
      removePoliceCar(state, car);
      continue;
    }
    // Bust: on foot, police close and the player barely moving.
    if (player.inCar === null && dist < POLICE.bustRange && player.speed < 1.5) {
      police.bustTimer += dt;
      if (police.bustTimer > POLICE.bustTime) busted = true;
    } else {
      police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
    }
  }
  police.siren = police.wanted > 0 ? (police.siren + dt) % 1 : 0;
  return busted ? 'busted' : null;
}

/** Drop the wanted level (used when the player reaches a safehouse). */
export function clearWanted(state) {
  state.police.wanted = 0;
  state.police.heat = 0;
  state.police.bustTimer = 0;
}
