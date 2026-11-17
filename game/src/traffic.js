// Traffic cars and pedestrians. Traffic cars drive the street grid in lanes
// and turn at intersections; pedestrians stroll the sidewalks and cross at
// corners. Both are simple and cheap: no pathfinding, just the grid.
import { CITY, TRAFFIC } from './config.js';
import { nearestRoadPoint } from './city.js';
import { pick, range } from './random.js';

export function spawnTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const street = pick(rng, city.streets);
    const along = range(rng, -160, 160);
    const axisX = rng() < 0.5;
    cars.push({
      id: 100 + i,
      kind: 'sedan',
      color: 0x9aa0a8,
      x: axisX ? street + CITY.lane : along,
      z: axisX ? along : street + CITY.lane,
      heading: axisX ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      speed: range(rng, 6, TRAFFIC.carSpeed),
      steer: 0,
      driver: 'traffic',
      parked: false,
      axisX,
      turnAt: range(rng, 20, 90),
    });
  }
  const peds = [];
  for (let i = 0; i < TRAFFIC.peds; i += 1) {
    const street = pick(rng, city.streets);
    const along = range(rng, -160, 160);
    peds.push({
      x: street + (rng() < 0.5 ? -1 : 1) * (CITY.roadHalf + 1.5),
      z: along,
      heading: rng() * Math.PI * 2,
      speed: range(rng, 1.1, TRAFFIC.pedSpeed),
      color: pick(rng, [0xd23b2e, 0x2e6fd2, 0xe8c832, 0x3aa655, 0xe8e4da, 0xd2691e]),
      walkPhase: rng() * Math.PI * 2,
      axisX: rng() < 0.5,
    });
  }
  return { cars, peds };
}

function onIntersection(car) {
  const near = (v) => CITY.streets.some((s) => Math.abs(s - v) < 2.5);
  return near(car.x) && near(car.z);
}

/** One fixed step for every traffic car and pedestrian. */
export function stepTraffic(state, dt) {
  const rng = state.rng;
  for (const car of state.trafficCars) {
    // Slow for the car ahead on the same lane.
    let ahead = null;
    for (const other of state.cars) {
      if (other === car || other.driver === 'none') continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 12 && Math.abs(Math.atan2(dx, dz) - car.heading) < 0.5) {
        if (!ahead || dist < ahead) ahead = dist;
      }
    }
    const target = ahead !== null ? Math.max(0, ahead - 6) : TRAFFIC.carSpeed;
    car.speed += (Math.min(TRAFFIC.carSpeed, target) - car.speed) * Math.min(1, dt * 2);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.turnAt -= Math.abs(car.speed) * dt;
    if (car.turnAt <= 0 && onIntersection(car)) {
      const road = nearestRoadPoint(state.city, car.x, car.z);
      car.x = road.x;
      car.z = road.z;
      car.heading += (rng() < 0.5 ? -1 : 1) * Math.PI / 2;
      car.turnAt = range(rng, 40, 120);
    }
    if (Math.abs(car.x) > CITY.bound || Math.abs(car.z) > CITY.bound) {
      car.heading += Math.PI;
      car.x = Math.max(-CITY.bound, Math.min(CITY.bound, car.x));
      car.z = Math.max(-CITY.bound, Math.min(CITY.bound, car.z));
    }
  }
  for (const ped of state.peds) {
    ped.walkPhase += dt * 6;
    ped.x += Math.sin(ped.heading) * ped.speed * dt;
    ped.z += Math.cos(ped.heading) * ped.speed * dt;
    if (rng() < dt * 0.05) ped.heading += (rng() - 0.5) * 1.2;
    if (Math.abs(ped.x) > CITY.bound - 4 || Math.abs(ped.z) > CITY.bound - 4) ped.heading += Math.PI;
    // Stay out of buildings.
    for (const b of state.city.buildings) {
      if (Math.abs(ped.x - b.x) < b.w / 2 + 0.5 && Math.abs(ped.z - b.z) < b.d / 2 + 0.5) {
        ped.heading += Math.PI / 2;
      }
    }
  }
}

/** Push a pedestrian out of the player's car path; returns true on a hit. */
export function checkPedHit(state) {
  const player = state.player;
  if (player.inCar === null) return false;
  const car = state.cars[player.inCar];
  if (!car || Math.abs(car.speed) < 2) return false;
  for (const ped of state.peds) {
    if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.2) {
      ped.x += (ped.x - car.x) * 2;
      ped.z += (ped.z - car.z) * 2;
      ped.speed = 0;
      return true;
    }
  }
  return false;
}
