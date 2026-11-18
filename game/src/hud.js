// The HUD: DOM panels for stars, cash, health, speed and the mission
// objective, plus a 2D canvas minimap (roads, buildings, player, police,
// mission marker). Overlays for title / pause / busted / complete screens.
// Updated every frame from the world state; nothing here owns game rules.
import { CITY, MISSIONS, STORY } from './config.js';
import { objectiveText } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

const MINIMAP = 168;

export function createHud() {
  const root = document.getElementById('hud');
  const minimap = document.getElementById('minimap');
  const ctx = minimap.getContext('2d');
  const els = {
    stars: document.getElementById('stars'),
    cash: document.getElementById('cash'),
    healthFill: document.getElementById('health-fill'),
    healthText: document.getElementById('health-text'),
    speed: document.getElementById('speed'),
    objective: document.getElementById('objective'),
    missionName: document.getElementById('mission-name'),
    banner: document.getElementById('banner'),
    prompt: document.getElementById('prompt'),
    crosshair: document.getElementById('crosshair'),
    overlay: document.getElementById('overlay'),
    overlayTitle: document.getElementById('overlay-title'),
    overlayBody: document.getElementById('overlay-body'),
    overlayPrompt: document.getElementById('overlay-prompt'),
    toast: document.getElementById('toast'),
  };
  let toastTimer = 0;
  let lastScreen = '';

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.style.opacity = '1';
    toastTimer = 2.5;
  }

  function drawMinimap(state) {
    const w = MINIMAP;
    const scale = w / (CITY.bound * 2 + 40);
    const toMap = (x, z) => [(x + CITY.bound + 20) * scale, (z + CITY.bound + 20) * scale];
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = 'rgba(20, 24, 30, 0.85)';
    ctx.fillRect(0, 0, w, w);
    // Roads.
    ctx.strokeStyle = '#5a5f6a';
    ctx.lineWidth = 3;
    for (const s of CITY.streets) {
      const [ax] = toMap(s, 0);
      const [, bz] = toMap(0, s);
      ctx.beginPath();
      ctx.moveTo(ax, 0);
      ctx.lineTo(ax, w);
      ctx.moveTo(0, bz);
      ctx.lineTo(w, bz);
      ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#8a7f6a';
    for (const b of state.city.buildings) {
      const [x, y] = toMap(b.x - b.w / 2, b.z - b.d / 2);
      ctx.fillRect(x, y, Math.max(2, b.w * scale), Math.max(2, b.d * scale));
    }
    // Marina and park.
    ctx.fillStyle = '#2f7fa8';
    const [mx, my] = toMap(state.city.marina.x - 110, state.city.marina.z - 13);
    ctx.fillRect(mx, my, 220 * scale, 26 * scale);
    // Mission marker (pulsing yellow diamond).
    const marker = state.missions.marker;
    if (marker) {
      const [x, y] = toMap(marker.x, marker.z);
      const pulse = 5 + Math.sin(state.time * 5) * 2;
      ctx.fillStyle = '#ffc21c';
      ctx.beginPath();
      ctx.moveTo(x, y - pulse);
      ctx.lineTo(x + pulse, y);
      ctx.lineTo(x, y + pulse);
      ctx.lineTo(x - pulse, y);
      ctx.closePath();
      ctx.fill();
    }
    // Taxi: waiting hailer (green dot) and dropoff (orange diamond).
    const taxi = state.taxi;
    if (taxi && taxi.hailer && !taxi.active) {
      const [x, y] = toMap(taxi.hailer.x, taxi.hailer.z);
      ctx.fillStyle = '#3aa655';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e8f5e9';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (taxi && taxi.active) {
      const [x, y] = toMap(taxi.active.x, taxi.active.z);
      const pulse = 5 + Math.sin(state.time * 5) * 2;
      ctx.fillStyle = '#ff9f1c';
      ctx.beginPath();
      ctx.moveTo(x, y - pulse);
      ctx.lineTo(x + pulse, y);
      ctx.lineTo(x, y + pulse);
      ctx.lineTo(x - pulse, y);
      ctx.closePath();
      ctx.fill();
    }
    // Police (blue/red dots).
    for (const car of state.policeCars) {
      const [x, y] = toMap(car.x, car.z);
      ctx.fillStyle = Math.floor(state.time * 4) % 2 === 0 ? '#ff5a4e' : '#4f8ef7';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Enemies (red dots).
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const [x, y] = toMap(e.x, e.z);
      ctx.fillStyle = '#ff5a4e';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player (white arrow).
    const p = state.player.inCar !== null && state.cars[state.player.inCar]
      ? state.cars[state.player.inCar]
      : state.player;
    const [px, py] = toMap(p.x, p.z);
    const heading = state.player.inCar !== null && state.cars[state.player.inCar]
      ? state.cars[state.player.inCar].heading
      : state.player.heading;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function update(state, screen, extra) {
    const player = state.player;
    const wanted = state.police.wanted;
    els.stars.textContent = wanted > 0 ? '★'.repeat(wanted) + '☆'.repeat(5 - wanted) : '☆☆☆☆☆';
    els.stars.style.color = wanted > 0 ? '#ff5a4e' : '#c9bfa8';
    els.cash.textContent = `$${state.cash.toLocaleString('en-US')}`;
    const health = Math.max(0, Math.ceil(player.health));
    els.healthFill.style.width = `${health}%`;
    els.healthFill.style.background = health > 50 ? '#3aa655' : health > 25 ? '#ffc21c' : '#ff5a4e';
    els.healthText.textContent = `HP ${health}`;
    const car = player.inCar !== null ? state.cars[player.inCar] : null;
    els.speed.textContent = car ? `${Math.round(Math.abs(car.speed) * 3.6)} km/h` : '';
    els.missionName.textContent = state.missions.active
      ? `Mission ${state.missions.index + 1}/4 — ${MISSIONS[state.missions.index].name}`
      : state.missions.completedAll
        ? 'All missions complete'
        : 'Sunspire';
    els.objective.textContent = objectiveText(state);
    // A running fare is the objective that matters: fare, dropoff, time left.
    if (state.taxi && state.taxi.active) {
      const fare = state.taxi.active;
      els.objective.textContent = `Taxi fare $${fare.fare} — reach the orange ring, ${Math.max(0, Math.ceil(fare.timer))}s left`;
    }
    const banner = state.missions.bannerTimer > 0 ? state.missions.banner : '';
    els.banner.textContent = banner;
    els.banner.style.opacity = banner ? '1' : '0';
    // Context prompt ("E — Steal car", ...).
    let prompt = '';
    if (screen === SCREEN_PLAY) {
      if (player.inCar !== null && state.taxi && state.taxi.hailer && !state.taxi.active) {
        const hailer = state.taxi.hailer;
        const car = state.cars[player.inCar];
        if (car && Math.hypot(car.x - hailer.x, car.z - hailer.z) < 30) {
          prompt = 'Slow down near the green marker to pick up a taxi fare';
        }
      }
      if (!prompt) {
        if (player.inCar !== null) prompt = 'E — Exit car · Space — Handbrake';
        else if (state.nearestCar) prompt = 'E — Steal car';
        else if (state.missions.active && MISSIONS[state.missions.index].kind === 'heist' && state.missions.stage === 1) prompt = 'Walk to the bank door to grab the cash';
        else prompt = 'WASD — Move · Mouse — Camera · LMB — Shoot';
      }
    }
    els.prompt.textContent = prompt;
    els.crosshair.style.display = screen === SCREEN_PLAY && player.inCar === null ? 'block' : 'none';
    if (toastTimer > 0) {
      toastTimer -= 1 / 60;
      if (toastTimer <= 0) els.toast.style.opacity = '0';
    }
    drawMinimap(state);
    if (screen !== lastScreen) {
      lastScreen = screen;
      const overlay = els.overlay;
      if (screen === SCREEN_TITLE) {
        overlay.style.display = 'flex';
        els.overlayTitle.textContent = 'SUNSPIRE HEAT';
        els.overlayBody.innerHTML =
          `${STORY.intro}<br><br>` +
          `<b>Controls</b> — WASD move / drive · Mouse camera · E enter / steal car · Space handbrake / jump · ` +
          `Left click shoot · M mute · P / Esc pause<br><br>` +
          `Steal cars, outrun the police, run four missions for Dario and take the big score. ` +
          `Wanted stars rise with every crime — lose the heat at the safehouse.`;
        els.overlayPrompt.textContent = 'Press Space or click to start';
      } else if (screen === SCREEN_PAUSED) {
        overlay.style.display = 'flex';
        els.overlayTitle.textContent = 'PAUSED';
        els.overlayBody.textContent = 'The city waits. R — retry the current mission.';
        els.overlayPrompt.textContent = 'Press P to resume';
      } else if (screen === SCREEN_OVER) {
        overlay.style.display = 'flex';
        els.overlayTitle.textContent = extra === 'busted' ? 'BUSTED' : 'WASTED';
        els.overlayBody.textContent =
          extra === 'busted'
            ? 'The Sunspire PD caught up with you. Cash kept, pride lost.'
            : 'Rook went down in the streets of Sunspire.';
        els.overlayPrompt.textContent = `Cash $${state.cash.toLocaleString('en-US')} · Press Space to try again`;
      } else if (screen === SCREEN_COMPLETE) {
        overlay.style.display = 'flex';
        els.overlayTitle.textContent = 'SUNSPIRE IS YOURS';
        els.overlayBody.innerHTML =
          `All four missions complete — $${state.cash.toLocaleString('en-US')} earned, ` +
          `${state.stats.carsStolen} cars stolen, ${state.stats.kills} rivals down.<br><br>` +
          `Free roam continues: steal, drive, and stay ahead of the law.`;
        els.overlayPrompt.textContent = 'Press Space to keep playing';
      } else {
        overlay.style.display = 'none';
      }
    }
    root.style.display = screen === SCREEN_TITLE ? 'none' : 'block';
  }

  return { update, showToast };
}
