/* =========================================================
   nook.fm — the room: architecture, props, lights, weather
   Coordinates: floor y=0, back wall z=-4.5, room x ∈ [-7, 7]
   ========================================================= */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import * as TX from './textures.js';
import { buildCatalogCabinet } from './catalog.js';
import { rng, clamp, lerp, noise1, smooth, seg } from './utils.js';

export const LAYOUT = {
  door: { x: -4.2, w: 1.1, h: 2.2 },
  window: { x: 1.3, y: 2.35, w: 2.6, h: 1.55 },
  couch: { x: 1.3, z: -3.85, w: 2.7, seatTop: 0.48 },
  sideTable: { x: -0.55, z: -3.72, top: 0.58 },
  coffee: { x: 1.3, z: -1.95 },
  turntable: { x: 4.85, z: -4.05 },
};

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });

export function buildWorld(scene) {
  RectAreaLightUniformsLib.init();
  const W = { group: new THREE.Group(), anim: [] };
  scene.add(W.group);
  const R = rng(77);
  const add = (mesh, parent = W.group, cast = true, recv = true) => {
    mesh.castShadow = cast; mesh.receiveShadow = recv; parent.add(mesh); return mesh;
  };
  const box = (w, h, d, mat, x, y, z, parent, r = 0) => {
    const g = r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); return add(m, parent);
  };
  const cyl = (rt, rb, h, mat, x, y, z, parent, seg = 32) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); return add(m, parent);
  };

  /* ---------------- architecture ---------------- */
  const floorTex = TX.woodFloor();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), std('#ffffff', { map: floorTex, roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0.5);
  add(floor, W.group, false, true);

  // back wall with door + window holes (extruded shape → UVs in metres)
  const wpTex = TX.wallpaper(); wpTex.repeat.set(0.7, 0.7);
  const wallMat = std('#ffffff', { map: wpTex, roughness: 0.92 });
  const { door, window: win } = LAYOUT;
  const shape = new THREE.Shape();
  shape.moveTo(-7, 0); shape.lineTo(7, 0); shape.lineTo(7, 4.2); shape.lineTo(-7, 4.2); shape.lineTo(-7, 0);
  const dh = new THREE.Path();
  dh.moveTo(door.x - door.w / 2, 0.001); dh.lineTo(door.x + door.w / 2, 0.001); dh.lineTo(door.x + door.w / 2, door.h); dh.lineTo(door.x - door.w / 2, door.h);
  // door hole touches bottom edge → instead build it as a notch in the outline
  const outline = new THREE.Shape();
  outline.moveTo(-7, 0);
  outline.lineTo(door.x - door.w / 2, 0); outline.lineTo(door.x - door.w / 2, door.h); outline.lineTo(door.x + door.w / 2, door.h); outline.lineTo(door.x + door.w / 2, 0);
  outline.lineTo(7, 0); outline.lineTo(7, 4.2); outline.lineTo(-7, 4.2); outline.lineTo(-7, 0);
  const wh = new THREE.Path();
  wh.moveTo(win.x - win.w / 2, win.y - win.h / 2); wh.lineTo(win.x + win.w / 2, win.y - win.h / 2);
  wh.lineTo(win.x + win.w / 2, win.y + win.h / 2); wh.lineTo(win.x - win.w / 2, win.y + win.h / 2);
  outline.holes.push(wh);
  const wallGeo = new THREE.ExtrudeGeometry(outline, { depth: 0.2, bevelEnabled: false });
  const backWall = new THREE.Mesh(wallGeo, wallMat);
  backWall.position.z = -4.7;
  add(backWall, W.group, true, true);

  // side walls + ceiling
  const sideMat = std('#ffffff', { map: wpTex.clone(), roughness: 0.92 });
  sideMat.map.repeat.set(7, 3); sideMat.map.needsUpdate = true;
  const lw = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.2), sideMat);
  lw.rotation.y = Math.PI / 2; lw.position.set(-7, 2.1, 0.5); add(lw, W.group, false, true);
  const rw = lw.clone(); rw.rotation.y = -Math.PI / 2; rw.position.x = 7; add(rw, W.group, false, true);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), std('#2a1c3a'));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.2, 0.5); add(ceil, W.group, false, true);

  // wainscot + chair rail + skirting
  const wainMat = std('#2c1d40', { roughness: 0.7 });
  const trimMat = std('#f3e2c7', { roughness: 0.5 });
  const segs = [[-7, door.x - door.w / 2 - 0.12], [door.x + door.w / 2 + 0.12, 7]];
  segs.forEach(([a, b]) => {
    const w = b - a, cx = (a + b) / 2;
    box(w, 0.95, 0.04, wainMat, cx, 0.475, -4.48);
    box(w, 0.05, 0.07, trimMat, cx, 0.97, -4.46);
    box(w, 0.12, 0.05, trimMat, cx, 0.06, -4.46);
    for (let x = a + 0.12; x < b - 0.5; x += 0.62) box(0.5, 0.62, 0.015, std('#33234a', { roughness: 0.65 }), x + 0.25, 0.5, -4.455);
  });

  /* ---------------- door + hallway ---------------- */
  const dx0 = door.x - door.w / 2;
  // frame
  box(0.1, door.h + 0.1, 0.26, trimMat, dx0 - 0.05, door.h / 2, -4.6);
  box(0.1, door.h + 0.1, 0.26, trimMat, door.x + door.w / 2 + 0.05, door.h / 2, -4.6);
  box(door.w + 0.3, 0.1, 0.26, trimMat, door.x, door.h + 0.05, -4.6);
  const doorPivot = new THREE.Group(); doorPivot.position.set(dx0, 0, -4.52); W.group.add(doorPivot);
  const doorMat = std('#e7b98a', { roughness: 0.55 });
  box(door.w - 0.02, door.h - 0.02, 0.05, doorMat, door.w / 2, door.h / 2, 0, doorPivot);
  [[0.55, 1.55], [0.55, 0.62]].forEach(([w, y]) => box(w + 0.25, door.h * 0.36, 0.012, std('#dca878', { roughness: 0.6 }), door.w / 2, y, 0.03, doorPivot));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), std('#d4a646', { metalness: 0.9, roughness: 0.25 }));
  knob.position.set(door.w - 0.12, 1.0, 0.06); add(knob, doorPivot);
  W.doorPivot = doorPivot;

  // hallway (behind door)
  const hall = new THREE.Group(); W.group.add(hall);
  const hallMat = std('#7a5a48', { roughness: 0.9 });
  box(3, 0.02, 3, std('#4a3426', { roughness: 0.8 }), door.x, 0, -6.2, hall);
  box(0.05, 3, 3, hallMat, door.x - 1.2, 1.5, -6.2, hall);
  box(0.05, 3, 3, hallMat, door.x + 1.2, 1.5, -6.2, hall);
  box(3, 3, 0.05, hallMat, door.x, 1.5, -7.6, hall);
  box(3, 0.05, 3, hallMat, door.x, 2.9, -6.2, hall);
  const hallBulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffd8a0' }));
  hallBulb.position.set(door.x, 2.65, -6.3); hall.add(hallBulb);
  // little coat hook + coat
  box(0.45, 0.8, 0.12, std('#2f6f73'), door.x - 0.6, 1.5, -7.5, hall, 0.05);

  const hallLight = new THREE.SpotLight('#ffc98a', 0, 16, 0.62, 0.55, 1.4);
  hallLight.position.set(door.x + 0.25, 2.5, -7.0);
  hallLight.target.position.set(door.x + 0.6, 0, -1.5);
  hallLight.castShadow = true; hallLight.shadow.mapSize.set(1024, 1024); hallLight.shadow.bias = -0.0004; hallLight.shadow.normalBias = 0.02;
  hallLight.shadow.camera.near = 0.5; hallLight.shadow.camera.far = 16;
  W.group.add(hallLight, hallLight.target);
  const hallFill = new THREE.PointLight('#ffb070', 0, 4, 2); hallFill.position.set(door.x, 2.3, -6.4); hall.add(hallFill);
  W.hallLight = hallLight; W.hallFill = hallFill; W.hallBulb = hallBulb;

  /* ---------------- window, city, rain, curtains ---------------- */
  const wx0 = win.x - win.w / 2, wx1 = win.x + win.w / 2, wy0 = win.y - win.h / 2, wy1 = win.y + win.h / 2;
  const frameMat = std('#f3e2c7', { roughness: 0.45 });
  box(win.w + 0.2, 0.08, 0.3, frameMat, win.x, wy0 - 0.02, -4.5); // sill
  box(win.w + 0.36, 0.05, 0.38, frameMat, win.x, wy0 - 0.08, -4.38);
  box(win.w + 0.2, 0.08, 0.24, frameMat, win.x, wy1 + 0.04, -4.6);
  box(0.08, win.h + 0.12, 0.24, frameMat, wx0 - 0.04, win.y, -4.6);
  box(0.08, win.h + 0.12, 0.24, frameMat, wx1 + 0.04, win.y, -4.6);
  box(0.05, win.h, 0.08, frameMat, win.x, win.y, -4.62);
  box(win.w, 0.05, 0.08, frameMat, win.x, win.y + 0.12, -4.62);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.h), new THREE.MeshPhysicalMaterial({
    color: '#bcd0ff', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0, depthWrite: false,
  }));
  glass.position.set(win.x, win.y, -4.62); W.group.add(glass);
  W.glass = glass; // REANIMATED Part 2: hover target for the window
  const cityTex = TX.city();
  const cityMat = new THREE.MeshBasicMaterial({ map: cityTex, toneMapped: true, color: new THREE.Color(0.85, 0.85, 0.95) });
  const cityPlane = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), cityMat);
  cityPlane.position.set(win.x, 2.0, -11); cityPlane.visible = false; W.group.add(cityPlane);
  W.cityMat = cityMat;

  // rain streaks outside
  const RN = 520;
  const rainPos = new Float32Array(RN * 6);
  const rainSeed = [];
  for (let i = 0; i < RN; i++) rainSeed.push({ x: win.x + (R() - 0.5) * 5.5, y: R() * 5, z: -5 - R() * 4, v: 7 + R() * 5, l: 0.12 + R() * 0.2 });
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#b9c8ff', transparent: true, opacity: 0.35, depthWrite: false }));
  rain.frustumCulled = false; W.group.add(rain);

  // window droplets (sprites sliding on the glass)
  const dotTex = TX.softDot();
  const DN = 60;
  const dropPos = new Float32Array(DN * 3);
  const drops = [];
  for (let i = 0; i < DN; i++) drops.push({ x: wx0 + R() * win.w, y: wy0 + R() * win.h, v: 0, wait: R() * 6 });
  const dropGeo = new THREE.BufferGeometry(); dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
  const dropPts = new THREE.Points(dropGeo, new THREE.PointsMaterial({ size: 0.035, map: dotTex, color: '#dfe8ff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  dropPts.frustumCulled = false; W.group.add(dropPts);

  // curtains (vertex-animated cloth)
  const curtainMat = std('#b8465f', { roughness: 0.95, side: THREE.DoubleSide, map: TX.fabric('#b8465f') });
  const curtains = [];
  [wx0 - 0.35, wx1 + 0.35].forEach((cx, k) => {
    const g = new THREE.PlaneGeometry(0.75, 2.6, 24, 30);
    g.userData.base = g.attributes.position.array.slice();
    const m = new THREE.Mesh(g, curtainMat); m.position.set(cx, win.y - 0.05, -4.36);
    add(m, W.group, true, true); curtains.push({ m, k, x0: cx });
  });
  W.curtains = curtains.map((c) => c.m); // REANIMATED Part 2
  cyl(0.02, 0.02, win.w + 2.1, std('#c79b52', { metalness: 0.8, roughness: 0.3 }), win.x, win.y + 1.27, -4.34).rotation.z = Math.PI / 2;

  // moonlight through window — soft area light
  const moonRect = new THREE.RectAreaLight('#8aa2ff', 2.5, win.w, win.h);
  moonRect.position.set(win.x, win.y, -4.55); moonRect.lookAt(win.x, 0.4, 0.5);
  W.group.add(moonRect); W.moonRect = moonRect;
  const moonDir = new THREE.DirectionalLight('#7d8fd8', 0.35);
  moonDir.position.set(3, 6, 6); W.group.add(moonDir); W.moonDir = moonDir;

  /* ---------------- couch ---------------- */
  const C = LAYOUT.couch;
  const couch = new THREE.Group(); couch.position.set(C.x, 0, C.z); W.group.add(couch);
  const couchTex = TX.fabric('#5a7bd6');
  const couchMat = std('#ffffff', { map: couchTex, roughness: 0.96 });
  const couchDark = std('#3e5cb0', { roughness: 0.96, map: couchTex });
  box(C.w, 0.24, 0.95, couchDark, 0, 0.2, 0, couch, 0.06);
  box(C.w, 0.62, 0.26, couchMat, 0, 0.58, -0.36, couch, 0.1);
  box(0.26, 0.42, 0.98, couchMat, -C.w / 2 + 0.05, 0.42, 0.01, couch, 0.1);
  box(0.26, 0.42, 0.98, couchMat, C.w / 2 - 0.05, 0.42, 0.01, couch, 0.1);
  const seatCushions = [];
  [-0.56, 0.56].forEach((sx) => {
    const c = box(1.08, 0.17, 0.78, couchMat, sx, 0.395, 0.06, couch, 0.07);
    c.userData.baseY = 0.395; seatCushions.push(c);
  });
  const backCushions = [];
  [-0.56, 0.56].forEach((sx, i) => {
    const c = box(1.02, 0.5, 0.2, couchMat, sx, 0.73, -0.2, couch, 0.09);
    c.rotation.x = -0.12; backCushions.push(c);
  });
  // throw pillow + blanket
  const pillow = box(0.42, 0.38, 0.14, std('#ffc56b', { roughness: 1 }), 0.78, 0.66, -0.1, couch, 0.07);
  pillow.rotation.set(-0.3, -0.3, -0.15);
  const blanket = box(0.6, 0.06, 0.9, std('#f2e3c6', { roughness: 1, map: TX.fabric('#f2e3c6') }), C.w / 2 - 0.12, 0.66, 0.03, couch, 0.03);
  blanket.rotation.z = -0.1;
  // legs
  [[-1.25, 0.36], [1.25, 0.36], [-1.25, -0.36], [1.25, -0.36]].forEach(([lx, lz]) => cyl(0.03, 0.02, 0.1, std('#c79b52', { metalness: 0.6, roughness: 0.4 }), lx, 0.05, lz, couch, 12));
  W.couch = couch; W.seatCushions = seatCushions;

  /* ---------------- side table + lamp + headphones spot ---------------- */
  const ST = LAYOUT.sideTable;
  const woodMat = std('#9a6a43', { roughness: 0.55 });
  cyl(0.3, 0.3, 0.04, woodMat, ST.x, ST.top - 0.02, ST.z);
  cyl(0.03, 0.03, ST.top - 0.04, woodMat, ST.x, (ST.top - 0.04) / 2, ST.z, W.group, 12);
  cyl(0.18, 0.2, 0.03, woodMat, ST.x, 0.015, ST.z);
  // tiny table lamp
  cyl(0.06, 0.08, 0.03, std('#f2e3c6'), ST.x - 0.15, ST.top + 0.015, ST.z - 0.1);
  cyl(0.012, 0.012, 0.26, std('#c79b52', { metalness: 0.8, roughness: 0.3 }), ST.x - 0.15, ST.top + 0.15, ST.z - 0.1, W.group, 8);
  const tShadeMat = new THREE.MeshStandardMaterial({ color: '#ffe0b0', emissive: '#ffb45c', emissiveIntensity: 0, roughness: 0.9, side: THREE.DoubleSide });
  const tShade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.14, 24, 1, true), tShadeMat);
  tShade.position.set(ST.x - 0.15, ST.top + 0.3, ST.z - 0.1); add(tShade, W.group, false, false);
  const tableLight = new THREE.PointLight('#ffb466', 0, 4, 2); tableLight.position.set(ST.x - 0.15, ST.top + 0.28, ST.z - 0.1); W.group.add(tableLight);
  W.headphoneRest = new THREE.Vector3(ST.x + 0.04, ST.top + 0.058, ST.z + 0.14);
  W.tShade = tShade; W.tableLight = tableLight; // REANIMATED Part 2

  /* ---------------- floor lamp ---------------- */
  const fl = new THREE.Group(); fl.position.set(3.2, 0, -3.95); W.group.add(fl);
  cyl(0.2, 0.22, 0.03, std('#1a1424', { metalness: 0.5, roughness: 0.4 }), 0, 0.015, 0, fl);
  cyl(0.015, 0.015, 1.55, std('#c79b52', { metalness: 0.8, roughness: 0.3 }), 0, 0.78, 0, fl, 8);
  const flShadeMat = new THREE.MeshStandardMaterial({ color: '#ffe0b0', emissive: '#ffa64a', emissiveIntensity: 0, roughness: 0.9, side: THREE.DoubleSide });
  const flShade = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.27, 0.32, 32, 1, true), flShadeMat);
  flShade.position.y = 1.62; add(flShade, fl, true, false);
  const floorLight = new THREE.PointLight('#ffa95a', 0, 7, 2); floorLight.position.set(0, 1.55, 0.05); fl.add(floorLight);
  W.floorLamp = fl; // REANIMATED Part 2

  /* ---------------- pendant (key light, casts shadows) ---------------- */
  const pend = new THREE.Group(); pend.position.set(0.9, 4.2, -1.9); W.group.add(pend);
  cyl(0.006, 0.006, 1.1, std('#111'), 0, -0.55, 0, pend, 6);
  const pShadeMat = new THREE.MeshStandardMaterial({ color: '#2f6f73', roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide });
  const pShade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.26, 32, 1, true), pShadeMat);
  pShade.position.y = -1.2; add(pShade, pend, false, false);
  const pBulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffe6c0' }));
  pBulb.position.y = -1.32; pend.add(pBulb);
  const keyLight = new THREE.SpotLight('#ffc78f', 0, 12, 0.95, 0.7, 1.5);
  keyLight.position.set(0.9, 2.85, -1.9); keyLight.target.position.set(1.0, 0, -2.4);
  keyLight.castShadow = true; keyLight.shadow.mapSize.set(2048, 2048); keyLight.shadow.bias = -0.0003; keyLight.shadow.normalBias = 0.02;
  keyLight.shadow.camera.near = 0.3; keyLight.shadow.camera.far = 8; keyLight.shadow.radius = 4;
  W.group.add(keyLight, keyLight.target);
  W.pendant = pend; W.pBulb = pBulb; W.keyLight = keyLight;

  /* ---------------- neon sign ---------------- */
  const neonTex = TX.neon('Vibes', '#ff4f7b');
  const neonMat = new THREE.MeshBasicMaterial({ map: neonTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0, 0, 0) });
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.86), neonMat);
  neon.position.set(-2.1, 2.6, -4.47); W.group.add(neon);
  // REANIMATED Part 2: the sign cycles its word when poked (nook → open → play)
  const neonWords = [neonTex, TX.neon('open', '#ff4f7b'), TX.neon('play', '#ff4f7b')];
  W.neon = neon;
  const neonLight = new THREE.PointLight('#ff4f7b', 0, 6, 2); neonLight.position.set(-2.1, 2.5, -3.9); W.group.add(neonLight);
  const neonWash = new THREE.RectAreaLight('#ff4f7b', 0, 2.2, 0.9);
  neonWash.position.set(-2.1, 2.6, -4.4); neonWash.lookAt(-2.1, 1.2, 1); W.group.add(neonWash);
  // mounting plate
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.0), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.05, roughness: 0.1 }));
  plate.position.set(-2.1, 2.6, -4.485); W.group.add(plate);
  W.neonPlate = plate;

  // light switch by the door (he flips it on the way in)
  const swPlate = box(0.09, 0.13, 0.015, std('#f3e2c7', { roughness: 0.4 }), door.x + door.w / 2 + 0.38, 1.22, -4.45);
  const swToggle = box(0.022, 0.04, 0.02, std('#e8d6b8', { roughness: 0.4 }), door.x + door.w / 2 + 0.38, 1.22, -4.44);
  W.switchPos = new THREE.Vector3(door.x + door.w / 2 + 0.38, 1.22, -4.42);
  W.swToggle = swToggle;

  /* ---------------- string lights ---------------- */
  const bulbCols = ['#ffd27a', '#ff9db5', '#9fe3ff', '#ffb35c', '#c6a2ff'];
  const bulbs = [];
  const pts = [];
  const anchors = [-6.6, -3.4, 0, 3.4, 6.6];
  for (let a = 0; a < anchors.length - 1; a++) {
    for (let s = 0; s <= 20; s++) {
      const u = s / 20, x = lerp(anchors[a], anchors[a + 1], u);
      pts.push(new THREE.Vector3(x, 3.85 - Math.sin(u * Math.PI) * 0.38, -4.42));
    }
  }
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.006, 4), std('#1a1424'));
  W.group.add(wire);
  const bulbGeo = new THREE.SphereGeometry(0.045, 12, 10);
  for (let i = 0; i < 36; i++) {
    const p = pts[Math.round((i / 35) * (pts.length - 1))];
    const col = new THREE.Color(bulbCols[i % 5]);
    const m = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.12) }));
    m.position.set(p.x, p.y - 0.06, p.z + 0.02); m.scale.y = 1.3; W.group.add(m);
    bulbs.push({ m, col, ph: R() * 6.28, sp: 0.8 + R() * 1.6, order: (p.x + 7) / 14 });
  }
  const stringLight = new THREE.PointLight('#ffcf9a', 0, 6, 2); stringLight.position.set(0, 3.3, -3.9); W.group.add(stringLight);

  /* ---------------- coffee table + mug + steam ---------------- */
  const CT = LAYOUT.coffee;
  const ct = new THREE.Group(); ct.position.set(CT.x, 0, CT.z); W.group.add(ct);
  box(1.2, 0.05, 0.62, woodMat, 0, 0.42, 0, ct, 0.02);
  box(1.1, 0.03, 0.52, woodMat, 0, 0.14, 0, ct, 0.01);
  [[-0.54, -0.25], [0.54, -0.25], [-0.54, 0.25], [0.54, 0.25]].forEach(([x, z]) => cyl(0.02, 0.018, 0.42, std('#5e3e26'), x, 0.21, z, ct, 10));
  const mug = new THREE.Group(); mug.position.set(0.28, 0.445, 0.05); ct.add(mug);
  W.mug = mug; // REANIMATED Part 2
  cyl(0.045, 0.04, 0.1, std('#ff7a95', { roughness: 0.35 }), 0, 0.05, 0, mug, 20);
  cyl(0.04, 0.04, 0.005, std('#3a2216', { roughness: 0.2 }), 0, 0.095, 0, mug, 20);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.008, 8, 16), std('#ff7a95', { roughness: 0.35 }));
  handle.position.set(0.05, 0.05, 0); add(handle, mug);
  // books stack + record sleeve
  box(0.32, 0.04, 0.22, std('#2f6f73'), -0.32, 0.465, -0.02, ct, 0.005).rotation.y = 0.2;
  box(0.28, 0.035, 0.2, std('#e8c79a'), -0.31, 0.5, -0.03, ct, 0.005).rotation.y = -0.1;
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.006, 0.31), new THREE.MeshStandardMaterial({ map: TX.cover(2), roughness: 0.6 }));
  sleeve.position.set(0.02, 0.448, -0.05); sleeve.rotation.y = 0.5; add(sleeve, ct);
  const steam = [];
  const steamMat = new THREE.SpriteMaterial({ map: dotTex, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(steamMat.clone()); s.scale.setScalar(0.08); W.group.add(s);
    steam.push({ s, ph: i / 7 });
  }
  W.mugWorld = new THREE.Vector3(CT.x + 0.28, 0.55, CT.z + 0.05);

  // rug
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.75, 64), std('#ffffff', { map: TX.rug(), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(CT.x, 0.006, CT.z - 0.15); rug.scale.y = 0.72;
  add(rug, W.group, false, true);

  /* ---------------- turntable cabinet + speakers ---------------- */
  const TT = LAYOUT.turntable;
  const cab = new THREE.Group(); cab.position.set(TT.x, 0, TT.z); W.group.add(cab);
  W.catalogCabinet = buildCatalogCabinet(cab);
  const tt = new THREE.Group(); tt.position.set(0.25, 1.5, 0); cab.add(tt);
  box(0.5, 0.08, 0.4, std('#2a1f33', { roughness: 0.4, metalness: 0.2 }), 0, 0.04, 0, tt, 0.015);
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 48), new THREE.MeshStandardMaterial({ map: TX.record(), roughness: 0.35, metalness: 0.1 }));
  platter.position.set(-0.05, 0.088, 0); add(platter, tt);
  // fix record texture orientation on cap
  platter.material.map.center.set(0.5, 0.5);
  const armPivot = new THREE.Group(); armPivot.position.set(0.18, 0.1, -0.13); tt.add(armPivot);
  cyl(0.02, 0.02, 0.03, std('#c0c0c8', { metalness: 0.9, roughness: 0.25 }), 0, 0, 0, armPivot, 12);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.26, 8), std('#d8d8e0', { metalness: 0.9, roughness: 0.2 }));
  arm.rotation.x = Math.PI / 2; arm.position.set(0, 0.012, 0.13); add(arm, armPivot);
  box(0.02, 0.015, 0.035, std('#111'), 0, 0.01, 0.26, armPivot);
  armPivot.rotation.y = 0.5;
  W.platter = platter; W.tonearm = armPivot; W.turntable = tt;
  // speakers
  const speakers = [], spGroups = [];
  [-0.62, 0.78].forEach((x) => {
    const sp = new THREE.Group(); sp.position.set(x, 1.5, 0.02); cab.add(sp);
    box(0.26, 0.4, 0.26, std('#3a2a20', { roughness: 0.5 }), 0, 0.2, 0, sp, 0.02);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.02, 24), std('#15111c', { roughness: 0.6 }));
    cone.rotation.x = Math.PI / 2; cone.position.set(0, 0.16, 0.135); add(cone, sp);
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), std('#c79b52', { metalness: 0.7, roughness: 0.3 }));
    tw.rotation.x = Math.PI / 2; tw.position.set(0, 0.32, 0.135); add(tw, sp);
    speakers.push(cone); spGroups.push(sp);
  });
  W.speakers = speakers; W.speakerBoxes = spGroups;

  /* ---------------- posters ---------------- */
  const frameMat2 = std('#1b1424', { roughness: 0.4 });
  // REANIMATED Part 2: each poster hangs from a nail (pivot at the top) so it can swing when poked
  W.posters = [];
  [[4.35, 2.3, 0, 0.62], [5.4, 2.05, 1, 0.5], [-0.55, 2.0, 2, 0.46]].forEach(([x, y, k, s]) => {
    const w = s, h = s * 1.37;
    const pv = new THREE.Group(); pv.position.set(x, y + h / 2 + 0.03, -4.47); W.group.add(pv);
    box(w + 0.06, h + 0.06, 0.03, frameMat2, 0, -h / 2 - 0.03, 0, pv);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std('#ffffff', { map: TX.poster(k), roughness: 0.5 }));
    p.position.set(0, -h / 2 - 0.03, 0.017); add(p, pv, false, true);
    W.posters.push(pv);
  });

  /* ---------------- bookshelf (right wall) ---------------- */
  const shelf = new THREE.Group(); shelf.position.set(6.75, 0, -2.4); shelf.rotation.y = -Math.PI / 2; W.group.add(shelf);
  W.shelf = shelf; W.books = []; // REANIMATED Part 2
  const shelfMat = std('#7a5236', { roughness: 0.6 });
  box(1.3, 2.3, 0.04, shelfMat, 0, 1.15, -0.17, shelf);
  box(0.04, 2.3, 0.38, shelfMat, -0.63, 1.15, 0, shelf);
  box(0.04, 2.3, 0.38, shelfMat, 0.63, 1.15, 0, shelf);
  const bookCols = ['#e0a030', '#c4562b', '#2e6f73', '#8e3127', '#f3d9b8', '#6a4c93', '#3f8a5a', '#ff7a9a'];
  for (let s = 0; s < 5; s++) {
    const y = 0.05 + s * 0.55;
    box(1.26, 0.03, 0.36, shelfMat, 0, y, 0, shelf);
    let x = -0.58;
    while (x < 0.5 && s < 4) {
      const w = 0.03 + R() * 0.04, h = 0.26 + R() * 0.18;
      const b = box(w, h, 0.24 + R() * 0.06, std(bookCols[(R() * 8) | 0], { roughness: 0.7 }), x + w / 2, y + 0.015 + h / 2, 0.02, shelf);
      if (R() < 0.08) { b.rotation.z = -0.25; x += 0.06; } else W.books.push(b);
      x += w + 0.004;
      if (R() < 0.05) x += 0.12;
    }
  }

  /* ---------------- plants ---------------- */
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0); leafShape.bezierCurveTo(0.12, 0.08, 0.12, 0.3, 0, 0.42); leafShape.bezierCurveTo(-0.12, 0.3, -0.12, 0.08, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 8);
  const leafMat = std('#3f8a5a', { roughness: 0.6, side: THREE.DoubleSide });
  const leafMat2 = std('#2f6f4a', { roughness: 0.6, side: THREE.DoubleSide });
  const leaves = [];
  W.plants = [];
  const plant = (x, z, scale, n, potCol) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); W.group.add(g);
    W.plants.push(g); g.userData.leafStart = leaves.length;
    cyl(0.22, 0.16, 0.4, std(potCol, { roughness: 0.5 }), 0, 0.2, 0, g, 24);
    cyl(0.2, 0.2, 0.02, std('#3a2216'), 0, 0.39, 0, g, 24);
    for (let i = 0; i < n; i++) {
      const stem = new THREE.Group(); stem.position.y = 0.38;
      const a = (i / n) * Math.PI * 2 + R();
      stem.rotation.set(0.35 + R() * 0.6, a, 0, 'YXZ');
      const l = new THREE.Mesh(leafGeo, i % 2 ? leafMat : leafMat2);
      l.position.y = 0.25 + R() * 0.5; l.scale.setScalar(0.9 + R() * 0.8); l.rotation.x = -0.4;
      const st = cyl(0.006, 0.008, l.position.y, std('#2c5a3a'), 0, l.position.y / 2, 0, stem, 6);
      add(l, stem); g.add(stem);
      leaves.push({ stem, base: stem.rotation.x, ph: R() * 6.28, plant: W.plants.length - 1 });
    }
    return g;
  };
  plant(-6.3, -3.9, 1.35, 14, '#e8c79a');
  plant(6.2, -4.0, 1.0, 10, '#ff7a95');
  // succulent on window sill
  plant(win.x + 1.0, -4.42, 0.35, 8, '#5fd4cf').position.y = win.y - win.h / 2 - 0.05;
  // candle on sill
  cyl(0.035, 0.035, 0.1, std('#f2e3c6'), win.x - 0.9, win.y - win.h / 2 + 0.0, -4.42, W.group, 16);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd28a' }));
  flame.scale.y = 1.8; flame.position.set(win.x - 0.9, win.y - win.h / 2 + 0.08, -4.42); W.group.add(flame);
  const candleLight = new THREE.PointLight('#ff9c4a', 0, 2.5, 2); candleLight.position.copy(flame.position).add(new THREE.Vector3(0, 0.05, 0.1)); W.group.add(candleLight);

  /* ---------------- cat (curled on couch arm) ---------------- */
  const cat = new THREE.Group(); cat.position.set(C.x + C.w / 2 - 0.06, 0.67, C.z + 0.08); cat.rotation.y = -0.6; W.group.add(cat);
  const catMat = std('#f0a35e', { roughness: 0.95 });
  const catBody = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), catMat); catBody.scale.set(1.25, 0.6, 0.9); catBody.position.y = 0.07; add(catBody, cat);
  const catHead = new THREE.Group(); catHead.position.set(0.17, 0.1, 0.07); cat.add(catHead);
  const ch = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14), catMat); ch.scale.set(1, 0.9, 1); add(ch, catHead);
  const earGeo = new THREE.ConeGeometry(0.03, 0.06, 4);
  const ears = [];
  [-0.04, 0.04].forEach((ez) => { const e = new THREE.Mesh(earGeo, catMat); e.position.set(0.0, 0.075, ez); e.rotation.x = ez * 4; add(e, catHead); ears.push(e); });
  [-0.03, 0.03].forEach((ez) => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.003, 0.022), std('#2a1a14')); e.position.set(0.078, 0.01, ez); e.rotation.y = Math.PI / 2; catHead.add(e); });
  const tail = new THREE.Group(); tail.position.set(-0.18, 0.05, 0); cat.add(tail);
  const tailSegs = [];
  let parent = tail;
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Group(); s.position.set(i ? -0.05 : 0, 0, 0); parent.add(s);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.028 - i * 0.002, 10, 8), catMat); m.scale.set(1.6, 1, 1); m.position.x = -0.025; add(m, s);
    tailSegs.push(s); parent = s;
  }
  W.cat = { cat, head: catHead, ears, tailSegs, body: catBody };

  /* ---------------- dust motes ---------------- */
  const MN = 240;
  const mPos = new Float32Array(MN * 3); const motes = [];
  for (let i = 0; i < MN; i++) motes.push({ x: -3 + R() * 8, y: 0.2 + R() * 3.4, z: -4.2 + R() * 4.5, ph: R() * 6.28, s: 0.2 + R() * 0.6 });
  const mGeo = new THREE.BufferGeometry(); mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  const moteMat = new THREE.PointsMaterial({ size: 0.022, map: dotTex, color: '#ffd9a8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const motePts = new THREE.Points(mGeo, moteMat); motePts.frustumCulled = false; W.group.add(motePts);
  W.motePts = motePts; // REANIMATED Part 3: replaced by the GPU dust in atmos.js

  /* ---------------- ambient + extra ---------------- */
  const hemi = new THREE.HemisphereLight('#8d78c9', '#2a1830', 0.25); W.group.add(hemi);

  /* ---------------- REANIMATED Part 2: reactions ----------------
     W.react(id) starts a short procedural reaction; W.hover[id] (0..1)
     is written by interact.js. Everything below is additive on top of
     the base animation so nothing that already works changes. */
  // id → seconds since trigger. Idle = a big FINITE number: with Infinity, `0 * Math.sin(Infinity)`
  // is NaN → the cat's head got a NaN matrix → NaN pixels → the bloom blur smeared them over the
  // whole frame (the "black screen in the room" bug on real GPUs).
  const FX = {}, IDLE = 1e4;
  const IDS = ['cat', 'neon', 'turntable', 'pendant', 'curtains', 'bookshelf', 'mug', 'window', 'speakers', 'door', 'plantL', 'plantR', 'floorLamp', 'tableLamp', 'posterA', 'posterB', 'posterC'];
  IDS.forEach((k) => { FX[k] = IDLE; });
  W.hover = {};
  // materials the base animation drives directly: interact.js must not clone them
  W.liveMats = new Set([flShadeMat, tShadeMat, neonMat, pBulb.material, cityMat, moteMat]);
  W.neonWords = neonWords;
  let neonWord = 0, curtainOpen = 0, curtainGoal = 0, lampOff = { floorLamp: 0, tableLamp: 0 }, lampState = { floorLamp: 1, tableLamp: 1 };
  let bookSel = null, bookDir = 1;
  const swing = { a: 0, v: 0, b: 0, vb: 0 };
  const posterSw = W.posters.map(() => ({ a: 0, v: 0 }));
  const keyBase = keyLight.position.clone();
  W.react = (id, obj) => {
    if (!(id in FX)) return;
    FX[id] = 0;
    if (id === 'neon') { neonWord = (neonWord + 1) % neonWords.length; }
    if (id === 'pendant') { swing.v += 1.9 * (Math.random() < 0.5 ? -1 : 1); swing.vb += 0.9 * (Math.random() - 0.5); }
    if (id === 'curtains') curtainGoal = curtainGoal > 0.5 ? 0 : 1;
    if (id === 'window') W.strike(1.15);
    if (id === 'bookshelf') { if (bookSel) { bookSel.position.z = bookSel.userData.z0; bookSel.rotation.x = 0; }
      bookSel = obj && W.books.includes(obj) ? obj : W.books[(Math.random() * W.books.length) | 0]; // clicked book, else random
      if (bookSel && bookSel.userData.z0 === undefined) bookSel.userData.z0 = bookSel.position.z; }
    if (id === 'floorLamp' || id === 'tableLamp') lampState[id] = lampState[id] ? 0 : 1;
    if (id.startsWith('poster')) { const i = 'ABC'.indexOf(id.slice(-1)); posterSw[i].v += 2.2 * (Math.random() < 0.5 ? -1 : 1); }
  };
  W.reactState = () => ({ neonWord: ['Vibes', 'open', 'play'][neonWord], curtainOpen, lamps: { ...lampState } });
  const applyFx = (t, dt, L) => {
    for (const k in FX) FX[k] = Math.min(IDLE, FX[k] + dt);
    const h = (k) => W.hover[k] || 0;
    const on = L.lights;
    // cat: wakes (head up + look round), ears perk, tail swishes hard, small stretch
    const fc = FX.cat, cw = fc < 3 ? Math.sin(Math.min(1, fc / 3) * Math.PI) : 0;
    const c = W.cat;
    c.head.rotation.z += cw * 0.45 + h('cat') * 0.08;
    c.head.rotation.y = cw > 0 ? cw * Math.sin(fc * 3.2) * 0.5 : 0;
    c.ears.forEach((e, i) => { e.rotation.y = (cw + h('cat') * 0.5) * (i ? -0.4 : 0.4); });
    c.tailSegs.forEach((s, i) => { s.rotation.y += cw * Math.sin(t * 9 - i * 0.8) * 0.45; });
    c.body.scale.x = 1.25 + cw * 0.12; c.body.scale.y += cw * 0.06;
    // neon: buzzy flicker, swap the word half way through
    const fn = FX.neon;
    const nm = neonWords[neonWord];
    if (fn < 0.35) { neonMat.color.multiplyScalar(Math.sin(t * 90) > 0 ? 0.15 : 1.2); }
    if (fn >= 0.18 && neonMat.map !== nm) { neonMat.map = nm; }
    const nb = 1 + h('neon') * 0.35;
    neonMat.color.multiplyScalar(nb); neonLight.intensity *= nb; neonWash.intensity *= nb;
    // turntable: scratch = platter whips backwards then catches up
    const ft = FX.turntable;
    if (ft < 0.6) platter.rotation.y += dt * (ft < 0.25 ? 16 : -10) * Math.sin(Math.min(1, ft / 0.6) * Math.PI);
    armPivot.position.y = 0.1 + (ft < 0.6 ? Math.sin(ft / 0.6 * Math.PI) * 0.012 : 0);
    // pendant: damped pendulum (two axes), key light follows the shade
    swing.v += (-9.81 / 1.2 * Math.sin(swing.a) - swing.v * 0.55) * dt; swing.a += swing.v * dt;
    swing.vb += (-9.81 / 1.2 * Math.sin(swing.b) - swing.vb * 0.55) * dt; swing.b += swing.vb * dt;
    pend.rotation.z = swing.a * 0.35 + h('pendant') * Math.sin(t * 2) * 0.01; pend.rotation.x = swing.b * 0.35;
    keyLight.position.set(keyBase.x + Math.sin(pend.rotation.z) * -1.3, keyBase.y, keyBase.z + Math.sin(pend.rotation.x) * 1.3);
    // curtains: part / close (gather towards the frame edges)
    curtainOpen += (curtainGoal - curtainOpen) * (1 - Math.exp(-dt * 2.4));
    curtains.forEach(({ m, k, x0 }) => {
      const dir = k ? 1 : -1, peek = h('curtains') * 0.05;
      m.position.x = x0 + dir * (curtainOpen * 0.42 + peek);
      m.scale.x = 1 - curtainOpen * 0.42;
    });
    // bookshelf: a random book slides out, waits, slides home
    if (bookSel) {
      const fb = FX.bookshelf;
      const o = fb < 0.5 ? smooth(fb / 0.5) : fb < 2.6 ? 1 : 1 - smooth(Math.min(1, (fb - 2.6) / 0.6));
      bookSel.position.z = bookSel.userData.z0 + o * 0.14;
      bookSel.rotation.x = o * 0.08;
      if (fb > 3.3) { bookSel.position.z = bookSel.userData.z0; bookSel.rotation.x = 0; bookSel = null; }
    }
    // mug: steam burst + tiny wobble
    const fm = FX.mug, mb = fm < 2.4 ? Math.exp(-fm * 1.2) : 0;
    steam.forEach((p, i) => {
      p.s.material.opacity = Math.min(0.6, p.s.material.opacity * (1 + mb * 3.5 + h('mug') * 0.8));
      p.s.scale.multiplyScalar(1 + mb * 0.9);
      p.s.position.y += mb * 0.25 * ((i % 3) / 3);
    });
    mug.rotation.z = fm < 0.8 ? Math.sin(fm * 28) * 0.08 * (1 - fm / 0.8) : 0;
    // speakers: thump pulse
    const fs = FX.speakers, sk = fs < 0.9 ? Math.exp(-fs * 5) * Math.abs(Math.cos(fs * 22)) : 0;
    speakers.forEach((s) => { s.scale.y += sk * 2.2; });
    spGroups.forEach((g) => { g.scale.setScalar(1 + sk * 0.06 + h('speakers') * 0.02); });
    // door: knock rattle
    const fd = FX.door;
    if (fd < 1) doorPivot.rotation.y += Math.sin(fd * 40) * 0.025 * (1 - fd);
    // plants: rustle
    leaves.forEach((l) => {
      const fp = l.plant === 0 ? FX.plantL : FX.plantR;
      const hk = h(l.plant === 0 ? 'plantL' : 'plantR');
      if (fp < 2.2) l.stem.rotation.x += Math.sin(t * 14 + l.ph * 3) * 0.16 * Math.exp(-fp * 1.8);
      l.stem.rotation.x += hk * Math.sin(t * 5 + l.ph) * 0.03;
    });
    // lamps: click off/on (stays as toggled until the next poke)
    ['floorLamp', 'tableLamp'].forEach((k) => {
      lampOff[k] += ((lampState[k] ? 0 : 1) - lampOff[k]) * (1 - Math.exp(-dt * 14));
    });
    const fo = 1 - lampOff.floorLamp, to = 1 - lampOff.tableLamp;
    floorLight.intensity *= fo; flShadeMat.emissiveIntensity *= fo;
    tableLight.intensity *= to; tShadeMat.emissiveIntensity *= to;
    // posters: swing on their nail
    W.posters.forEach((pv, i) => {
      const s = posterSw[i];
      s.v += (-26 * s.a - s.v * 2.2) * dt; s.a += s.v * dt;
      pv.rotation.z = s.a * 0.12 + h(['posterA', 'posterB', 'posterC'][i]) * 0.02;
    });
    // window: hover brightens the city a little
    cityMat.color.multiplyScalar(1 + h('window') * 0.25);
  };

  /* ---------------- per-frame update ---------------- */
  // L = { lights 0..1, music 0..1, beat phase (0..1 per beat), beatPulse 0..1, door 0..1 }
  let lightning = 0, flashK = 0, nextBolt = 7;
  W.onStrike = null;
  W.strike = (k = 1) => { lightning = k; nextBolt = 12 + Math.random() * 12; if (W.onStrike) W.onStrike(k); };
  W.update = (t, dt, L) => {
    const on = L.lights, mus = L.music;
    // door
    doorPivot.rotation.y = -L.door * 1.62;
    swToggle.rotation.x = on > 0.05 ? -0.5 : 0.5;
    hallLight.intensity = 26 * clamp(L.door * 1.6, 0, 1) * (1 - on * 0.35);
    hallFill.intensity = 3;
    // flicker helper
    const fl1 = 1 + noise1(t * 9) * 0.04;
    // key & practical lights
    keyLight.intensity = 22 * on * fl1;
    pBulb.material.color.setRGB(0.25 + on * 0.75, 0.2 + on * 0.7, 0.16 + on * 0.6);
    floorLight.intensity = 6 * on;
    flShadeMat.emissiveIntensity = 1.6 * on;
    tableLight.intensity = 2.2 * on;
    tShadeMat.emissiveIntensity = 1.5 * on;
    hemi.intensity = 0.18 + on * 0.32;
    moonRect.intensity = 4.2 - on * 1.6 + flashK * 30;
    moonDir.intensity = 0.25 + flashK * 2.5;
    cityMat.color.setScalar(0.78 + flashK * 0.6);
    // neon sign: power-on flicker then steady breathing (+beat)
    const n = L.neon;
    let nf = n;
    if (n > 0 && n < 1) nf = n * (Math.sin(t * 60) > 0.2 - n ? 1 : 0.15);
    const npulse = 1 + mus * L.beatPulse * 0.18 + Math.sin(t * 1.3) * 0.04;
    const ni = nf * npulse;
    neonMat.color.setScalar(clamp(ni, 0, 1.4));
    neonLight.intensity = 5 * ni;
    neonWash.intensity = 6 * ni;
    // string lights cascade by x position
    let lit = 0;
    bulbs.forEach((b) => {
      const k = smooth(seg(L.string, b.order * 0.7, b.order * 0.7 + 0.3));
      const tw = 0.82 + 0.18 * Math.sin(t * b.sp + b.ph) + mus * L.beatPulse * 0.25;
      b.m.material.color.copy(b.col).multiplyScalar(0.1 + k * 1.6 * tw);
      lit += k;
    });
    stringLight.intensity = 2.4 * (lit / bulbs.length);
    // candle
    const cf = 0.75 + noise1(t * 7) * 0.2 + noise1(t * 23) * 0.08;
    candleLight.intensity = (0.6 + on * 0.5) * cf; flame.scale.set(1, 1.8 * cf, 1);
    // lightning
    nextBolt -= dt;
    if (nextBolt < 0) { W.strike(1); }
    lightning = Math.max(0, lightning - dt * (lightning > 0.6 ? 6 : 2.5));
    // flicker is derived (not fed back) so the strobe is frame-rate independent
    const flick = 0.75 + 0.25 * Math.sin(t * 38);
    flashK = lightning > 0.3 ? lightning * flick : lightning;
    // rain
    for (let i = 0; i < RN; i++) {
      const d = rainSeed[i];
      d.y -= d.v * dt; if (d.y < -0.5) d.y += 5.5;
      const o = i * 6;
      rainPos[o] = d.x; rainPos[o + 1] = d.y; rainPos[o + 2] = d.z;
      rainPos[o + 3] = d.x - 0.02; rainPos[o + 4] = d.y + d.l; rainPos[o + 5] = d.z;
    }
    rainGeo.attributes.position.needsUpdate = true;
    // window droplets
    for (let i = 0; i < DN; i++) {
      const d = drops[i];
      d.wait -= dt;
      if (d.wait < 0) { d.v = Math.min(d.v + dt * 0.6, 0.5); d.y -= d.v * dt; d.x += Math.sin(t * 3 + i) * 0.0008; }
      if (d.wait < -1.2 - (i % 3)) { d.v = 0; d.wait = 1 + Math.random() * 5; }
      if (d.y < wy0) { d.y = wy1 - Math.random() * 0.3; d.x = wx0 + Math.random() * win.w; d.v = 0; }
      dropPos[i * 3] = d.x; dropPos[i * 3 + 1] = d.y; dropPos[i * 3 + 2] = -4.6;
    }
    dropGeo.attributes.position.needsUpdate = true;
    // curtains sway
    curtains.forEach(({ m, k }) => {
      const pos = m.geometry.attributes.position, base = m.geometry.userData.base;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        const fold = Math.sin(x * 26 + k) * 0.035;
        const sway = Math.sin(t * 0.9 + y * 1.6 + k * 2) * 0.02 * (1.3 - y / 1.3 - 0.3) + noise1(t * 0.5 + x * 3) * 0.01;
        pos.setZ(i, fold + sway);
      }
      pos.needsUpdate = true; m.geometry.computeVertexNormals();
    });
    // plants sway
    leaves.forEach((l) => { l.stem.rotation.x = l.base + Math.sin(t * 0.8 + l.ph) * 0.035 + noise1(t * 0.4 + l.ph) * 0.03; });
    // steam
    steam.forEach((p) => {
      const u = (t * 0.22 + p.ph) % 1;
      p.s.position.set(W.mugWorld.x + Math.sin(u * 7 + p.ph * 9) * 0.03 * (1 + u * 2), W.mugWorld.y + u * 0.5, W.mugWorld.z);
      p.s.material.opacity = Math.sin(u * Math.PI) * 0.16 * (0.4 + on * 0.6);
      p.s.scale.setScalar(0.05 + u * 0.16);
    });
    // dust motes (visible when lights on)
    for (let i = 0; i < MN; i++) {
      const m = motes[i];
      mPos[i * 3] = m.x + Math.sin(t * 0.13 * m.s + m.ph) * 0.4;
      mPos[i * 3 + 1] = m.y + Math.sin(t * 0.21 * m.s + m.ph * 2) * 0.25 + ((t * 0.02 * m.s) % 0.4);
      mPos[i * 3 + 2] = m.z + Math.cos(t * 0.17 * m.s + m.ph) * 0.3;
    }
    mGeo.attributes.position.needsUpdate = true;
    moteMat.opacity = 0.55 * on;
    // turntable + speakers
    platter.rotation.y -= dt * 3.5 * mus;
    W.tonearm.rotation.y = lerp(0.5, 0.95, smooth(clamp(L.arm, 0, 1)));
    speakers.forEach((s, i) => { s.scale.set(1, 1 + mus * L.beatPulse * 1.6, 1); });
    // cat breathing / tail / ears
    const c = W.cat;
    c.body.scale.y = 0.6 + Math.sin(t * 1.6) * 0.02;
    c.tailSegs.forEach((s, i) => { s.rotation.y = Math.sin(t * 1.4 - i * 0.6) * 0.18 + (i ? 0.12 : 1.2); s.rotation.z = Math.sin(t * 0.9 - i * 0.5) * 0.08; });
    const twitch = Math.max(0, Math.sin(t * 0.7) - 0.96) * 25;
    c.ears[0].rotation.z = twitch * 0.4;
    c.head.rotation.z = Math.sin(t * 0.3) * 0.05 + mus * L.beatPulse * 0.06;
    applyFx(t, dt, L); // REANIMATED Part 2
  };

  return W;
}
