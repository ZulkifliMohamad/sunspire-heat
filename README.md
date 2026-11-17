# Sunspire Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ZulkifliMohamad/sunspire-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ZulkifliMohamad/sunspire-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Sunspire Heat is an original open-world crime game set in the sun-soaked city of Sunspire. Rook came back to town with empty pockets and a name nobody remembers; fixer Dario has work, if Rook has nerve. Explore a living grid city on foot and by car, steal vehicles, outrun the Sunspire PD as your wanted level climbs to five stars, and run four story missions — from a first stolen car to the big score at the bank.

No part of this game copies any existing commercial game: the city, characters, vehicles, story, art and sound are all original. All art is built in code (Three.js), all sound is synthesised live with WebAudio, and the game runs fully offline from static files — no network request, no external asset.

## The city

- A procedural street grid with ~50 buildings, a plaza, a park, a marina and a beach road, all generated from a seeded RNG so the same seed always builds the same Sunspire.
- 14 traffic cars driving the grid in lanes and 26 pedestrians strolling the sidewalks.
- Police who spawn at the city edge, chase, ram, and bust you on foot when the heat is high.
- Four missions with objectives, timers and payouts ($500 / $800 / $1,200 / $2,500), plus free roam after the story ends.
- Combat on foot with a hitscan pistol, rival gang members who shoot back, health that regens out of combat.
- A save in localStorage: cash, mission progress and best stats persist between visits.

## Controls

| Input | Action |
|---|---|
| W A S D / arrows | Move on foot, drive (W accelerate, S brake / reverse, A D steer) |
| Mouse | Orbit the third-person camera (click to lock the pointer) |
| E | Enter / exit a car — near a parked car, this steals it (+1 wanted star) |
| Space | Jump on foot, handbrake while driving |
| Left click | Shoot (on foot) |
| M | Mute / unmute sound |
| P / Esc | Pause / resume |
| R (on the pause screen) | Retry the current mission |

The HUD shows wanted stars, cash, the current mission objective, a live minimap (roads, buildings, player, police, mission marker), health and speed at a glance.

## Run

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no install.

## Layout

- `game/` — the game: `index.html` + `src/` modules (one job per file) + vendored Three.js 0.187.0 under `game/vendor/three/`
- `game/src/` — `config.js` tuning, `random.js` seeded RNG, `city.js` layout, `traffic.js` cars + pedestrians, `vehicles.js` car physics + stealing, `player.js` on-foot controller, `police.js` wanted level + chase AI, `missions.js` story + objectives, `combat.js` shooting + enemies, `hud.js` HUD + minimap, `audio.js` synthesised sound, `save.js` localStorage, `shots.js` staged screenshots, `render.js` Three.js scene, `world.js` state machine, `input.js` keyboard + mouse, `main.js` boot + fixed-step loop
- `screenshots/` — 4 staged screenshots of the game itself (see below)
- `shots.json` — the staging map: `?shot=start|play|mission|end&seed=1`
- `main.ts` — builds the make.fun dossier into the output directory (fails fast unless there are 3–4 screenshots)
- `serve.ts` — dev static server for `game/`
- `vendor/makefun-game.ts` — kit dossier library (unchanged)

## Screenshots

The four screenshots are staged deterministically, never edited: each `?shot=` scene plays the real rules forward from a fresh world with an autopilot (road-following chase driving, plaza shootout, title orbit, mission-complete stats), renders twice, and sets `window.__shotReady`.

- `1-start.jpg` — title screen over the living city
- `2-play.jpg` — driving chase: wanted stars, minimap and mission objective in one frame
- `3-mission.jpg` — on-foot plaza shootout with the mission beacon
- `4-end.jpg` — all missions complete, stats, parked on the beach road by the marina

## Build the dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Entered on [make.fun](https://make.fun/?ref=6ksyay6h&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards.
