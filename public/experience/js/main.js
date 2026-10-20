/* =========================================================
   nook.fm — Director
   - boot / loader, renderer, post FX (bloom + lens)
   - scripted intro timeline (pure function of time → seekable)
   - character staging: walk, light switch, grab headphones,
     put them on, walk to couch, sit, vibe on the beat
   - cinematic camera (damped shots) → scroll-driven camera
   - audio events, captions, Lenis smooth scroll + GSAP reveals
   ========================================================= */
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createCatalog } from './catalog.js';
import { createShelf } from './shelf.js';
import { createMarker } from './marker.js';
import { createCanal } from './canal.js';
window.gsap = gsap;
window.ScrollTrigger = ScrollTrigger;
window.Lenis = Lenis;
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld, LAYOUT } from './world.js';
import { buildCharacter, buildHeadphones } from './character.js';
import { LofiAudio } from './audio.js';
import { createUI } from './ui.js';
import { createPortals } from './portals.js';
import { createAperture } from './aperture.js'; // REANIMATED Part 1
import { createHUD } from './hud.js';           // REANIMATED Part 1
import { createInteract } from './interact.js'; // REANIMATED Part 2
import { createAtmos } from './atmos.js';       // REANIMATED Part 3
import { createDOF } from './dof.js';           // REANIMATED Part 3 (second half)
import { clamp, lerp, seg, smooth, smoother, easeInOut, damp, noise1, Timeline } from './utils.js';

const PI = Math.PI;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const params = new URLSearchParams(location.search);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FREEZE = params.has('freeze');

/* ---------------- timeline (seconds) ---------------- */
const T = {
  bolt: 0.55,
  doorA: 1.0, doorB: 2.3,
  swReach: 4.95, swOn: 5.35, swBack: 5.5,
  reachA: 8.75, grab: 9.3, placeA: 10.0, plug: 10.7,
  sitA: 14.0, sitB: 14.85,
  reveal: 15.6,
};
const SKIP_TO = T.reveal + 0.8;
const BEAT = 60 / 84;
const SEAT_H = 0.57;
const SEAT_X = 0.75;

const TR = new Timeline({
  x: [[0, -4.2], [1.5, -4.2], [3.3, -4.1], [4.7, -3.45], [5.95, -3.45], [8.6, -1.05], [11.3, -1.05], [12.2, -0.5], [13.3, SEAT_X]],
  z: [[0, -6.5], [1.5, -6.5], [3.3, -4.45], [4.7, -3.98], [5.95, -3.98], [8.6, -3.55], [11.3, -3.55], [12.2, -2.97], [13.3, -3.1], [14.0, -3.1], [14.85, -3.64]],
  yaw: [[0, 0], [1.5, 0], [3.2, 0.06], [4.0, 0.72], [4.6, 0.8], [5.05, 2.75], [5.8, 2.75], [6.25, 1.39], [8.2, 1.45], [8.75, PI / 2], [9.45, PI / 2],
    [10.05, 0.36], [11.2, 0.36], [11.55, 0.78], [12.05, 0.9], [12.55, 1.62], [13.1, 1.62], [13.9, 0]],
  hipDrop: [[0, 0], [8.7, 0], [9.2, 0.1], [9.5, 0.1], [10.0, 0]],
  spineX: [[0, 0], [8.65, 0], [9.15, 0.42], [9.45, 0.42], [9.95, 0.02], [14.0, 0], [14.35, 0.32], [14.85, -0.12], [15.4, -0.2]],
  chestX: [[0, 0], [8.65, 0], [9.15, 0.18], [9.45, 0.18], [9.95, -0.05], [10.6, -0.08], [11.0, 0], [14.0, 0], [14.85, -0.08]],
  sit: [[0, 0], [14.0, 0], [14.85, 1]],
});

/* arc length of the walk path → stride phase (pure function of t) */
const ARC_DT = 1 / 120, ARC_N = Math.ceil(T.sitA / ARC_DT);
const arc = new Float32Array(ARC_N + 1);
{
  let px = TR.get('x', 0), pz = TR.get('z', 0);
  for (let i = 1; i <= ARC_N; i++) {
    const tt = i * ARC_DT, x = TR.get('x', tt), z = TR.get('z', tt);
    arc[i] = arc[i - 1] + Math.hypot(x - px, z - pz); px = x; pz = z;
  }
}
const distAt = (t) => {
  if (t <= 0) return 0;
  if (t >= T.sitA) return arc[ARC_N];
  const f = t / ARC_DT, i = Math.floor(f);
  return lerp(arc[i], arc[Math.min(ARC_N, i + 1)], f - i);
};
const STRIDE = 1.15;
const phaseAt = (t) => (distAt(t) * 2 * PI) / STRIDE + 0.4;
const walkWAt = (t) => (t >= T.sitA - 0.05 ? 0 : smooth(clamp((distAt(t + 0.05) - distAt(t - 0.05)) / 0.1 / 0.7, 0, 1)));

const CAPS = [[0.35, '22:47 — it’s been raining all evening.'], [2.6, 'home, finally.'], [4.75, 'lights.'], [6.6, 'now… where did I leave them?'],
  [9.9, 'plug in.'], [13.3, 'sink in.'], [T.reveal - 0.4, null]];

/* ---------------- globals ---------------- */
const UI = createUI();
UI.progress(0.04);
const audio = new LofiAudio({ bpm: 84, musicStart: T.plug });
const canvas = document.getElementById('gl');
let renderer, scene, camera, composer, bloom, lens, W, C, phones, notes = [], portals = null;
let ready = false, started = false, failed = false;
let aperture = null, hud = null, scrollU = 0; // REANIMATED Part 1
let interact = null, atmos = null, lightsK = 0; // REANIMATED Part 2 + 3
let catalog = null, shelf = null, marker = null, canal = null;
let dof = null; // REANIMATED Part 3: BokehPass, focus/drawer mode only
// Explicit tiers stay fixed; automatic mode prioritizes frame pacing over extra effects.
const autoQuality = !['low', 'med', 'high'].includes(params.get('quality'));
const QUALITY = autoQuality ? 'med' : params.get('quality');
let renderTier = QUALITY;
let tl = 0, prevT = -1, clock = 0, startClock = 0;
let DPR = Math.min(window.devicePixelRatio || 1, QUALITY === 'high' ? 1.5 : 1.25);

function fail(msg) {
  failed = true;
  const p = document.querySelector('.ld-pct');
  if (p) p.textContent = msg;
  document.body.classList.add('no-webgl');
  audio.disable(); UI.setSound(false);
  window.nookFallback?.();
}

try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  fail('WebGL is not available on this device.');
}

// GPU resets (driver hiccups, memory pressure, sleep/wake) are usually recoverable: pause and wait
// for the browser to restore the context; only drop to the static fallback if it never comes back.
let glLost = false, glLostTimer = 0;
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  glLost = true;
  clearTimeout(glLostTimer);
  glLostTimer = setTimeout(() => { if (glLost) fail('The 3D renderer was interrupted.'); }, 5000);
});
canvas.addEventListener('webglcontextrestored', () => {
  glLost = false;
  clearTimeout(glLostTimer);
  if (renderer) renderer.shadowMap.needsUpdate = true;
  resize(true);
});

/* ---------------- boot ---------------- */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function boot() {
  if (failed) return;
  renderer.setPixelRatio(DPR);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = QUALITY !== 'low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0712');
  scene.fog = new THREE.FogExp2('#120b1c', 0.03);
  camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 60);
  camera.position.set(-1, 1.7, 2.4);

  try {
    await Promise.race([
      Promise.all([document.fonts.load('200px Pacifico'), document.fonts.load('italic 600 64px Fraunces'), document.fonts.load('500 20px Inter')]),
      wait(2500),
    ]);
  } catch (e) { /* fonts optional */ }
  UI.progress(0.3); await nextFrame();

  W = buildWorld(scene);
  canal = createCanal({ scene, camera, W, tier: QUALITY, launch: (id, event) => portals?.launch(id, event) });
  window.nookCanal = canal;
  if (QUALITY !== 'high') {
    scene.traverse((object) => {
      if (object.isLight && object.castShadow) {
        object.shadow.mapSize.setScalar(object.isPointLight ? 512 : 1024);
      }
    });
    renderer.shadowMap.autoUpdate = false;
  }
  W.onStrike = (k) => { UI.flash(); audio.sfx('thunder', { delay: 0.45 + Math.random() * 1.1, k }); };
  UI.progress(0.6); await nextFrame();

  C = buildCharacter(); scene.add(C.root);
  phones = buildHeadphones(); phones.scale.set(1.05, 1.25, 1.0); scene.add(phones);
  buildNotes();
  UI.progress(0.78); await nextFrame();

  setupPost();
  // REANIMATED Part 3: light shafts + GPU dust (no new lights → safe before compile)
  atmos = createAtmos({ scene, camera, W, tier: QUALITY });
  // Part 5 materials exist before compile; the shelf reuses the hero light and GPU dust.
  shelf = createShelf({ scene, camera, canvas,
    navigate: y => { if (lenis) lenis.scrollTo(y, { duration: reduceMotion ? 0 : .8 }); else window.scrollTo({ top: y, behavior: reduceMotion ? 'instant' : 'smooth' }); },
    openDrawer: i => { if (!catalog) return; scrollToId('catalog'); catalog.requestOpen(i); },
  });
  window.nookShelf = shelf;
  // REANIMATED Part 2: raycast hover + reactions + hover-zoom / focus dolly.
  // Created before compile because it clones materials (private hover glow).
  interact = createInteract({
    camera, canvas, W, occluders: [C.root, phones], audio, UI,
    onFocus: (on, t) => {
      if (lenis) on ? lenis.stop() : (scrollUnlocked && lenis.start());
      // Part 3: depth of field + hero spotlight follow the focused object (t.center is live)
      if (dof) dof.setTarget(on && t ? t.center : null);
      if (atmos) atmos.spot(on && t ? t.center : null);
    },
  });
  window.nookInteract = interact; window.nookAtmos = atmos;
  tl = params.has('t') ? parseFloat(params.get('t')) || 0 : (reduceMotion || window.NOOK_DEMO ? SKIP_TO : 0);
  // REANIMATED Part 1: aperture prologue (must exist before compile: clipping + plan lights)
  const useAperture = tl === 0 && !params.has('t') && params.get('aperture') !== '0' && !reduceMotion && !window.NOOK_DEMO;
  if (useAperture) {
    aperture = createAperture({
      renderer, scene, camera, audio,
      introShot: { p: [-1.0, 1.7, 2.4], l: [-3.95, 1.3, -4.9], f: 40 },
      onEnter: async () => { if (!audio.enabled) { await audio.enable(tl); UI.setSound(true); } },
      onDone: () => { cam.init = false; prevT = tl; if (audio.enabled) audio.sync(tl); },
    });
  }
  update(tl, 0, true);
  if (aperture) aperture.update(0); // start on the site-plan camera
  // Parallel shader compilation keeps the loader responsive; focus-only passes are deferred.
  await renderer.compileAsync(scene, camera);
  camHeadS.copy(camHead);
  portals = createPortals({ camera, audio, resolve: (name) => (name === 'phones' ? phones : interact.object(name)) });
  window.nookPortals = portals; // debug / demo handle
  hud = createHUD({ chapters: CHAPTERS, goto: (id) => scrollToId(id) });
  interact.hud = hud; // Part 2: pill API (read lazily by interact.js)
  catalog = createCatalog({ cabinet: W.catalogCabinet, camera, canvas, portals, hud, audio,
    goto: scrollToId,
    onFocus(on, center, color) {
      interact.exit();
      if (lenis) on ? lenis.stop() : (scrollUnlocked && lenis.start());
      document.documentElement.classList.toggle('drawer-locked', on);
      dof.setTarget(on ? center : null); atmos.spot(on ? center : null, color);
      document.querySelector('#content').inert = on;
      document.querySelector('.topbar').inert = on;
      document.querySelectorAll('.controls,.hud-rail,.portal-hud,.it-focus,.np').forEach(el => { el.inert = on; });
    },
  });
  window.nookCatalog = catalog;
  marker = createMarker({ audio, onDrawing(on) {
    if (lenis) on ? lenis.stop() : (scrollUnlocked && lenis.start());
  } });
  window.nookMarker = marker;
  window.nookAperture = aperture;
  window.nookPerf = () => ({ clock: +clock.toFixed(2), tl: +tl.toFixed(2), started, dofK: dof ? +dof.k.toFixed(2) : 0, dofOn: dof ? dof.pass.enabled : false,
    cam: camera.position.toArray().map((v) => +v.toFixed(2)), look: cam.l.toArray().map((v) => +v.toFixed(2)), fade: +lens.uniforms.uFade.value.toFixed(2),
    lost: renderer.getContext().isContextLost(), dpr: DPR, tier: renderTier,
    averageFrameMs: +averageFrameMs.toFixed(1) }); // debug
  // debug: step the film deterministically and report the first non-finite camera / rig value
  window.nookScan = (from = 0, to = 17, step = 1 / 60) => {
    const bad = (v) => !Number.isFinite(v.x + v.y + v.z);
    const out = []; cam.init = false; prevT = from;
    for (let t = from; t <= to; t += step) {
      update(t, step, false);
      const flags = [];
      if (bad(camHead)) flags.push('camHead'); if (bad(camHeadS)) flags.push('camHeadS');
      if (bad(cam.p)) flags.push('cam.p'); if (bad(cam.l)) flags.push('cam.l');
      if (bad(phones.position)) flags.push('phones'); if (!Number.isFinite(camera.fov)) flags.push('fov');
      clock += step; atmos.update(clock, step, { lights: lightsK, hidden: false, mouse: UI.mouse, interactive: false });
      scene.traverse((o) => {
        if (o.isLight && !Number.isFinite(o.intensity)) flags.push('light:' + (o.name || o.type));
        if (o.isLight && o.color && !Number.isFinite(o.color.r + o.color.g + o.color.b)) flags.push('lightcol:' + o.type);
        if (bad(o.position) || !Number.isFinite(o.quaternion.x + o.quaternion.y + o.quaternion.z + o.quaternion.w) || bad(o.scale)) {
          let p = o, path = []; while (p && path.length < 6) { path.push((p.name || p.type) + '#' + (p.parent ? p.parent.children.indexOf(p) : '-')); p = p.parent; }
          flags.push('xf:' + path.join('<') + ' pos=' + o.position.toArray().join(',') + ' kids=' + o.children.length + ' vis=' + o.visible);
        }
        const m = o.material; if (!m || Array.isArray(m)) return;
        if (m.color && !Number.isFinite(m.color.r + m.color.g + m.color.b)) flags.push('col:' + o.type);
        if (m.emissive && !Number.isFinite(m.emissive.r + m.emissive.g + m.emissive.b + m.emissiveIntensity)) flags.push('emi:' + o.type);
        if (m.uniforms) for (const k in m.uniforms) { const u = m.uniforms[k].value; if (typeof u === 'number' && !Number.isFinite(u)) flags.push('u:' + k); }
      });
      [bloom.strength, lens.uniforms.uCA.value].forEach((x, i) => { if (!Number.isFinite(x)) flags.push('post' + i); });
      if (flags.length) { out.push({ t: +t.toFixed(3), flags }); if (out.length > 4) break; }
    }
    return out;
  };
  UI.progress(1);
  ready = true;
}

/* ---------------- post FX ---------------- */
const LensShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uCA: { value: 0.6 }, uVig: { value: 0.85 }, uFade: { value: 0 }, uGrain: { value: 0.028 },
    // REANIMATED Part 3: warm LUT-style grade (lift / gamma / gain + a little split-tone), uGrade 0..1
    uLift: { value: new THREE.Vector3(0.012, 0.0, 0.03) }, uGamma: { value: new THREE.Vector3(0.97, 1.0, 1.04) },
    uGain: { value: new THREE.Vector3(1.05, 1.0, 0.94) }, uGrade: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uCA, uVig, uFade, uGrain, uGrade; uniform vec3 uLift, uGamma, uGain; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5; float d = dot(c, c);
      vec2 off = c * d * uCA * 0.045;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      vec3 gr = pow(max(col * uGain + uLift * (1.0 - col), 0.0), uGamma);
      float lum = dot(gr, vec3(0.299, 0.587, 0.114));
      gr += mix(vec3(-0.004, 0.0, 0.018), vec3(0.02, 0.008, -0.012), smoothstep(0.08, 0.6, lum)); // teal shadows, amber highs
      col = mix(col, gr, uGrade);
      col *= mix(1.0, smoothstep(0.62, 0.05, d), uVig * 0.55);
      float n = h(vUv * vec2(1931.7, 1213.3) + fract(uTime * 7.13));
      col += (n - 0.5) * uGrain;
      gl_FragColor = vec4(col * uFade, 1.0);
    }`,
};

// A single NaN/Inf pixel in the half-float buffer gets smeared over the whole frame by the bloom
// blur chain, which turns the entire canvas black. Scrub those pixels before bloom sees them.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    float clean(float x){
    #if __VERSION__ >= 300
      if (isnan(x) || isinf(x)) return 0.0;
    #endif
      return (x >= 0.0 && x <= 64.0) ? x : (x > 64.0 ? 64.0 : 0.0);
    }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(clean(c.r), clean(c.g), clean(c.b), 1.0);
    }`,
};

function setupPost() {
  const rt = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { type: THREE.HalfFloatType, samples: QUALITY === 'high' ? 2 : 0 });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(DPR);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  // REANIMATED Part 3: depth of field (disabled unless dof.setTarget(v) is active)
  dof = createDOF({ scene, camera, tier: QUALITY });
  composer.addPass(dof.pass);
  composer.addPass(new ShaderPass(SanitizeShader));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.6, 0.86);
  bloom.enabled = QUALITY !== 'low';
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  lens = new ShaderPass(LensShader);
  composer.addPass(lens);
  sizeBloom();
}

function sizeBloom() {
  if (!bloom) return;
  const scale = QUALITY === 'high' ? 1 : 0.6;
  bloom.setSize(Math.max(1, Math.round(innerWidth * DPR * scale)), Math.max(1, Math.round(innerHeight * DPR * scale)));
}

let lastW = innerWidth, lastH = innerHeight, resizeRaf = 0;
const coarse = window.matchMedia('(pointer: coarse)').matches;
function resize(force) {
  if (!renderer) return;
  // ignore mobile URL-bar show/hide (height-only jitter) — CSS stretches the canvas instead
  if (force !== true && coarse && innerWidth === lastW && Math.abs(innerHeight - lastH) < 160) return;
  lastW = innerWidth; lastH = innerHeight;
  renderer.setPixelRatio(DPR);
  renderer.setSize(innerWidth, innerHeight, false);
  if (camera) { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  if (composer) { composer.setPixelRatio(DPR); composer.setSize(innerWidth, innerHeight); sizeBloom(); }
  measureSections();
  if (window.ScrollTrigger) window.ScrollTrigger.refresh();
}
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(resize);
});

/* ---------------- floating music notes (sprites) ---------------- */
function buildNotes() {
  const glyphs = ['♪', '♫', '♬', '♩'];
  const cols = ['#ff6f9f', '#ffc56b', '#9fe3ff', '#ff9db5', '#c6a2ff'];
  for (let i = 0; i < 12; i++) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.font = '96px "Segoe UI Symbol", "Noto Music", "DejaVu Sans", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = cols[i % 5]; g.shadowBlur = 18; g.fillStyle = cols[i % 5];
    g.fillText(glyphs[i % 4], 64, 68);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, color: new THREE.Color(1.6, 1.6, 1.6) });
    const s = new THREE.Sprite(m); s.scale.setScalar(0.12); scene.add(s);
    notes.push({ s, ph: i / 12, side: i % 2 ? 1 : -1, sw: 1 + (i % 3) * 0.4 });
  }
}

/* ---------------- character staging ---------------- */
const tmp = { a: V(), b: V(), c: V(), d: V(), e: V() };
const UP = V(0, 1, 0);
const restPos = V(LAYOUT.sideTable.x + 0.05, LAYOUT.sideTable.top + 0.108, LAYOUT.sideTable.z + 0.12);
const restQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.25, 0));
const HEAD_ANCHOR = V(0, 0.12, -0.005);
const state = { legIK: { w: 0, L: V(), R: V(), tap: 0 }, armA: null, armB: null, look: { w: 0, target: V() } };
const camHead = V();
const camHeadS = V();

function poseCharacter(t) {
  const x = TR.get('x', t), z = TR.get('z', t), yaw = TR.get('yaw', t);
  const walkW = walkWAt(t), phase = phaseAt(t);
  const fwd = V(Math.sin(yaw), 0, Math.cos(yaw));
  const sideA = V(Math.cos(yaw), 0, -Math.sin(yaw)); // character local +x
  const sideB = sideA.clone().negate();
  const sitW = TR.get('sit', t);
  const music = t >= T.plug ? smooth(seg(t, T.plug, T.plug + 0.8)) : 0;
  const b = (t - T.plug) / BEAT;
  const seated = smooth(seg(t, T.sitB + 0.2, T.sitB + 1.2));

  // hips: crouch at the table, sit with anticipation + cushion bounce
  const su = seg(t, T.sitA, T.sitB);
  const ant = Math.sin(seg(t, T.sitA - 0.35, T.sitA + 0.1) * PI) * (t < T.sitA + 0.1 ? 1 : 0);
  const v = t - T.sitB;
  const bounce = t > T.sitB ? -0.028 * Math.exp(-5 * v) * Math.sin(13 * v) : 0;
  let hipY = lerp(C.STAND_H - TR.get('hipDrop', t), SEAT_H, smoother(su)) - 0.04 * ant + bounce;
  if (t > T.sitB) hipY += 0.006 * Math.pow(Math.cos(PI * b) ** 2, 2) * seated; // tiny bob with the nod

  const s = state;
  Object.assign(s, {
    x, z, yaw, hipY, phase, walkW, sitW,
    spineX: TR.get('spineX', t), chestX: TR.get('chestX', t),
    chestY: seated * 0.045 * Math.sin((PI * b) / 2),
    pelvisX: 0, kneeBend: 0,
    nod: seated * 0.09 * Math.pow(Math.cos(PI * b) ** 2, 1.5) + (t > T.plug + 0.4 && t < T.sitA ? 0.05 * Math.pow(Math.cos(PI * b) ** 2, 2) : 0),
    tilt: seated * 0.06 * Math.sin((PI * b) / 2),
    blink: (() => { const u = (t + 0.7) % 3.7; return u < 0.14 ? Math.sin((u / 0.14) * PI) : 0; })(),
    vibe: t > T.sitB + 0.8 && ((t - T.sitB - 0.8) % 9) < 7.6 ? 1 : 0,
    smile: music,
    browUp: t > T.plug ? Math.exp(-(t - T.plug) * 2.5) : (t > 4.8 && t < 5.6 ? 0.6 : 0),
  });

  // feet: planted relative to root while standing, fixed world spots while sitting
  const lg = s.legIK;
  lg.w = 1 - walkW;
  if (t >= T.sitA - 0.05) {
    lg.L.set(SEAT_X + 0.11, 0, -3.05 - 0.03 * sitW);
    lg.R.set(SEAT_X - 0.11, 0, -3.05 - 0.03 * sitW);
  } else {
    lg.L.set(x, 0, z).addScaledVector(sideA, 0.1).addScaledVector(fwd, 0.03);
    lg.R.set(x, 0, z).addScaledVector(sideB, 0.1).addScaledVector(fwd, 0.03);
  }
  lg.tap = seated * Math.pow(Math.max(0, Math.sin(2 * PI * b)), 2);

  // look-at
  const lk = s.look;
  lk.w = 0;
  const wSw = smooth(seg(t, 4.7, 5.0)) * (1 - smooth(seg(t, 5.7, 6.1)));
  const wPh = smooth(seg(t, 6.9, 7.8)) * (1 - smooth(seg(t, 9.75, 10.15)));
  const wCam = smooth(seg(t, T.sitB - 0.1, T.sitB + 0.4)) * (1 - 0.6 * smooth(seg(t, T.sitB + 0.8, T.sitB + 1.6)));
  if (wSw > 0) { lk.w = wSw; lk.target.copy(W.switchPos); }
  else if (wPh > 0) { lk.w = wPh; lk.target.copy(t < T.grab ? restPos : phones.position); }
  else if (wCam > 0) { lk.w = wCam; lk.target.copy(camera.position); }

  // pass 1 — body without arm IK
  s.armA = null; s.armB = null;
  C.apply(s, clock);

  // headphones transform
  const headAnchor = C.head.localToWorld(tmp.a.copy(HEAD_ANCHOR));
  const headQ = C.head.getWorldQuaternion(new THREE.Quaternion());
  const charQ = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  if (t < T.grab) {
    phones.position.copy(restPos); phones.quaternion.copy(restQ);
  } else if (t < T.placeA) {
    const u = easeInOut(seg(t, T.grab, T.placeA));
    const P1 = tmp.b.copy(headAnchor).addScaledVector(fwd, 0.24).addScaledVector(UP, 0.1);
    const Cp = tmp.c.copy(restPos).addScaledVector(UP, 0.5).addScaledVector(fwd, -0.05);
    const m = 1 - u;
    phones.position.set(0, 0, 0).addScaledVector(restPos, m * m).addScaledVector(Cp, 2 * m * u).addScaledVector(P1, u * u);
    phones.quaternion.copy(restQ).slerp(charQ, u);
  } else if (t < T.plug) {
    const u = easeInOut(seg(t, T.placeA, T.plug));
    const P1 = tmp.b.copy(headAnchor).addScaledVector(fwd, 0.24).addScaledVector(UP, 0.1);
    phones.position.copy(P1).lerp(headAnchor, u).addScaledVector(UP, Math.sin(u * PI) * 0.09);
    phones.quaternion.copy(charQ).slerp(headQ, u);
  } else {
    phones.position.copy(headAnchor); phones.quaternion.copy(headQ);
  }
  phones.updateMatrixWorld(true);

  // arm targets
  const cupW = (i, out) => {
    phones.userData.cups[i].getWorldPosition(out);
    const o = tmp.e.copy(out).sub(phones.position).normalize();
    return out.addScaledVector(o, 0.1);
  };
  const bandTop = () => phones.localToWorld(V(0, 0.192, 0)).addScaledVector(UP, 0.06);
  const down = V(0, -1, 0);
  let A = null, B = null;

  // light switch (right hand = armB)
  const wSwitch = smooth(seg(t, T.swReach, T.swOn - 0.05)) * (1 - smooth(seg(t, T.swBack, T.swBack + 0.45)));
  if (wSwitch > 0) B = { w: wSwitch, target: W.switchPos.clone().add(V(0, 0.07, 0.07)), bend: down.clone().addScaledVector(sideB, 0.6).addScaledVector(fwd, -0.3) };

  // grab + lift with the table-side hand (armA), then both hands guide the cups on
  if (t >= T.reachA && t < T.plug + 0.75) {
    const wOut = 1 - smooth(seg(t, T.plug + 0.2, T.plug + 0.75));
    const w = smooth(seg(t, T.reachA, T.grab)) * wOut;
    let tgt = bandTop();
    if (t > T.placeA) tgt.lerp(cupW(1, V()), smooth(seg(t, T.placeA, T.placeA + 0.3)));
    A = { w, target: tgt, bend: down.clone().addScaledVector(sideA, 0.8).addScaledVector(fwd, -0.2) };
  }
  if (t >= T.placeA && t < T.plug + 0.75) {
    const wIn = smooth(seg(t, T.placeA, T.placeA + 0.35)), wOut = 1 - smooth(seg(t, T.plug + 0.2, T.plug + 0.75));
    B = { w: wIn * wOut, target: cupW(0, V()), bend: sideB.clone().addScaledVector(down, 0.6) };
  }

  // seated: hands on thighs, right hand presses the ear cup now and then
  if (t > T.sitA + 0.4) {
    const w = smooth(seg(t, T.sitA + 0.4, T.sitB + 0.2));
    const thigh = (leg, side, out) => {
      leg.hip.getWorldPosition(out); leg.knee.getWorldPosition(tmp.d);
      return out.lerp(tmp.d, 0.62).addScaledVector(UP, 0.1).addScaledVector(side, 0.03);
    };
    const bendA = sideA.clone().addScaledVector(fwd, -0.5).addScaledVector(down, 0.3);
    const bendB = sideB.clone().addScaledVector(fwd, -0.5).addScaledVector(down, 0.3);
    A = { w, target: thigh(C.legL, sideA, V()), bend: bendA };
    const cyc = ((t - (T.sitB + 0.6)) % 12 + 12) % 12;
    const cw = t > T.sitB + 0.6 ? smooth(seg(cyc, 0, 0.5)) * (1 - smooth(seg(cyc, 3.4, 4.1))) : 0;
    const tb = thigh(C.legR, sideB, V());
    if (cw > 0) tb.lerp(cupW(0, V()), cw);
    B = { w, target: tb, bend: bendB.lerp(sideB.clone().addScaledVector(down, 0.8), cw) };
  }
  s.armA = A; s.armB = B;
  if (A || B) C.apply(s, clock); // pass 2 with arm IK

  C.head.getWorldPosition(camHead); camHead.y += 0.1;

  // seat cushion squash
  const cushion = W.seatCushions[0];
  const dip = sitW * 0.035 + Math.max(0, -bounce) * 0.9;
  cushion.position.y = cushion.userData.baseY - dip;
  cushion.scale.y = 1 - dip * 1.6;

  return { music, b };
}

/* ---------------- camera ---------------- */
const cam = { p: V(), l: V(), f: 40, init: false };
const goal = { p: V(), l: V(), f: 40 };
const catalogAim = V(4.85, .85, -3.7);
const mouseS = { x: 0, y: 0 };

const SHOTS = {
  hero: { p: [-0.3, 1.35, 0.6], l: [-0.35, 1.0, -3.4], f: 38 },
  heroP: { p: [0.75, 1.55, 0.55], l: [0.75, 1.98, -3.6], f: 60 },
  stations: { p: [3.4, 2.15, -2.0], l: [4.55, 1.5, -4.05], f: 42 },
  catalog: { p: [3.7, 1.85, -.3], l: [4.15, .95, -4.05], f: 44 },
  shelf: { p: [0, 1.85, 25.5], l: [0, 1.5, 20], f: 42 },
  rooms: { p: [.72, 2.7, -2.1], l: [.72, 2.7, -9], f: 52 },
  mixes: { p: [-0.9, 1.8, -1.3], l: [-2.9, 2.2, -4.5], f: 46 },
  join: { p: [0.6, 2.25, 3.4], l: [0.8, 1.3, -3.2], f: 46 },
};
const SHOTS_P = { // portrait overrides (subject centred, slightly lower)
  stations: { p: [3.6, 2.1, -1.6], l: [4.85, 1.55, -4.05], f: 58 },
  catalog: { p: [4.85, 2.1, .1], l: [4.85, 1.6, -4.05], f: 54 },
  shelf: { p: [0, 1.85, 25.7], l: [0, 1.5, 20], f: 54 },
  rooms: { p: [.72, 2.7, -2.1], l: [.72, 2.7, -9], f: 64 },
  mixes: { p: [-1.2, 1.7, -0.9], l: [-2.1, 2.05, -4.5], f: 62 },
  join: { p: [0.8, 2.3, 4.2], l: [0.8, 1.5, -3.2], f: 66 },
};
const ORDER = ['hero', 'stations', 'catalog', 'shelf', 'rooms', 'mixes', 'join'];
// REANIMATED Part 1: chapter names for the HUD (scene tag + rail)
const CHAPTERS = [
  { id: 'hero', title: 'The Couch', scene: 'THE COUCH' },
  { id: 'stations', title: 'Stations', scene: 'THE DECKS' },
  { id: 'catalog', title: 'Catalog', scene: 'THE CATALOG' },
  { id: 'shelf', title: 'Shelf', scene: 'THE SHELF' },
  { id: 'rooms', title: 'Canal', scene: 'CANALE DI NOOK' },
  { id: 'mixes', title: 'Mixes', scene: 'THE NEON WALL' },
  { id: 'join', title: 'Join', scene: 'THE WIDE SHOT' },
];
function sceneName() {
  if (aperture && aperture.active) return 'SITE PLAN';
  if (interact && interact.focused) return 'FOCUS · ' + interact.focused.title.toUpperCase(); // Part 2
  if (tl < 5.9) return 'THE DOORWAY';
  if (tl < 11.1) return 'THE SIDE TABLE';
  if (tl < T.reveal) return 'THE COUCH';
  return CHAPTERS[clamp(Math.round(scrollU), 0, CHAPTERS.length - 1)].scene;
}
const shotOf = (name, portrait) => {
  if (name === 'shelf' && innerHeight < 700) return { p: [0, 1.85, 25.7], l: [0, 1.25, 20], f: portrait ? 54 : 48 };
  if (portrait) return name === 'hero' ? SHOTS.heroP : SHOTS_P[name] || SHOTS[name];
  return SHOTS[name];
};

function introShot(t, charX) {
  const head = camHeadS;
  if (t < 2.7) {
    const u = smooth(seg(t, 0, 2.7));
    goal.p.set(lerp(-1.0, -1.7, u), lerp(1.7, 1.62, u), lerp(2.4, 1.2, u)); goal.l.set(-3.95, 1.3, -4.9); goal.f = 40;
  } else if (t < 5.95) {
    goal.p.set(-1.55, 1.6, -0.75); goal.l.copy(head).add(tmp.a.set(0, -0.28, 0)); goal.f = 40;
  } else if (t < 8.5) {
    goal.p.set(charX + 0.6, 1.5, -0.85); goal.l.copy(head).add(tmp.a.set(0.15, -0.3, 0)); goal.f = 42;
  } else if (t < 11.1) {
    goal.p.set(-0.45, 1.58, -1.75); goal.l.set(-1.0, 1.42, -3.55); goal.f = 34;
  } else if (t < 13.5) {
    goal.p.set(-0.2, 1.5, -0.5); goal.l.copy(head).add(tmp.a.set(0, -0.35, 0)); goal.f = 40;
  } else {
    goal.p.set(0.85, 1.2, -0.85); goal.l.set(SEAT_X, 0.98, -3.6); goal.f = 40;
  }
}

let chapterBounds = [];
const measureSections = () => {
  chapterBounds = ORDER.map(id => { const el = document.getElementById(id); return { top: el.offsetTop, height: el.offsetHeight }; });
};
measureSections();

function scrollShot() {
  const portrait = camera.aspect < 0.9;
  const sy = lenis ? lenis.animatedScroll : window.scrollY;
  let chapter = 0;
  for (let n = 1; n < chapterBounds.length; n++) { if (sy >= chapterBounds[n].top) chapter = n; }
  const bounds = chapterBounds[chapter];
  // Long chapters hold their camera until their final viewport, then join the next shot.
  const transitionStart = bounds.top + Math.max(0, bounds.height - innerHeight);
  const u = clamp(chapter + clamp((sy - transitionStart) / Math.max(1, innerHeight), 0, 1), 0, ORDER.length - 1);
  const i = Math.min(ORDER.length - 2, Math.floor(u)), f = smoother(u - i);
  const a = shotOf(ORDER[i], portrait), b = shotOf(ORDER[i + 1], portrait);
  goal.p.set(lerp(a.p[0], b.p[0], f), lerp(a.p[1], b.p[1], f), lerp(a.p[2], b.p[2], f));
  goal.l.set(lerp(a.l[0], b.l[0], f), lerp(a.l[1], b.l[1], f), lerp(a.l[2], b.l[2], f));
  goal.f = lerp(a.f, b.f, f);
  if (chapter === 4 && canal) {
    const travel = clamp((sy - bounds.top) / Math.max(1, bounds.height - innerHeight), 0, 1);
    const flight = travel < .72 ? travel / .72 : 1 - (travel - .72) / .28;
    canal.apply(goal, flight);
    if (u > 4) {
      const blend = smoother(u - 4), next = shotOf('mixes', portrait);
      goal.p.lerp(tmp.d.fromArray(next.p), blend); goal.l.lerp(tmp.e.fromArray(next.l), blend); goal.f = lerp(goal.f, next.f, blend);
    }
  }
  scrollU = u;
  return u;
}

function updateCamera(t, dt, snap, charX) {
  let lambda = 2.4;
  // damp the tracked head so walk bob / nods don't shake the frame
  if (snap) camHeadS.copy(camHead);
  else camHeadS.lerp(camHead, 1 - Math.exp(-dt * 5));
  if (t < T.reveal - 0.2) introShot(t, charX);
  else {
    scrollShot();
    // ease the damping up after the reveal instead of switching abruptly
    lambda = lerp(1.4, 2.8, smooth(seg(t, T.reveal, T.reveal + 3)));
    // mouse parallax
    mouseS.x = damp(mouseS.x, UI.mouse.x, 3, dt); mouseS.y = damp(mouseS.y, UI.mouse.y, 3, dt);
    const right = tmp.a.subVectors(goal.l, goal.p).cross(UP).normalize();
    const par = interact ? 1 - interact.focusK * 0.7 : 1; // calmer parallax while focused
    goal.p.addScaledVector(right, mouseS.x * 0.14 * par).addScaledVector(UP, -mouseS.y * 0.07 * par);
    if (interact) interact.apply(goal);
    if (catalog) catalog.apply(goal); // REANIMATED Part 2: hover-zoom 15% + focus dolly
  }
  // hand-held drift
  goal.p.x += noise1(clock * 0.45) * 0.012; goal.p.y += noise1(clock * 0.37 + 9) * 0.01;
  if (snap || !cam.init) { cam.p.copy(goal.p); cam.l.copy(goal.l); cam.f = goal.f; cam.init = true; }
  else {
    const k = 1 - Math.exp(-dt * lambda);
    cam.p.lerp(goal.p, k); cam.l.lerp(goal.l, k); cam.f = lerp(cam.f, goal.f, k);
  }
  camera.position.copy(cam.p); camera.lookAt(cam.l);
  if (Math.abs(camera.fov - cam.f) > 0.01) { camera.fov = cam.f; camera.updateProjectionMatrix(); }
}

/* ---------------- frame update (pure-ish function of t) ---------------- */
let plugK = 0;
function update(t, dt, snap, cameraDt = dt) {
  if (!snap && t > prevT && t - prevT < 0.5) events(prevT, t);

  const { music, b } = poseCharacter(t);
  const fr = ((b % 1) + 1) % 1;
  const beatPulse = t > T.plug - 3 ? Math.exp(-fr * 5.5) : 0;

  const onRaw = seg(t, T.swOn, T.swOn + 0.22);
  const flick = t > T.swOn && t < T.swOn + 0.35 ? (Math.sin((t - T.swOn) * 70) > -0.2 ? 1 : 0.35) : 1;
  const L = {
    door: easeInOut(seg(t, T.doorA, T.doorB)) + (t > T.doorB ? Math.sin((t - T.doorB) * 8) * Math.exp(-(t - T.doorB) * 4) * 0.03 : 0),
    lights: onRaw * flick,
    neon: seg(t, T.swOn + 0.25, T.swOn + 1.25),
    string: seg(t, T.swOn + 0.1, T.swOn + 2.3),
    music: Math.max(music, t < T.plug ? 0.04 : 0),
    beatPulse,
    arm: smooth(seg(t, T.plug - 0.5, T.plug + 0.2)),
  };
  W.update(clock, dt, L);
  lightsK = L.lights;

  // headphone LEDs + notes
  plugK = t > T.plug ? Math.exp(-(t - T.plug) * 3.5) : 0;
  phones.userData.ledMat.color.setRGB(1, 0.31, 0.48).multiplyScalar(0.15 + music * (0.7 + beatPulse * 2.4) + plugK * 4);
  notes.forEach((n) => {
    const u = (((t - T.plug) * 0.33 + n.ph) % 1 + 1) % 1;
    const vis = music * Math.sin(u * PI) * (t > T.plug + 0.2 ? 1 : 0);
    n.s.material.opacity = vis * 0.9;
    n.s.position.copy(phones.position)
      .add(tmp.a.set(n.side * (0.22 + u * 0.25) + Math.sin(u * 6 * n.sw + n.ph * 9) * 0.06, 0.05 + u * 0.9, Math.cos(u * 4 + n.ph * 7) * 0.08));
    n.s.scale.setScalar(0.07 + u * 0.08 + beatPulse * 0.015 * music);
    n.s.material.rotation = Math.sin(u * 5 + n.ph * 4) * 0.4;
  });

  // post
  if (bloom) {
    bloom.strength = 0.5 + 0.12 * music * beatPulse + plugK * 0.9 + L.lights * 0.05;
    lens.uniforms.uCA.value = 0.55 + plugK * 3;
  }

  // UI
  if (t < T.reveal) {
    let cap = null; for (const [ct, txt] of CAPS) if (t >= ct) cap = txt;
    UI.caption(cap);
    UI.timecode(t);
    UI.setProgress(t / T.reveal);
  } else UI.caption(null);
  UI.setRevealed(t >= T.reveal);
  UI.setTrack(t > T.plug ? (t - T.plug) / (BEAT * 64) : 0);
  UI.wave(audio.level(), beatPulse, t, music);
  UI.beat(beatPulse * Math.max(music, 0.15));

  updateCamera(t, Math.min(1, cameraDt), snap, TR.get('x', t));
  if (audio.enabled) audio.update(t);
  prevT = t;
}

function events(a, b) {
  const cross = (x) => a < x && b >= x;
  if (cross(T.bolt)) W.strike(1.1);
  if (cross(T.doorA)) audio.sfx('creak');
  if (cross(T.swOn)) audio.sfx('click');
  if (cross(T.grab)) audio.sfx('grab');
  if (cross(T.plug)) audio.plugIn();
  if (cross(T.sitB)) audio.sfx('poof');
  if (cross(T.sitB + 1.8)) audio.sfx('purr');
  if (b < T.sitA) {
    const sa = Math.floor(phaseAt(a) / PI), sb = Math.floor(phaseAt(b) / PI);
    const w = walkWAt(b);
    if (sb !== sa && w > 0.25) audio.sfx('step', { v: 0.45 + 0.55 * w });
  }
}

/* ---------------- seek helpers ---------------- */
function seek(t) {
  tl = t; prevT = t;
  if (audio.enabled) audio.sync(t);
  update(t, 0, true);
}

/* ---------------- scroll: Lenis + GSAP ---------------- */
let lenis = null;
if (window.Lenis) {
  try { lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true }); lenis.stop(); } catch (e) { lenis = null; }
}
let scrollUnlocked = false;
function setScroll(on) {
  if (on === scrollUnlocked) return;
  scrollUnlocked = on;
  document.documentElement.classList.toggle('locked', !on);
  if (lenis) on ? lenis.start() : lenis.stop();
  if (on && window.ScrollTrigger) requestAnimationFrame(() => window.ScrollTrigger.refresh());
}
(function setupReveals() {
  const panels = [...document.querySelectorAll('.chapter .panel')];
  if (window.gsap && window.ScrollTrigger) {
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    if (lenis) lenis.on('scroll', ScrollTrigger.update);
    panels.forEach((p) => {
      // transform/opacity only — clip-path over a backdrop-filter repainted every scroll frame
      gsap.fromTo(p.querySelectorAll('.rs'), { y: 28, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out', stagger: 0.07, overwrite: 'auto',
        scrollTrigger: { trigger: p, start: 'top 82%', toggleActions: 'play none none reverse' },
      });
      gsap.fromTo(p, { y: 60, scale: 0.97, autoAlpha: 0 }, {
        y: 0, scale: 1, autoAlpha: 1, ease: 'none', force3D: true,
        scrollTrigger: { trigger: p, start: 'top 100%', end: 'top 62%', scrub: 0.6 },
      });
    });
  } else {
    document.documentElement.classList.add('no-gsap');
    const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('in', e.isIntersecting)), { threshold: 0.2 });
    panels.forEach((p) => io.observe(p));
  }
})();

function scrollToId(id) {
  if (catalog?.open) catalog.close();
  const el = document.getElementById(id);
  if (!el) return;
  const wasLocked = !scrollUnlocked;
  if (wasLocked) skipIntro();
  const go = () => (lenis
    ? lenis.scrollTo(el, { duration: 1.4, easing: (x) => 1 - Math.pow(1 - x, 4) })
    : el.scrollIntoView({ behavior: 'smooth' }));
  setTimeout(go, wasLocked ? 480 : 0);
}
document.querySelectorAll('[data-goto]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); scrollToId(a.dataset.goto); }));

/* ---------------- controls ---------------- */
// dip to black and back so jumps in the timeline read as a cut, not a glitch
let cutAt = -10, cutPending = null;
function cutTo(fn) {
  if (cutPending) return;
  cutPending = fn; cutAt = clock;
}
const skipIntro = () => {
  if (tl >= T.reveal) return;
  if (aperture && aperture.active) {
    aperture.fadeDom();
    cutTo(() => { aperture.finishNow(); cam.init = false; seek(SKIP_TO); });
    return;
  }
  cutTo(() => seek(SKIP_TO));
};
document.getElementById('skipBtn').addEventListener('click', skipIntro);
document.getElementById('replayBtn').addEventListener('click', () => cutTo(() => {
  if (lenis) lenis.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0);
  setScroll(false);
  UI.setRevealed(false);
  cam.init = false;
  seek(0);
}));
UI.onSound(async () => {
  try {
    if (!audio.enabled) { await audio.enable(tl); UI.setSound(true); }
    else { audio.disable(); UI.setSound(false); }
  } catch (e) { UI.setSound(false); }
});
document.querySelectorAll('[data-sound-on]').forEach((b) => b.addEventListener('click', async (e) => {
  e.preventDefault();
  if (!audio.enabled) { try { await audio.enable(tl); UI.setSound(true); } catch (err) { /* noop */ } }
}));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') skipIntro();
});

/* ---------------- main loop ---------------- */
let last = performance.now(), perfAcc = 0, perfN = 0, perfCheckAt = 0, nextShadowAt = 0, averageFrameMs = 0;
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  perfAcc = 0; perfN = 0;
});
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = now; return; }
  const elapsed = Math.max(0, (now - last) / 1000);
  const dt = Math.min(0.05, elapsed);
  last = now;
  clock += elapsed;
  UI.frame(dt);
  if (lenis) lenis.raf(now);
  if (failed || document.body.classList.contains('scene-fallback')) return;

  if (!started) {
    const done = UI.loaderTick(elapsed);
    if (ready && done) {
      started = true; startClock = clock;
      UI.hideLoader();
      document.body.classList.add('started');
      window.dispatchEvent(new Event('nook:ready'));
      prevT = tl;
    }
    return;
  }

  const CUT_OUT = 0.32, CUT_IN = 0.7;
  if (cutPending && clock - cutAt >= CUT_OUT) { const fn = cutPending; cutPending = null; cutAt = clock - CUT_OUT; fn(); }
  const apOn = aperture && aperture.active; // REANIMATED Part 1: hold the film during the prologue
  if (!FREEZE && !cutPending && !apOn) tl += elapsed;
  update(tl, cutPending ? 0 : dt, false, cutPending ? 0 : elapsed);
  if (apOn) aperture.update(cutPending ? 0 : elapsed); // overrides the camera while active
  if (hud) hud.update(Math.min(1, elapsed), { scene: sceneName(), chapter: tl >= T.reveal ? clamp(Math.round(scrollU), 0, CHAPTERS.length - 1) : null, u: scrollU, camera });
  setScroll(tl >= T.reveal);
  document.body.classList.toggle('scrolled', window.scrollY > innerHeight * 0.35);
  lens.uniforms.uTime.value = clock;
  if (dof) { dof.update(dt); lens.uniforms.uVig.value = 0.85 + dof.k * 0.3; } // Part 3: deeper vignette in focus
  const ce = clock - cutAt;
  const cutFade = ce < CUT_OUT ? 1 - smooth(ce / CUT_OUT) : smooth(clamp((ce - CUT_OUT) / CUT_IN, 0, 1));
  lens.uniforms.uFade.value = FREEZE ? 1 : Math.min(smooth(clamp((clock - startClock) / 1.2, 0, 1)), cutFade);
  if (!Number.isFinite(lens.uniforms.uFade.value)) lens.uniforms.uFade.value = 1;
  // a non-finite camera renders pure black forever (damping keeps feeding NaN back in) — re-snap it
  if (!Number.isFinite(cam.p.x + cam.p.y + cam.p.z + cam.l.x + cam.l.y + cam.l.z + camera.fov)) {
    if (!Number.isFinite(camHeadS.x + camHeadS.y + camHeadS.z)) camHeadS.copy(camHead);
    cam.init = false;
    update(tl, 0, true);
    if (apOn) aperture.update(0);
  }
  if (glLost) return;
  if (QUALITY !== 'high' && renderer.shadowMap.enabled && now >= nextShadowAt) {
    renderer.shadowMap.needsUpdate = true;
    nextShadowAt = now + 1000 / 30;
  }
  const shelfLive = tl >= T.reveal && !cutPending && Math.abs(scrollU - 3) < .45;
  if (shelf) shelf.update(Math.min(.2, elapsed), clock, lenis ? lenis.animatedScroll : window.scrollY, shelfLive);
  const far = shelfLive ? 12 : 60;
  if (camera.far !== far) { camera.far = far; camera.updateProjectionMatrix(); }
  const canalLive = tl >= T.reveal && !cutPending && scrollU >= 3.9 && scrollU < 4.98;
  if (canal) canal.update(clock, dt, canalLive);
  if (marker) marker.update(dt, clock, tl >= T.reveal && scrollU > 5.5 && !cutPending);
  composer.render();
  const catalogLive = tl >= T.reveal && !cutPending && Math.abs(scrollU - 2) < .42;
  if (catalog) catalog.update(Math.min(1, elapsed), catalogLive);
  if (portals) portals.update(dt, tl >= T.reveal && !cutPending && !catalogLive && !shelfLive && !canalLive);
  // REANIMATED Part 2 + 3 (atmos runs before the next render; it only writes uniforms)
  const roomLive = tl >= T.reveal && !cutPending && !apOn && !(portals && portals.open);
  if (interact) interact.update(dt, roomLive && !catalogLive && !shelfLive && !canalLive);
  if (atmos) {
    atmos.dust.position.z = shelfLive ? 21 : 0;
    if (shelfLive) atmos.spot(shelf.aim, '#ffd7a8');
    else if (catalogLive && !catalog.open) atmos.spot(catalogAim, '#ffd7a8');
    else if (!catalogLive && !interact.focused) atmos.spot(null);
    atmos.update(clock, Math.min(.2, elapsed), { lights: lightsK, hidden: apOn, mouse: UI.mouse, interactive: roomLive });
  }

  // test hook: body.settled once the scene has faded in (screenshots wait for it)
  if (clock - startClock > 2.5 && !document.body.classList.contains('settled')) document.body.classList.add('settled');
  // Use real frame intervals, not the capped animation delta, and keep checking after warm-up.
  // Downgrade only after sustained pressure; a cooldown avoids reallocating buffers repeatedly.
  if (autoQuality && clock - startClock > 2 && clock >= perfCheckAt && elapsed > 0) {
    perfAcc += Math.min(elapsed, 0.5); perfN++;
    if (perfAcc >= 2 && perfN >= 12) {
      const average = perfAcc / perfN;
      averageFrameMs = average * 1000;
      perfAcc = 0; perfN = 0;
      if (average > 1 / 45) {
        if (DPR > 0.75) {
          DPR = Math.max(0.75, +(DPR - 0.25).toFixed(2));
          resize(true);
        } else if (renderTier !== 'low') {
          renderTier = 'low';
          bloom.enabled = false;
          renderer.shadowMap.enabled = false;
          atmos?.setTier('low');
          dof?.setTier('low');
          canal?.setTier('low');
        }
        perfCheckAt = clock + 3;
      }
    }
  }
}

boot().catch((e) => { console.error(e); fail('Something went wrong while building the room.'); });
requestAnimationFrame(frame);

// optional deep link to a chapter (debug / sharing): ?chapter=2
if (params.has('chapter')) {
  const n = parseInt(params.get('chapter'), 10) || 0;
  const goto = () => { if (tl >= T.reveal && started) { const y = chapterBounds[clamp(n, 0, ORDER.length - 1)].top; window.scrollTo(0, y); if (lenis) lenis.scrollTo(y, { immediate: true }); } else setTimeout(goto, 100); };
  setTimeout(goto, 200);
}
