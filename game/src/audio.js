// Sound, all synthesised with WebAudio: no audio files, no network. Engine
// hum follows the player's car speed, a two-tone siren follows the wanted
// level, and gunshots, chimes and mission stings are short noise/osc bursts.
// Everything is guarded: with no user gesture yet (or in a screenshot) the
// context simply does not exist and every call is a no-op.
export function createAudio() {
  return {
    ctx: null,
    master: null,
    engine: null,
    engineGain: null,
    siren: null,
    sirenGain: null,
    muted: false,
    musicTimer: 0,
    musicStep: 0,
    started: false,
  };
}

function ensure(audio) {
  if (audio.ctx || audio.muted) return false;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.35;
    audio.master.connect(audio.ctx.destination);
    // Engine: a low sawtooth through a low-pass filter.
    audio.engine = audio.ctx.createOscillator();
    audio.engine.type = 'sawtooth';
    audio.engine.frequency.value = 60;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engine.connect(filter);
    filter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engine.start();
    // Siren: two alternating tones, quiet until wanted > 0.
    audio.siren = audio.ctx.createOscillator();
    audio.siren.type = 'triangle';
    audio.siren.frequency.value = 700;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0;
    audio.siren.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.siren.start();
    audio.started = true;
    return true;
  } catch {
    return false;
  }
}

/** Call on the first user gesture; also resumes a suspended context. */
export function unlockAudio(audio) {
  ensure(audio);
  if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master) audio.master.gain.value = muted ? 0 : 0.35;
}

function blip(audio, freq, dur, type, vol, slideTo) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol || 0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBurst(audio, dur, vol, lowpass) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  const len = Math.floor(audio.ctx.sampleRate * dur);
  const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Deterministic noise: a tiny LCG, not Math.random, so replays stay identical.
  let s = 123456789;
  for (let i = 0; i < len; i += 1) {
    s = (Math.imul(s, 1103515245) + 12345) | 0;
    data[i] = ((s >>> 0) / 4294967296) * 2 - 1;
    data[i] *= 1 - i / len;
  }
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = audio.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass || 3000;
  const gain = audio.ctx.createGain();
  gain.gain.value = vol || 0.4;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start(t);
}

export const sfx = {
  gunshot(audio) {
    noiseBurst(audio, 0.16, 0.5, 1800);
  },
  hit(audio) {
    blip(audio, 180, 0.08, 'square', 0.15);
  },
  chime(audio) {
    blip(audio, 880, 0.12, 'sine', 0.2);
    setTimeout(() => blip(audio, 1320, 0.18, 'sine', 0.2), 90);
  },
  mission(audio) {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(audio, f, 0.22, 'triangle', 0.22), i * 110));
  },
  busted(audio) {
    blip(audio, 220, 0.5, 'sawtooth', 0.2, 110);
  },
  steal(audio) {
    blip(audio, 330, 0.15, 'square', 0.15, 660);
  },
  pickup(audio) {
    blip(audio, 660, 0.12, 'sine', 0.2);
    setTimeout(() => blip(audio, 880, 0.16, 'sine', 0.2), 100);
  },
  fare(audio) {
    [784, 988, 1175].forEach((f, i) => setTimeout(() => blip(audio, f, 0.18, 'triangle', 0.22), i * 100));
  },
};

/** Per-frame audio: engine pitch, siren, and a slow sunset bassline. */
export function stepAudio(audio, state, dt) {
  if (!audio.ctx || audio.muted) return;
  const player = state.player;
  const speed = player.inCar !== null ? Math.abs((state.cars[player.inCar] || { speed: 0 }).speed) : 0;
  if (audio.engine) audio.engine.frequency.value = 55 + speed * 4.5;
  if (audio.engineGain) audio.engineGain.gain.value = player.inCar !== null ? 0.05 + speed * 0.002 : 0;
  if (audio.siren && audio.sirenGain) {
    const wanted = state.police.wanted;
    audio.sirenGain.gain.value = wanted > 0 ? 0.035 : 0;
    if (wanted > 0) {
      const phase = Math.floor(audio.ctx.currentTime * 1.6) % 2;
      audio.siren.frequency.value = phase === 0 ? 700 : 950;
    }
  }
  // Bassline: one soft note every 0.42 s, cycling a minor groove.
  audio.musicTimer -= dt;
  if (audio.musicTimer <= 0) {
    audio.musicTimer = 0.42;
    const notes = [110, 110, 130.8, 98, 110, 146.8, 130.8, 98];
    blip(audio, notes[audio.musicStep % notes.length], 0.38, 'sine', 0.07);
    audio.musicStep += 1;
  }
}
