// Third-person on-foot controller: WASD moves relative to the camera yaw,
// Space jumps, Shift runs. Gravity and a flat ground; buildings block by a
// simple circle-vs-box push-out so the player cannot walk through walls.
import { CITY, PLAYER } from './config.js';
import { clampToCity } from './city.js';

export function createPlayer() {
  return {
    x: 0,
    z: 24,
    y: 0,
    vy: 0,
    heading: 0,
    speed: 0,
    health: PLAYER.maxHealth,
    inCar: null,
    grounded: true,
    hurtTimer: 0,
  };
}

function collideBuildings(player, city) {
  for (const b of city.buildings) {
    const dx = player.x - b.x;
    const dz = player.z - b.z;
    const px = b.w / 2 + PLAYER.radius;
    const pz = b.d / 2 + PLAYER.radius;
    if (Math.abs(dx) < px && Math.abs(dz) < pz) {
      const ox = px - Math.abs(dx);
      const oz = pz - Math.abs(dz);
      if (ox < oz) player.x += dx >= 0 ? ox : -ox;
      else player.z += dz >= 0 ? oz : -oz;
    }
  }
}

/** One fixed step of on-foot movement. `move` is {forward, strafe}, yaw is the camera yaw. */
export function stepPlayer(player, city, dt, move, yaw, jump) {
  const running = move.forward !== 0 && move.strafe === 0;
  const target = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const mx = fx * move.forward + rx * move.strafe;
  const mz = fz * move.forward + rz * move.strafe;
  const len = Math.hypot(mx, mz) || 1;
  const want = Math.hypot(move.forward, move.strafe) > 0 ? target : 0;
  player.speed += (want - player.speed) * Math.min(1, PLAYER.accel * dt / target);
  if (want === 0) player.speed = Math.max(0, player.speed - 30 * dt);
  player.x += (mx / len) * player.speed * dt;
  player.z += (mz / len) * player.speed * dt;
  if (player.speed > 0.5) player.heading = Math.atan2(mx / len, mz / len);
  if (jump && player.grounded) {
    player.vy = PLAYER.jumpSpeed;
    player.grounded = false;
  }
  player.vy -= PLAYER.gravity * dt;
  player.y += player.vy * dt;
  if (player.y <= 0) {
    player.y = 0;
    player.vy = 0;
    player.grounded = true;
  }
  const c = clampToCity(player.x, player.z);
  player.x = c.x;
  player.z = c.z;
  collideBuildings(player, city);
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
}

/** Damage the player; returns true when it kills them. */
export function hurtPlayer(player, amount) {
  if (player.hurtTimer > 0) return false;
  player.health -= amount;
  player.hurtTimer = 0.6;
  return player.health <= 0;
}
