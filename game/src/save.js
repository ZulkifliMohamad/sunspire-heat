// Save/load in localStorage: cash, mission progress and best stats. The game
// keeps playing without it (private windows), it just does not persist.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        cash: state.cash,
        missionsDone: state.stats.missionsDone,
        carsStolen: state.stats.carsStolen,
        kills: state.stats.kills,
        bestCash: state.bestCash,
        savedAt: Date.now(),
      }),
    );
  } catch {
    // Storage off: the run still counts, it just is not kept.
  }
}

export function applySave(state, data) {
  if (!data) return;
  state.cash = typeof data.cash === 'number' ? data.cash : 0;
  state.missions.cash = state.cash;
  state.bestCash = typeof data.bestCash === 'number' ? data.bestCash : 0;
}
