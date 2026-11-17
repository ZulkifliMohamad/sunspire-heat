// Combat: the player's shots, rival gang members who shoot back, and health.
// Shooting is a hitscan check from the player's position toward the camera aim:
// an enemy inside a narrow cone and in range takes damage. Enemies return fire
// on a timer when the player is in range and line of sight is open.
import { COMBAT, WANTED } from './config.js';
import { addWanted } from './police.js';

export function createCombat() {
  return { cooldown: 0, shotsFired: 0, shotsHit: 0, tracer: null, tracerTimer: 0 };
}

export function spawnEnemies(state, x, z, count) {
  state.enemies = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + state.rng() * 0.6;
    state.enemies.push({
      x: x + Math.sin(angle) * (10 + state.rng() * 8),
      z: z + Math.cos(angle) * (10 + state.rng() * 8),
      heading: angle + Math.PI,
      health: COMBAT.enemyHealth,
      alive: true,
      shotTimer: 1 + state.rng(),
      strafe: state.rng() < 0.5 ? -1 : 1,
    });
  }
}

/** Fire one shot from the player toward `aimAngle`. Returns 'hit' | 'miss' | 'cooldown' | null. */
export function fireShot(state, aimAngle) {
  const combat = state.combat;
  const player = state.player;
  if (player.inCar !== null || combat.cooldown > 0) return combat.cooldown > 0 ? 'cooldown' : null;
  combat.cooldown = COMBAT.cooldown;
  combat.shotsFired += 1;
  state.stats.shotsFired += 1;
  const ox = player.x;
  const oz = player.z;
  let best = null;
  let bestD = COMBAT.range;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - ox;
    const dz = enemy.z - oz;
    const dist = Math.hypot(dx, dz);
    if (dist > bestD) continue;
    const ang = Math.atan2(dx, dz);
    let diff = ang - aimAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 0.16 + 2.5 / dist && dist < bestD) {
      bestD = dist;
      best = enemy;
    }
  }
  combat.tracer = { x: ox, z: oz, angle: aimAngle, dist: best ? bestD : COMBAT.range };
  combat.tracerTimer = 0.12;
  if (best) {
    best.health -= COMBAT.damage;
    combat.shotsHit += 1;
    state.stats.shotsHit += 1;
    if (best.health <= 0) {
      best.alive = false;
      state.stats.kills += 1;
    }
    return 'hit';
  }
  return 'miss';
}

/** One fixed step: cooldowns, tracers, and enemies shooting back. Returns 'dead' when the player dies. */
export function stepCombat(state, dt) {
  const combat = state.combat;
  const player = state.player;
  if (combat.cooldown > 0) combat.cooldown -= dt;
  if (combat.tracerTimer > 0) combat.tracerTimer -= dt;
  let dead = false;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const dx = player.x - enemy.x;
    const dz = player.z - enemy.z;
    const dist = Math.hypot(dx, dz) || 1;
    enemy.heading = Math.atan2(dx, dz);
    // Strafe slowly to stay a hard target; keep some distance.
    enemy.x += Math.cos(enemy.heading) * enemy.strafe * 1.4 * dt;
    enemy.z -= Math.sin(enemy.heading) * enemy.strafe * 1.4 * dt;
    if (dist > 26) {
      enemy.x += (dx / dist) * 3 * dt;
      enemy.z += (dz / dist) * 3 * dt;
    }
    enemy.shotTimer -= dt;
    if (enemy.shotTimer <= 0 && dist < COMBAT.enemyRange && player.inCar === null) {
      enemy.shotTimer = COMBAT.enemyShotDelay + state.rng() * 0.7;
      const hitChance = dist < 14 ? 0.55 : 0.3;
      if (state.rng() < hitChance) {
        player.health -= COMBAT.enemyDamage;
        player.hurtTimer = 0.4;
        if (player.health <= 0) dead = true;
      }
    }
  }
  return dead ? 'dead' : null;
}

/** First shot in a quiet street draws the law: one star. */
export function crimeForShot(state) {
  if (state.police.wanted === 0) addWanted(state, WANTED.shoot);
}
