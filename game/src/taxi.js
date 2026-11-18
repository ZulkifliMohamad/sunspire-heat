// Taxi fares: one side activity for the open world, built only on systems
// that already exist. A pedestrian waiting by the roadside waves for a cab
// (green ring on the ground, green dot on the minimap). Drive slowly past
// them and they get in; an orange ring marks a dropoff at least 60 m away,
// with a timer and a fare of $50 plus distance pay. Reach the ring in time
// and the fare is yours; run out of time, or step out of the car mid-fare,
// and the passenger walks away. One fare at a time, and it never touches
// the story missions: fares are available whenever the player is driving.
import { CITY } from './config.js';
import { nearestRoadPoint } from './city.js';

const PICKUP_RANGE = 7;
const PICKUP_SPEED = 10;
const DROP_RADIUS = 7;
const MIN_TRIP = 60;
const BASE_FARE = 50;
const PER_METRE = 1.5;

export function createTaxi() {
  return { hailer: null, active: null, cooldown: 0 };
}

/** A road point at least MIN_TRIP away from (fromX, fromZ). */
function farRoadPoint(state, fromX, fromZ) {
  const rng = state.rng;
  const streets = state.city.streets;
  for (let tries = 0; tries < 16; tries += 1) {
    const street = streets[Math.floor(rng() * streets.length)];
    const along = (rng() * 2 - 1) * (CITY.bound - 20);
    const point = rng() < 0.5 ? { x: street, z: along } : { x: along, z: street };
    if (Math.hypot(point.x - fromX, point.z - fromZ) >= MIN_TRIP) return point;
  }
  // Fallback: the far side of town is always a long trip.
  return { x: -fromX, z: -fromZ };
}

/** Pick a waiting pedestrian and flag them as the fare hailer. */
function designateHailer(state) {
  const taxi = state.taxi;
  if (taxi.hailer || taxi.active || state.peds.length === 0) return;
  const ped = state.peds[Math.floor(state.rng() * state.peds.length)];
  ped.speed = 0;
  ped.heading = Math.atan2(state.player.x - ped.x, state.player.z - ped.z);
  taxi.hailer = ped;
}

/** Put the passenger back on the sidewalk at (x, z), walking again. */
function dropPassenger(state, x, z) {
  const passenger = state.taxi.active ? state.taxi.active.passenger : null;
  if (!passenger) return;
  passenger.x = x;
  passenger.z = z;
  passenger.speed = 1.1 + state.rng() * 0.5;
  passenger.heading = state.rng() * Math.PI * 2;
  state.peds.push(passenger);
}

/** End the active fare with a banner; the passenger leaves at (x, z). */
function endFare(state, banner, x, z) {
  const taxi = state.taxi;
  if (!taxi.active) return;
  dropPassenger(state, x, z);
  taxi.active = null;
  taxi.cooldown = 8;
  state.missions.banner = banner;
  state.missions.bannerTimer = 5;
}

/** The hailer gets in: remove them from the sidewalk, set the dropoff. */
function startFare(state) {
  const taxi = state.taxi;
  const hailer = taxi.hailer;
  const rawDest = farRoadPoint(state, hailer.x, hailer.z);
  const dest = nearestRoadPoint(state.city, rawDest.x, rawDest.z);
  const dist = Math.hypot(dest.x - hailer.x, dest.z - hailer.z);
  const fare = BASE_FARE + Math.round(dist * PER_METRE);
  state.peds = state.peds.filter((p) => p !== hailer);
  taxi.active = { passenger: hailer, x: dest.x, z: dest.z, fare, timer: dist / 12 + 15, dist };
  taxi.hailer = null;
  state.missions.banner = `Fare picked up — reach the orange ring for $${fare}.`;
  state.missions.bannerTimer = 4;
}

/**
 * One fixed step of the taxi system. Returns 'pickup' when a fare starts,
 * 'done' when one pays out, otherwise null. Callers play the matching sound.
 */
export function stepTaxi(state, dt) {
  const taxi = state.taxi;
  if (!taxi) return null;
  if (taxi.cooldown > 0) {
    taxi.cooldown -= dt;
    return null;
  }
  const player = state.player;
  if (taxi.active) {
    const fare = taxi.active;
    const car = player.inCar !== null ? state.cars[player.inCar] : null;
    if (!car) {
      // Left the car mid-fare: the passenger walks away.
      endFare(state, 'Fare cancelled — you left the cab.', player.x + 3, player.z + 3);
      return null;
    }
    fare.timer -= dt;
    if (Math.hypot(car.x - fare.x, car.z - fare.z) < DROP_RADIUS) {
      const amount = fare.fare;
      state.cash += amount;
      state.stats.taxiFares += 1;
      state.stats.taxiEarned += amount;
      endFare(state, `Fare complete +$${amount}.`, fare.x, fare.z);
      return 'done';
    }
    if (fare.timer <= 0) {
      endFare(state, 'Fare expired — the passenger walked away.', car.x + 3, car.z + 3);
    }
    return null;
  }
  // No fare running: keep one pedestrian waiting, and pick them up when the
  // player drives slowly past.
  designateHailer(state);
  if (taxi.hailer && player.inCar !== null) {
    const car = state.cars[player.inCar];
    if (
      car &&
      Math.abs(car.speed) < PICKUP_SPEED &&
      Math.hypot(car.x - taxi.hailer.x, car.z - taxi.hailer.z) < PICKUP_RANGE
    ) {
      startFare(state);
      return 'pickup';
    }
  }
  return null;
}

/** Cancel the active fare (the player stepped out of the car). */
export function cancelTaxiFare(state) {
  if (!state.taxi || !state.taxi.active) return;
  const player = state.player;
  endFare(state, 'Fare cancelled — you left the cab.', player.x + 3, player.z + 3);
}
