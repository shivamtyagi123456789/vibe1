/* =========================================================
   nook.fm REANIMATED — PART 3 (first half): LIGHT & AIR
   - volumetric light shafts (S5 god rays): additive, view-angle
     faded, noise-streaked meshes for the moonlight through the
     window, the pendant (follows its swing), floor + table lamps.
     They track the real lights (lamp toggles, lightning flashes).
   - GPU dust (S3/S5): 2k–6k Points animated fully in the vertex
     shader (curl-ish drift, wrap), brighter INSIDE the shafts
     (cone SDF in the shader) and drawn into a swirl around the
     cursor ray.
   - quality tiers: high 6000 / med 3500 / low 2000 dust, low hides
     the shafts. setTier('low') is called by the perf probe.
   - HERO SPOTLIGHT (Part 3, second half): one SpotLight created
     here BEFORE compile (intensity 0 when idle → no recompile) plus
     its own visible shaft + dust slot. spot(target|null, color)
     aims it from above at a world point; it glides between targets.
     Reused by Part 2 focus, Part 4 drawers, Part 5 shelf.
   Created before compile.
   API: createAtmos({ scene, camera, W, tier }) → { update(t, dt, s), setTier(t), tier, spot(v3|null, color) }
   ========================================================= */
import * as THREE from 'three';
import { clamp, rng } from './utils.js';

const NOISE = `
  float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }`;

/* ---------- shaft material ---------- */
function shaftMat(color, { len, facet = 0, streak = 1 }) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uI: { value: 0 }, uTime: { value: 0 }, uLen: { value: len }, uFacet: { value: facet }, uStreak: { value: streak } },
    vertexShader: `
      uniform float uLen; varying float vAlong; varying vec3 vN, vV, vW; varying vec2 vUv;
      void main(){
        vAlong = clamp(-position.y / uLen, 0.0, 1.0); vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vec4 mv = viewMatrix * w;
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uI, uTime, uFacet, uStreak;
      varying float vAlong; varying vec3 vN, vV, vW; varying vec2 vUv;
      ${NOISE}
      void main(){
        float fres = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float edge = uFacet > 0.5 ? sin(fract(vUv.x * 4.0) * 3.14159) : 1.0;
        float len = smoothstep(0.0, 0.08, vAlong) * pow(1.0 - vAlong, 1.4);
        float floorFade = smoothstep(0.0, 0.55, vW.y);
        float n = vn(vec3(vUv.x * 18.0 * uStreak, vAlong * 2.0 - uTime * 0.05, uTime * 0.03));
        float n2 = vn(vW * 1.6 + vec3(0.0, -uTime * 0.12, uTime * 0.05));
        float a = fres * edge * len * floorFade * (0.55 + 0.45 * n) * (0.7 + 0.6 * n2) * uI;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}
function shaft(r0, r1, len, color, opts = {}) {
  const g = new THREE.CylinderGeometry(r0, r1, len, opts.seg || 40, 1, true);
  g.translate(0, -len / 2, 0); // apex at the origin, shaft points down -Y
  if (opts.seg === 4) g.rotateY(Math.PI / 4);
  const m = new THREE.Mesh(g, shaftMat(color, { len, facet: opts.seg === 4 ? 1 : 0, streak: opts.streak || 1 }));
  m.renderOrder = 6; m.frustumCulled = false;
  // sdf radii = what the dust shader treats as "inside the beam" (world units)
  m.userData = { r0, r1, len, base: opts.base || 1, s0: opts.s0 || r0, s1: opts.s1 || r1 };
  return m;
}

export function createAtmos({ scene, camera, W, tier = 'high' }) {
  const group = new THREE.Group(); group.name = 'atmos'; scene.add(group);
  const DOWN = new THREE.Vector3(0, -1, 0);

  /* ---------- shafts ---------- */
  const win = { x: 1.3, y: 2.35, w: 2.6, h: 1.55 };
  const moonD = new THREE.Vector3(0.0, -0.62, 1).normalize();
  const mR = (win.w + win.h) / 4; // average half-width of the window opening
  const moon = shaft(1, 1.38, 5.2, '#8fa6ff', { seg: 4, streak: 0.7, base: 0.5, s0: mR, s1: mR * 1.38 });
  moon.scale.set(win.w / Math.SQRT2, 1, win.h / Math.SQRT2);
  moon.position.set(win.x, win.y, -4.58);
  moon.quaternion.setFromUnitVectors(DOWN, moonD);
  group.add(moon);

  // lamp shafts live in our own group and copy their lamp's world transform each frame
  // (parenting them would inflate the lamps' bounding boxes + get them raycast by interact.js)
  const pend = shaft(0.27, 1.25, 2.95, '#ffc78f', { base: 0.42 });
  pend.userData.follow = W.pendant; pend.userData.off = new THREE.Vector3(0, -1.27, 0); // follows the swing
  const floorL = shaft(0.25, 0.85, 1.55, '#ffa95a', { base: 0.34 });
  floorL.userData.follow = W.floorLamp; floorL.userData.off = new THREE.Vector3(0, 1.47, 0);
  const tableL = shaft(0.11, 0.34, 0.3, '#ffb466', { base: 0.45 });
  tableL.userData.follow = W.tShade; tableL.userData.off = new THREE.Vector3(0, -0.06, 0);
  group.add(pend, floorL, tableL);

  // hero spotlight beam (Part 3): unit-length 2.5 cone, scaled to the real distance each frame
  const SPOT_LEN = 2.5, SPOT_R1 = 0.55;
  const heroShaft = shaft(0.04, SPOT_R1, SPOT_LEN, '#ffe1b8', { base: 0.55, streak: 0.6 });
  group.add(heroShaft);
  const heroLight = new THREE.SpotLight('#ffd7a8', 0, 7, Math.atan(SPOT_R1 / SPOT_LEN) * 1.25, 0.65, 1.4);
  heroLight.castShadow = false;
  group.add(heroLight, heroLight.target);
  const spotS = { goal: null, k: 0, pos: new THREE.Vector3(0.9, 3.6, -1.6), aim: new THREE.Vector3(0.9, 0.6, -2.6), color: new THREE.Color('#ffd7a8'), init: false };

  const shafts = [moon, pend, floorL, tableL, heroShaft];
  shafts.forEach((m) => { m.raycast = () => {}; });
  const floorPL = W.floorLamp.children.find((o) => o.isPointLight);

  /* ---------- GPU dust ---------- */
  const MAX = 6000;
  const R = rng(303);
  const pos = new Float32Array(MAX * 3), seed = new Float32Array(MAX * 4);
  const MIN = new THREE.Vector3(-6.4, 0.08, -4.4), SIZE = new THREE.Vector3(12.8, 3.9, 6.6);
  for (let i = 0; i < MAX; i++) {
    // bias half of the motes toward the beams so the shafts read as "full of air"
    let x = MIN.x + R() * SIZE.x, y = MIN.y + R() * SIZE.y, z = MIN.z + R() * SIZE.z;
    if (i % 2 === 0) { x = -0.8 + R() * 4.6; z = -4.4 + R() * 4.4; }
    pos.set([x, y, z], i * 3);
    seed.set([R(), 0.4 + R() * 0.9, 0.6 + R() * 1.0, R()], i * 4);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  dg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, -1), 20);

  const NC = 5; // moon, pendant, floor lamp, table lamp, hero spot
  const uA = Array.from({ length: NC }, () => new THREE.Vector3());
  const uD = Array.from({ length: NC }, () => new THREE.Vector3(0, -1, 0));
  const uC = Array.from({ length: NC }, () => new THREE.Vector4(1, 0.1, 0.2, 0));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uPx: { value: 400 }, uMin: { value: MIN }, uSize: { value: SIZE },
      uRo: { value: new THREE.Vector3() }, uRd: { value: new THREE.Vector3(0, 0, -1) }, uPull: { value: 0 },
      uBase: { value: 0 }, uA: { value: uA }, uD: { value: uD }, uC: { value: uC },
      uWarm: { value: new THREE.Color('#ffd9a8') }, uCool: { value: new THREE.Color('#b9c8ff') },
    },
    vertexShader: `
      attribute vec4 aSeed;
      uniform float uTime, uPx, uPull, uBase; uniform vec3 uMin, uSize, uRo, uRd;
      uniform vec3 uA[${NC}]; uniform vec3 uD[${NC}]; uniform vec4 uC[${NC}];
      uniform vec3 uWarm, uCool;
      varying vec3 vCol; varying float vB;
      void main(){
        vec3 p = position;
        float t = uTime * aSeed.y, ph = aSeed.x * 6.2831;
        p += vec3(sin(t * 0.13 + ph + p.y * 0.7) + 0.4 * sin(t * 0.31 + p.z * 1.3),
                  0.6 * sin(t * 0.09 + ph * 1.7 + p.x * 0.5),
                  cos(t * 0.11 + ph * 2.3 + p.z * 0.6) + 0.4 * cos(t * 0.27 + p.x * 1.1)) * 0.32;
        p.y += uTime * 0.018 * aSeed.y;
        p = uMin + mod(p - uMin, uSize);
        p += vec3(modelMatrix[3]);
        // cursor ray: pull + swirl
        vec3 c = uRo + uRd * max(0.0, dot(p - uRo, uRd));
        vec3 dv = c - p; float d2 = dot(dv, dv);
        float pull = uPull * exp(-d2 / 0.28);
        p += dv * pull * 0.45 + cross(uRd, dv) * pull * 0.9;
        // light: base ambience + inside-shaft boost (cone SDF)
        float b = uBase; float cool = 0.0;
        for (int i = 0; i < ${NC}; i++) {
          vec3 q = p - uA[i]; float s = dot(q, uD[i]); float L = uC[i].x;
          float k = clamp(s / L, 0.0, 1.0);
          float r = mix(uC[i].y, uC[i].z, k);
          float perp = length(q - uD[i] * s);
          float inside = (1.0 - smoothstep(r * 0.55, r, perp)) * step(0.0, s) * step(s, L) * (1.0 - k * 0.7);
          b += inside * uC[i].w;
          if (i == 0) cool += inside * uC[i].w;
        }
        vB = b;
        vCol = mix(uWarm, uCool, clamp(cool / max(b, 1e-3), 0.0, 1.0));
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        vB *= smoothstep(0.35, 1.1, dist);
        gl_PointSize = clamp(aSeed.z * uPx * 0.012 / dist * (0.8 + 0.6 * min(b, 1.5)), 0.0, 7.0 * uPx / 800.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vCol; varying float vB;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(vCol * a * vB, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(dg, dustMat);
  dust.frustumCulled = false; dust.renderOrder = 7;
  group.add(dust);
  if (W.motePts) W.motePts.visible = false; // the old 240 CPU motes are replaced

  /* ---------- tiers ---------- */
  const COUNTS = { high: 6000, med: 3500, low: 2000 };
  function setTier(t) {
    if (!COUNTS[t]) return;
    tier = t;
    dg.setDrawRange(0, COUNTS[t]);
    shafts.forEach((s) => { s.visible = t !== 'low'; });
    heroShaft.visible = t !== 'low'; // the light itself stays on every tier (cheap: no shadow)
  }

  /* ---------- hero spotlight (Part 3) ---------- */
  const toCam = new THREE.Vector3(), sp = new THREE.Vector3();
  function spot(target, color) {
    if (!target) { spotS.goal = null; return; }
    spotS.goal = target.isVector3 ? target : target.getWorldPosition(new THREE.Vector3());
    if (color) spotS.color.set(color);
  }
  function updateSpot(dt) {
    const g = spotS.goal;
    spotS.k += ((g ? 1 : 0) - spotS.k) * (1 - Math.exp(-dt * (g ? 2.6 : 3.5)));
    if (g) {
      // from above, leaning toward the camera so the beam reads as a stage light
      toCam.copy(camera.position).sub(g); toCam.y = 0;
      if (toCam.lengthSq() < 1e-4) toCam.set(0, 0, 1);
      toCam.normalize();
      sp.copy(g).addScaledVector(toCam, 0.75); sp.y = Math.min(4.05, g.y + 1.85);
      const kk = spotS.init ? 1 - Math.exp(-dt * 4) : 1;
      spotS.pos.lerp(sp, kk); spotS.aim.lerp(g, kk); spotS.init = true;
    } else if (spotS.k < 0.01) spotS.init = false;
    heroLight.position.copy(spotS.pos);
    heroLight.target.position.copy(spotS.aim);
    heroLight.target.updateMatrixWorld();
    heroLight.color.copy(spotS.color);
    const dist = Math.max(0.4, spotS.pos.distanceTo(spotS.aim) * 1.08);
    const s = dist / SPOT_LEN;
    heroShaft.scale.setScalar(s);
    heroShaft.position.copy(spotS.pos);
    sp.copy(spotS.aim).sub(spotS.pos).normalize();
    heroShaft.quaternion.setFromUnitVectors(DOWN, sp);
    heroShaft.material.uniforms.uColor.value.copy(spotS.color);
    heroShaft.userData.scaleK = s;
    return spotS.k;
  }
  setTier(tier);

  /* ---------- per frame ---------- */
  const ndc = new THREE.Vector2(), ray = new THREE.Raycaster();
  const q = new THREE.Quaternion(), wp = new THREE.Vector3(), wd = new THREE.Vector3();
  let pullS = 0, lastMx = 0, lastMy = 0, moveK = 0, fade = 0;
  function update(t, dt, s) {
    const on = s.lights || 0;
    fade += ((s.hidden ? 0 : 1) - fade) * (1 - Math.exp(-dt * 3));
    const lamps = W.reactState ? W.reactState().lamps : { floorLamp: 1, tableLamp: 1 };
    const moonK = clamp(W.moonRect.intensity / 4.2, 0, 4);
    const pendK = clamp(W.keyLight.intensity / 22, 0, 1.3);
    const floorK = floorPL ? clamp(floorPL.intensity / 6, 0, 1.2) : on * lamps.floorLamp;
    const tableK = clamp(W.tableLight.intensity / 2.2, 0, 1.2);
    const heroK = updateSpot(dt);
    heroLight.intensity = 16 * heroK * fade;
    const ks = [moonK * (0.75 - on * 0.25), pendK, floorK, tableK, heroK];
    shafts.forEach((m, i) => {
      const f = m.userData.follow;
      if (f) { m.position.copy(m.userData.off).applyMatrix4(f.matrixWorld); f.getWorldQuaternion(m.quaternion); }
      m.material.uniforms.uI.value = m.userData.base * ks[i] * fade;
      m.material.uniforms.uTime.value = t;
      // feed the dust SDF (world-space apex/axis, follows the pendant swing)
      m.getWorldPosition(wp); m.getWorldQuaternion(q);
      wd.copy(DOWN).applyQuaternion(q);
      uA[i].copy(wp); uD[i].copy(wd);
      const gain = (m.visible ? (i === 0 ? 1.4 : 2.1) : 0.5) * ks[i] * fade;
      const sk = m.userData.scaleK || 1; // hero shaft is uniformly scaled
      uC[i].set(m.userData.len * sk, m.userData.s0 * sk, m.userData.s1 * sk, gain);
    });
    const u = dustMat.uniforms;
    u.uTime.value = t;
    u.uBase.value = (0.05 + on * 0.1) * fade;
    u.uPx.value = innerHeight * Math.min(window.devicePixelRatio || 1, 1.75);
    // cursor ray (only while the pointer actually moves: idle → swirl relaxes)
    const mx = s.mouse ? s.mouse.x : 0, my = s.mouse ? s.mouse.y : 0;
    const mv = Math.hypot(mx - lastMx, my - lastMy); lastMx = mx; lastMy = my;
    moveK = Math.min(1, moveK * Math.exp(-dt * 0.8) + mv * 6);
    ndc.set(mx, -my); ray.setFromCamera(ndc, camera);
    u.uRo.value.copy(ray.ray.origin); u.uRd.value.copy(ray.ray.direction);
    pullS += ((s.interactive ? moveK : 0) - pullS) * (1 - Math.exp(-dt * 3));
    u.uPull.value = pullS;
  }

  return { update, setTier, spot, group, get tier() { return tier; }, get spotK() { return spotS.k; }, shafts, dust, heroLight };
}
