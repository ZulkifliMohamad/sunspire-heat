// Drawing only: the Three.js scene, camera and every mesh, driven by the
// world state. The city is built once from the layout; cars, people, police
// and markers are pooled meshes updated from state each frame. No rules here.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

function windowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = '#1d3247';
  for (let y = 8; y < 120; y += 16) {
    for (let x = 6; x < 58; x += 14) ctx.fillRect(x, y, 9, 10);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1d3247, roughness: 0.15, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.1), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  for (const [x, z] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.34, z);
    group.add(wheel);
  }
  if (isPolice) {
    const barMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), barMat);
    bar.position.set(0, 1.5, -0.2);
    bar.name = 'lightbar';
    group.add(bar);
  }
  return group;
}

function makePersonMesh(color) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.05, 10), mat);
  body.position.y = 0.85;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.7 }),
  );
  head.position.y = 1.62;
  group.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.24), new THREE.MeshStandardMaterial({ color: 0x2b2b33 }));
  legs.position.y = 0.28;
  group.add(legs);
  return group;
}

export function createRenderer(canvas, city) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyHorizon);
  scene.fog = new THREE.Fog(0xffd9a0, 150, 520);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7f6a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
  sun.position.set(120, 180, 60);
  scene.add(sun);

  // Ground, roads and sidewalks.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.bound * 2 + 120, CITY.bound * 2 + 120),
    new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.road, roughness: 0.95 });
  const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
  // One road plane per street, both directions. The plane starts flat
  // (420 m along X, 11 m along Z); a north-south street needs the extra
  // quarter turn so its length runs along Z instead. The turn and the
  // position belong to the same branch — mixing them piles every road
  // onto the two centre streets and leaves the rest of the grid dirt.
  for (const s of CITY.streets) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY.bound * 2 + 40, CITY.roadHalf * 2), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (!horizontal) road.rotation.z = Math.PI / 2;
      road.position.set(horizontal ? 0 : s, 0.02, horizontal ? s : 0);
      scene.add(road);
      const line = new THREE.Mesh(new THREE.PlaneGeometry(CITY.bound * 2 + 40, 0.28), lineMat);
      line.rotation.x = -Math.PI / 2;
      if (!horizontal) line.rotation.z = Math.PI / 2;
      line.position.set(horizontal ? 0 : s, 0.04, horizontal ? s : 0);
      scene.add(line);
    }
  }
  // Water at the marina (south edge).
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 60),
    new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.25, metalness: 0.4 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.03, CITY.bound + 40);
  scene.add(water);

  // Buildings with a shared window texture.
  const winTex = windowTexture();
  for (const b of city.buildings) {
    const tex = winTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(b.w / 9)), Math.max(1, Math.round(b.h / 9)));
    const mat = new THREE.MeshStandardMaterial({ color: b.color, map: tex, roughness: 0.85 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
    mesh.position.set(b.x, b.h / 2, b.z);
    scene.add(mesh);
    if (b.roof) {
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(b.w * 0.5, 2.2, b.d * 0.5),
        new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 1 }),
      );
      roof.position.set(b.x, b.h + 1.1, b.z);
      scene.add(roof);
    }
  }
  // Parks and plaza.
  for (const park of city.parks) {
    const mat = new THREE.MeshStandardMaterial({ color: park.kind === 'plaza' ? 0xcbb894 : 0x6f9e5a, roughness: 1 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(park.w, park.d), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(park.x, 0.05, park.z);
    scene.add(mesh);
  }
  // Lamps and palms.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 0.6 });
  const palmMat = new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 1 });
  for (const prop of city.props) {
    if (prop.kind === 'lamp') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.4, 8), lampMat);
      pole.position.set(prop.x, 2.7, prop.z);
      scene.add(pole);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd76e, emissiveIntensity: 0.8 }),
      );
      bulb.position.set(prop.x, 5.5, prop.z);
      scene.add(bulb);
    } else {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x7a5a38 }));
      trunk.position.set(prop.x, 1.7, prop.z);
      scene.add(trunk);
      const top = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), palmMat);
      top.scale.y = 0.55;
      top.position.set(prop.x, 3.8, prop.z);
      scene.add(top);
    }
  }

  // Mission marker beacon + checkpoint rings.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 60, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: PALETTE.marker, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  scene.add(beacon);
  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 4.6, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.marker, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.08;
  scene.add(beaconRing);
  const ringGeo = new THREE.TorusGeometry(5, 0.35, 10, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: PALETTE.marker });
  const checkpointRing = new THREE.Mesh(ringGeo, ringMat);
  checkpointRing.rotation.x = Math.PI / 2;
  scene.add(checkpointRing);

  // Taxi rings: green ground ring for a waiting hailer, orange ring for a dropoff.
  const hailerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 2.4, 32),
    new THREE.MeshBasicMaterial({ color: 0x3aa655, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  hailerRing.rotation.x = -Math.PI / 2;
  hailerRing.position.y = 0.08;
  scene.add(hailerRing);
  const taxiRing = new THREE.Mesh(
    new THREE.TorusGeometry(5, 0.35, 10, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9f1c }),
  );
  taxiRing.rotation.x = Math.PI / 2;
  scene.add(taxiRing);

  // Tracer line for shots.
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
  const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe27a }));
  tracer.visible = false;
  scene.add(tracer);

  // Pooled meshes for cars, people and enemies.
  const carMeshes = new Map();
  const personMeshes = new Map();
  const playerMesh = makePersonMesh(PALETTE.player);
  scene.add(playerMesh);

  function carMeshFor(car) {
    let mesh = carMeshes.get(car.id);
    if (!mesh) {
      mesh = makeCarMesh(car.color, car.kind === 'police');
      scene.add(mesh);
      carMeshes.set(car.id, mesh);
    }
    return mesh;
  }

  function personMeshFor(key, color) {
    let mesh = personMeshes.get(key);
    if (!mesh) {
      mesh = makePersonMesh(color);
      scene.add(mesh);
      personMeshes.set(key, mesh);
    }
    return mesh;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const camPos = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  /** Paint one frame from the world state. `snap` jumps the camera to its
   *  target at once (screenshot staging); otherwise it eases toward it. */
  function draw(state, screen, snap) {
    const player = state.player;
    const cam = state.camera;
    const time = state.time;

    // Cars.
    const seenCars = new Set();
    for (const car of state.cars) {
      const mesh = carMeshFor(car);
      mesh.visible = true;
      mesh.position.set(car.x, 0, car.z);
      mesh.rotation.y = car.heading;
      seenCars.add(car.id);
      if (car.kind === 'police') {
        const bar = mesh.getObjectByName('lightbar');
        if (bar) {
          const on = Math.floor(time * 5) % 2 === 0;
          bar.material.color.setHex(on ? 0xff2222 : 0x2244ff);
          bar.material.emissive.setHex(on ? 0xff2222 : 0x2244ff);
        }
      }
    }
    for (const [id, mesh] of carMeshes) if (!seenCars.has(id)) mesh.visible = false;

    // Player.
    if (player.inCar !== null) {
      playerMesh.visible = false;
    } else {
      playerMesh.visible = true;
      playerMesh.position.set(player.x, player.y, player.z);
      playerMesh.rotation.y = player.heading;
      const bob = Math.abs(player.speed) > 0.5 ? Math.sin(time * 12) * 0.06 : 0;
      playerMesh.position.y = player.y + bob;
    }

    // Pedestrians and enemies.
    const seenPeople = new Set();
    state.peds.forEach((ped, i) => {
      const key = `ped${i}`;
      const mesh = personMeshFor(key, ped.color);
      mesh.visible = true;
      mesh.position.set(ped.x, Math.sin(ped.walkPhase) * 0.05, ped.z);
      mesh.rotation.y = ped.heading;
      seenPeople.add(key);
    });
    state.enemies.forEach((enemy, i) => {
      const key = `enemy${i}`;
      const mesh = personMeshFor(key, 0x8a1f1f);
      mesh.visible = enemy.alive;
      mesh.position.set(enemy.x, 0, enemy.z);
      mesh.rotation.y = enemy.heading;
      seenPeople.add(key);
    });
    for (const [key, mesh] of personMeshes) if (!seenPeople.has(key)) mesh.visible = false;

    // Marker beacon and checkpoint ring.
    const marker = state.missions.marker;
    beacon.visible = !!marker;
    beaconRing.visible = !!marker;
    if (marker) {
      beacon.position.set(marker.x, 30, marker.z);
      beaconRing.position.set(marker.x, 0.08, marker.z);
      const pulse = 1 + Math.sin(time * 4) * 0.12;
      beaconRing.scale.set(pulse, pulse, 1);
    }
    const showRing =
      state.missions.active &&
      state.missions.checkpoints.length > 0 &&
      state.missions.checkpoint < state.missions.checkpoints.length;
    checkpointRing.visible = !!showRing;
    if (showRing) {
      const cp = state.missions.checkpoints[state.missions.checkpoint];
      checkpointRing.position.set(cp.x, 2.2, cp.z);
      checkpointRing.rotation.z = time * 0.8;
    }

    // Taxi rings: hailer waiting on the sidewalk, dropoff ring when a fare runs.
    const taxi = state.taxi;
    hailerRing.visible = !!(taxi && taxi.hailer && !taxi.active);
    if (hailerRing.visible) {
      hailerRing.position.set(taxi.hailer.x, 0.08, taxi.hailer.z);
      const pulse = 1 + Math.sin(time * 4) * 0.15;
      hailerRing.scale.set(pulse, pulse, 1);
    }
    taxiRing.visible = !!(taxi && taxi.active);
    if (taxiRing.visible) {
      taxiRing.position.set(taxi.active.x, 2.2, taxi.active.z);
      taxiRing.rotation.z = time * 0.8;
    }

    // Shot tracer.
    if (state.combat.tracerTimer > 0 && state.combat.tracer) {
      const t = state.combat.tracer;
      const positions = tracer.geometry.attributes.position;
      positions.setXYZ(0, t.x, 1.4, t.z);
      positions.setXYZ(1, t.x + Math.sin(t.angle) * t.dist, 1.4, t.z + Math.cos(t.angle) * t.dist);
      positions.needsUpdate = true;
      tracer.visible = true;
    } else {
      tracer.visible = false;
    }

    // Camera.
    if (screen === SCREEN_TITLE) {
      // Tight orbit so the city reads big and sun-soaked behind the title.
      const angle = time * 0.07;
      camPos.set(Math.sin(angle) * 120, 55, Math.cos(angle) * 120);
      lookAt.set(0, 12, 0);
    } else {
      const focus = player.inCar !== null && state.cars[player.inCar]
        ? state.cars[player.inCar]
        : player;
      const dist = player.inCar !== null ? 11 : 8.5;
      const height = 3.2 + cam.pitch * 7;
      camPos.set(
        focus.x - Math.sin(cam.yaw) * dist,
        height,
        focus.z - Math.cos(cam.yaw) * dist,
      );
      lookAt.set(focus.x + Math.sin(cam.yaw) * 6, 1.6, focus.z + Math.cos(cam.yaw) * 6);
    }
    camera.position.copy(snap ? camPos : camera.position.lerp(camPos, 0.35));
    camera.lookAt(lookAt);
    renderer.render(scene, camera);
  }

  return { draw };
}
