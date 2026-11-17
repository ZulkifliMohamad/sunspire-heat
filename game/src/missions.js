// Missions and story: four scripted jobs with objectives, payouts and
// progression. A mission is a small state machine (stage, timer, marker);
// the world calls update() every step and reads objectiveText() and marker()
// for the HUD and the minimap.
import { CITY, MISSIONS } from './config.js';
import { addWanted, clearWanted, playerPosition } from './police.js';
import { spawnEnemies } from './combat.js';

export function createMissions() {
  return {
    index: 0,
    stage: 0,
    timer: 0,
    active: false,
    done: [],
    cash: 0,
    checkpoint: 0,
    checkpoints: [],
    marker: null,
    banner: '',
    bannerTimer: 0,
    completedAll: false,
  };
}

function setMarker(missions, x, z, label) {
  missions.marker = { x, z, label };
}

function startMission(state, index) {
  const m = state.missions;
  const def = MISSIONS[index];
  m.index = index;
  m.stage = 0;
  m.active = true;
  m.checkpoint = 0;
  m.checkpoints = [];
  m.timer = 0;
  if (def.kind === 'steal-drive') {
    setMarker(m, state.city.marina.x, state.city.marina.z, 'Marina');
  } else if (def.kind === 'checkpoints') {
    m.checkpoints = [
      { x: -110, z: 110 },
      { x: 110, z: -22 },
      { x: 22, z: -154 },
    ];
    m.timer = 90;
    setMarker(m, m.checkpoints[0].x, m.checkpoints[0].z, 'Drop 1/3');
  } else if (def.kind === 'shootout') {
    const plaza = state.city.plaza;
    setMarker(m, plaza.x, plaza.z, 'Plaza');
    spawnEnemies(state, plaza.x, plaza.z, 4);
  } else if (def.kind === 'heist') {
    setMarker(m, state.city.bank.x, state.city.bank.z, 'Bank');
  }
  m.banner = `${def.name} — ${def.brief}`;
  m.bannerTimer = 5;
}

function completeMission(state) {
  const m = state.missions;
  const def = MISSIONS[m.index];
  m.cash += def.payout;
  state.cash += def.payout;
  m.done.push(m.index);
  state.stats.missionsDone += 1;
  m.active = false;
  m.marker = null;
  m.banner = `Mission complete: ${def.name} — $${def.payout}`;
  m.bannerTimer = 5;
  if (m.index + 1 < MISSIONS.length) {
    startMission(state, m.index + 1);
  } else {
    m.completedAll = true;
    m.banner = 'All missions complete. Sunspire is yours, Rook.';
    m.bannerTimer = 8;
  }
}

function distTo(state, x, z) {
  const p = playerPosition(state);
  return Math.hypot(p.x - x, p.z - z);
}

/** Begin the first mission (called on game start). */
export function beginStory(state) {
  state.missions.cash = 0;
  startMission(state, 0);
}

/** Current objective line for the HUD. */
export function objectiveText(state) {
  const m = state.missions;
  if (m.completedAll && !m.active) return 'Free roam — Sunspire is yours. Missions: 4/4 done.';
  const def = MISSIONS[m.index];
  if (def.kind === 'steal-drive') {
    return state.player.inCar !== null
      ? `Drive to the marina marker — ${def.name}`
      : `Steal a car (E near a parked car) — ${def.name}`;
  }
  if (def.kind === 'checkpoints') {
    return `Courier: reach drop ${m.checkpoint + 1}/3 — ${Math.max(0, Math.ceil(m.timer))}s left`;
  }
  if (def.kind === 'shootout') {
    const left = state.enemies.filter((e) => e.alive).length;
    return `Clear the plaza — ${left} rival${left === 1 ? '' : 's'} left`;
  }
  if (def.kind === 'heist') {
    if (m.stage === 0) return 'Drive to the bank and get out on foot';
    if (m.stage === 1) return 'Grab the cash at the bank door';
    if (m.stage === 2) return 'Lose the heat, then reach the safehouse';
    return def.name;
  }
  return def.brief;
}

/** One fixed step of mission logic. */
export function stepMissions(state, dt) {
  const m = state.missions;
  if (m.bannerTimer > 0) m.bannerTimer -= dt;
  if (!m.active) return;
  const def = MISSIONS[m.index];

  if (def.kind === 'steal-drive') {
    if (state.player.inCar !== null && distTo(state, state.city.marina.x, state.city.marina.z) < 8) {
      completeMission(state);
    }
  } else if (def.kind === 'checkpoints') {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.active = false;
      m.banner = 'Courier failed — the package went cold. Try again from the pause menu (R).';
      m.bannerTimer = 6;
      m.stage = 99;
      return;
    }
    const cp = m.checkpoints[m.checkpoint];
    if (cp && distTo(state, cp.x, cp.z) < 7) {
      m.checkpoint += 1;
      if (m.checkpoint >= m.checkpoints.length) completeMission(state);
      else setMarker(m, m.checkpoints[m.checkpoint].x, m.checkpoints[m.checkpoint].z, `Drop ${m.checkpoint + 1}/3`);
    }
  } else if (def.kind === 'shootout') {
    if (state.enemies.length > 0 && state.enemies.every((e) => !e.alive)) completeMission(state);
  } else if (def.kind === 'heist') {
    if (m.stage === 0) {
      if (distTo(state, state.city.bank.x, state.city.bank.z) < 10) {
        m.stage = 1;
        setMarker(m, state.city.bank.x, state.city.bank.z, 'Cash');
        m.banner = 'Inside job: grab the cash, then run.';
        m.bannerTimer = 4;
      }
    } else if (m.stage === 1) {
      if (state.player.inCar === null && distTo(state, state.city.bank.x, state.city.bank.z) < 5) {
        m.stage = 2;
        state.police.wanted = 4;
        state.police.heat = 1;
        setMarker(m, state.city.safehouse.x, state.city.safehouse.z, 'Safehouse');
        m.banner = 'Four stars. Lose the heat and reach the safehouse.';
        m.bannerTimer = 5;
      }
    } else if (m.stage === 2) {
      if (distTo(state, state.city.safehouse.x, state.city.safehouse.z) < 8) {
        clearWanted(state);
        completeMission(state);
      }
    }
  }
}

/** Retry the current mission after a failure (R on the pause screen). */
export function retryMission(state) {
  const m = state.missions;
  if (!m.active && m.stage === 99) startMission(state, m.index);
}
