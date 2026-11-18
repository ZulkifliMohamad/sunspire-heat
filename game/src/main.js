// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer and HUD paint what is there. Screens: title, play, paused, over,
// complete. ?seed=N fixes the world. ?shot=start|play|mission|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { blankFrame, createWorld, EVENT_BUSTED, EVENT_MISSION, EVENT_OVER, EVENT_SHOT, EVENT_STEAL, EVENT_TAXI_DONE, EVENT_TAXI_PICKUP } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createHud } from './hud.js';
import { createAudio, setMuted, sfx, stepAudio, unlockAudio } from './audio.js';
import { applySave, loadSave, writeSave } from './save.js';
import { retryMission } from './missions.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261118;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas, world.state.city);
const hud = createHud();
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, painted === 0);
    hud.update(world.state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let overReason = '';
  let accumulator = 0;
  let last = performance.now();
  // One-shot presses, cached once per frame: handleActions takes the menu
  // bits, step() takes the interact bit, nothing is read twice or lost.
  let queuedActions = 0;

  applySave(world.state, loadSave());

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    applySave(world.state, loadSave());
    accumulator = 0;
    screen = SCREEN_PLAY;
    overReason = '';
    unlockAudio(audio);
    announce('Playing. Follow the mission objective.');
  }

  function endGame(reason) {
    screen = SCREEN_OVER;
    overReason = reason;
    if (world.state.cash > world.state.bestCash) world.state.bestCash = world.state.cash;
    writeSave(world.state);
    if (reason === 'busted') sfx.busted(audio);
    announce(reason === 'busted' ? 'Busted by the police.' : 'Wasted.');
  }

  function handleActions() {
    const actions = queuedActions;
    queuedActions &= ~ACTION_CONFIRM & ~ACTION_PAUSE & ~ACTION_MUTE;
    if (actions & ACTION_MUTE) {
      setMuted(audio, !audio.muted);
      hud.showToast(audio.muted ? 'Sound muted (M)' : 'Sound on (M)');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_COMPLETE)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyR' && screen === SCREEN_PAUSED) {
      retryMission(world.state);
      screen = SCREEN_PLAY;
      hud.showToast('Mission restarted.');
    }
  });
  canvas.addEventListener('mousedown', () => unlockAudio(audio));

  function step() {
    const frame = blankFrame();
    if (screen === SCREEN_TITLE) {
      frame.attract = true;
      world.step(STEP, frame);
      return;
    }
    const move = input.move();
    frame.move = move;
    frame.mouse = input.takeMouse();
    frame.shooting = input.shooting;
    frame.jump = input.held('Space');
    frame.interact = !!(queuedActions & ACTION_INTERACT);
    queuedActions &= ~ACTION_INTERACT;
    const events = world.step(STEP, frame);
    if (events & EVENT_STEAL) {
      sfx.steal(audio);
      hud.showToast('Car stolen — the heat is on.');
    }
    if (events & EVENT_TAXI_PICKUP) sfx.pickup(audio);
    if (events & EVENT_TAXI_DONE) {
      sfx.fare(audio);
      writeSave(world.state);
    }
    if (events & EVENT_SHOT) sfx.gunshot(audio);
    if (events & EVENT_MISSION) {
      sfx.mission(audio);
      writeSave(world.state);
      if (world.state.missions.completedAll) {
        screen = SCREEN_COMPLETE;
        writeSave(world.state);
      }
    }
    if (events & EVENT_BUSTED) endGame('busted');
    else if (events & EVENT_OVER) endGame('wasted');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    queuedActions |= input.takeActions();
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    stepAudio(audio, world.state, STEP);
    renderer.draw(world.state, screen);
    hud.update(world.state, screen, overReason);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Sunspire Heat. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
