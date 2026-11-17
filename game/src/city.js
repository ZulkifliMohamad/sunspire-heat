// The city of Sunspire: a street grid, blocks of buildings, a park, a marina
// strip on the south edge and a beach road. Everything is generated from the
// seeded RNG, so the same seed always builds the same city.
import { CITY, PALETTE } from './config.js';
import { pick, range } from './random.js';

export function createCity(rng) {
  const streets = CITY.streets;
  const buildings = [];
  const parks = [];
  const props = [];

  for (let ix = 0; ix < streets.length - 1; ix += 1) {
    for (let iz = 0; iz < streets.length - 1; iz += 1) {
      const x0 = streets[ix] + CITY.blockInset;
      const x1 = streets[ix + 1] - CITY.blockInset;
      const z0 = streets[iz] + CITY.blockInset;
      const z1 = streets[iz + 1] - CITY.blockInset;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      // One park near the centre, one plaza mid-city; the rest get buildings.
      if (ix === 3 && iz === 3) {
        parks.push({ x: cx, z: cz, w: x1 - x0, d: z1 - z0, kind: 'plaza' });
        continue;
      }
      if (ix === 2 && iz === 5) {
        parks.push({ x: cx, z: cz, w: x1 - x0, d: z1 - z0, kind: 'park' });
        continue;
      }
      const tall = Math.abs(cx) < 70 && Math.abs(cz) < 70;
      const count = rng() < 0.55 ? 2 : 1;
      for (let b = 0; b < count; b += 1) {
        const w = count === 1 ? (x1 - x0) * 0.72 : (x1 - x0) * 0.42;
        const d = count === 1 ? (z1 - z0) * 0.72 : (z1 - z0) * 0.42;
        const bx = count === 1 ? cx : x0 + w / 2 + (b % 2) * (x1 - x0 - w);
        const bz = count === 1 ? cz : z0 + d / 2 + Math.floor(b / 2) * (z1 - z0 - d);
        const h = tall ? range(rng, 22, 58) : range(rng, 7, 22);
        buildings.push({
          x: bx,
          z: bz,
          w,
          d,
          h,
          color: pick(rng, PALETTE.building),
          roof: rng() < 0.3,
        });
      }
      // Street lamps and palms along the block edge.
      for (let p = 0; p < 3; p += 1) {
        props.push({
          x: x0 + rng() * (x1 - x0),
          z: z0 - 1.5,
          kind: rng() < 0.5 ? 'lamp' : 'palm',
        });
      }
    }
  }

  // Marina: a strip of low buildings and a pier on the south edge.
  const marina = { x: 0, z: CITY.bound + 6, w: 220, d: 26 };
  const bank = { x: -88, z: -88 };
  const safehouse = { x: 132, z: 132 };
  const plaza = parks.find((p) => p.kind === 'plaza');

  return { streets, buildings, parks, props, marina, bank, safehouse, plaza };
}

/** Nearest point on the street grid to (x, z), snapped to a lane. */
export function nearestRoadPoint(city, x, z) {
  const snap = (v) => {
    let best = city.streets[0];
    for (const s of city.streets) if (Math.abs(s - v) < Math.abs(best - v)) best = s;
    return best;
  };
  const sx = snap(x);
  const sz = snap(z);
  return Math.abs(x - sx) < Math.abs(z - sz) ? { x: sx, z } : { x, z: sz };
}

/** True when (x, z) is on a road (within the road half-width of a street). */
export function onRoad(city, x, z) {
  const near = (v) => city.streets.some((s) => Math.abs(s - v) < CITY.roadHalf);
  return near(x) || near(z);
}

/** Clamp a position inside the city bounds. */
export function clampToCity(x, z) {
  const b = CITY.bound;
  return { x: Math.max(-b, Math.min(b, x)), z: Math.max(-b, Math.min(b, z)) };
}

/** A parked-car spot on a street edge, away from the plaza. */
export function parkedSpot(rng, city) {
  const street = pick(rng, city.streets);
  const along = range(rng, -150, 150);
  const side = rng() < 0.5 ? -1 : 1;
  if (rng() < 0.5) return { x: street + side * (CITY.roadHalf - 1.2), z: along, heading: along >= 0 ? 0 : Math.PI };
  return { x: along, z: street + side * (CITY.roadHalf - 1.2), heading: along >= 0 ? Math.PI / 2 : -Math.PI / 2 };
}
