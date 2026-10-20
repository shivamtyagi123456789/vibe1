/* =========================================================
   nook.fm REANIMATED — PART 2: LIVING ROOM INTERACTION
   - throttled raycaster on the pointer (whole room = occluders)
   - hover: emissive rim glow (S5/S6), HUD cursor pill, reticle
     snaps + tightens onto the object (S2), corner brackets with
     a mono index tag (S6 hover icon / S1 pop-up)
   - click / tap: a distinct reaction per object (W.react) + synth sfx
   - hover-zoom (S2): dwell 600ms → camera eases 15% toward it
   - focus dolly (S5): double-click / double-tap → full dolly,
     Esc / ✕ / wheel returns to the room
   - first-time "Click to interact" chip (S2)
   API: createInteract({...}) → { update(dt, active), apply(goal),
        object(id), focused, exit() }
   ========================================================= */
import * as THREE from 'three';
import { clamp, lerp, safeLocal } from './utils.js';

const GLOW = new THREE.Color('#ffc56b');
const CHIP_KEY = 'nook.interact.chip';
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* every interactive object: id = W.react id, obj = root(s) in the room */
const DEFS = [
  { id: 'cat', title: 'Mochi', cat: 'THE CAT', obj: (W) => W.cat.cat, sfx: 'meow', state: () => 'AWAKE' },
  { id: 'neon', title: 'Neon Sign', cat: 'NEON', obj: (W) => [W.neon, W.neonPlate], sfx: 'buzz', state: (W) => W.reactState().neonWord.toUpperCase() },
  { id: 'turntable', title: 'Vinyl Player', cat: 'TURNTABLE', obj: (W) => W.turntable, sfx: 'scratch', dip: true, state: () => 'SCRATCH' },
  { id: 'pendant', title: 'Pendant Lamp', cat: 'KEY LIGHT', obj: (W) => W.pendant, sfx: 'clink', state: () => 'SWING' },
  { id: 'curtains', title: 'Curtains', cat: 'TEXTILE', obj: (W) => W.curtains, sfx: 'swish', state: (W) => (W.reactState().curtainOpen > 0.5 ? 'CLOSED' : 'OPEN') },
  { id: 'bookshelf', title: 'Bookshelf', cat: 'LIBRARY', obj: (W) => W.shelf, sfx: 'slide', state: () => 'PULL A BOOK' },
  { id: 'mug', title: 'Late Coffee', cat: 'STILL WARM', obj: (W) => W.mug, sfx: 'hiss', state: () => 'STEAM' },
  { id: 'window', title: 'Rainy Window', cat: 'WEATHER', obj: (W) => W.glass, sfx: null, state: () => 'THUNDER' },
  { id: 'speakers', title: 'Speakers', cat: 'AUDIO', obj: (W) => W.speakerBoxes, sfx: 'thump', state: () => 'BASS' },
  { id: 'door', title: 'Front Door', cat: 'HALLWAY', obj: (W) => W.doorPivot, sfx: 'knock', state: () => 'KNOCK KNOCK' },
  { id: 'plantL', title: 'Monstera', cat: 'PLANT', obj: (W) => W.plants[0], sfx: 'rustle', state: () => 'RUSTLE' },
  { id: 'plantR', title: 'Rubber Plant', cat: 'PLANT', obj: (W) => W.plants[1], sfx: 'rustle', state: () => 'RUSTLE' },
  { id: 'floorLamp', title: 'Floor Lamp', cat: 'LIGHT', obj: (W) => W.floorLamp, sfx: 'click', state: (W) => (W.reactState().lamps.floorLamp ? 'ON' : 'OFF') },
  { id: 'tableLamp', title: 'Table Lamp', cat: 'LIGHT', obj: (W) => W.tShade, sfx: 'click', state: (W) => (W.reactState().lamps.tableLamp ? 'ON' : 'OFF') },
  { id: 'posterA', title: 'Gig Poster', cat: 'PRINT', obj: (W) => W.posters[0], sfx: 'tap', state: () => 'SWING' },
  { id: 'posterB', title: 'Small Print', cat: 'PRINT', obj: (W) => W.posters[1], sfx: 'tap', state: () => 'SWING' },
  { id: 'posterC', title: 'Side Poster', cat: 'PRINT', obj: (W) => W.posters[2], sfx: 'tap', state: () => 'SWING' },
];

export function createInteract(opts) {
  // opts.hud is read lazily: the HUD is created after renderer.compile, interact before it
  const { camera, canvas, W, occluders = [], audio, UI, onFocus } = opts;
  const body = document.body;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const box = new THREE.Box3(), tmpBox = new THREE.Box3(), sph = new THREE.Sphere();
  const v = new THREE.Vector3(), v2 = new THREE.Vector3();

  /* ---------- targets: tag meshes, clone materials for a private glow ---------- */
  const targets = [];
  DEFS.forEach((d, i) => {
    let roots = d.obj(W);
    roots = (Array.isArray(roots) ? roots : [roots]).filter(Boolean);
    if (!roots.length) return;
    const t = { ...d, n: i + 1, roots, mats: [], k: 0, cool: 0, center: new THREE.Vector3(), radius: 0.3 };
    const cache = new Map();
    roots.forEach((r) => r.traverse((o) => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
      o.userData.it = t;
      const m = o.material;
      if (W.liveMats.has(m) || !m.emissive) return; // driven by world.js via W.hover
      let c = cache.get(m);
      if (!c) {
        c = m.clone();
        c.clippingPlanes = m.clippingPlanes; // keep shared planes (clone() deep-copies them)
        cache.set(m, c);
        t.mats.push({ m: c, base: c.emissive.clone(), bi: c.emissiveIntensity });
      }
      o.material = c;
    }));
    targets.push(t);
  });
  const byId = Object.fromEntries(targets.map((t) => [t.id, t]));

  // raycast list: every mesh in the room + the character (so walls / him occlude)
  const meshes = [];
  [W.group, ...occluders].forEach((r) => r && r.traverse((o) => { if (o.isMesh) meshes.push(o); }));

  function measure(t) {
    box.makeEmpty();
    t.roots.forEach((r) => { tmpBox.setFromObject(r); box.union(tmpBox); });
    box.getCenter(t.center); box.getBoundingSphere(sph); t.radius = Math.max(0.12, sph.radius);
    return box;
  }
  targets.forEach(measure);

  /* ---------- DOM: brackets, chip, focus bar ---------- */
  const frame = document.createElement('div');
  frame.className = 'it-frame'; frame.setAttribute('aria-hidden', 'true');
  frame.innerHTML = '<i></i><i></i><i></i><i></i><p class="it-tag"><b>00</b>/' + pad(targets.length) + ' · <span></span></p>';
  body.appendChild(frame);
  const tagN = frame.querySelector('.it-tag b'), tagS = frame.querySelector('.it-tag span');

  const chip = document.createElement('div');
  chip.className = 'it-chip'; chip.setAttribute('aria-hidden', 'true');
  chip.innerHTML = fine ? '<b>Click to interact</b><span>double-click to focus</span>' : '<b>Tap to interact</b><span>double-tap to focus</span>';
  body.appendChild(chip);
  let chipSeen = safeLocal.getItem(CHIP_KEY) === '1', chipT = 0;

  const bar = document.createElement('div');
  bar.className = 'it-focus'; bar.setAttribute('role', 'status');
  bar.innerHTML = '<span class="itf-k">FOCUS</span><span class="itf-n"></span><b class="itf-t"></b><button type="button" class="itf-x" aria-label="Back to the room (Esc)">✕ <kbd>ESC</kbd> back to the room</button>';
  body.appendChild(bar);
  bar.querySelector('.itf-x').addEventListener('click', () => exit());

  /* ---------- input ---------- */
  const ptr = { x: -9999, y: -9999, over: false, moved: true };
  const cursorEl = document.querySelector('.cursor');
  let active = false, hov = null, dwell = 0, rayAcc = 0;
  let zoomK = 0, focus = null, focusK = 0, flashT = 0;
  const zc = new THREE.Vector3();
  const fp = new THREE.Vector3(), fl = new THREE.Vector3();
  let fov = 34;

  function pick(x, y) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(meshes, false);
    for (const h of hits) {
      if (!h.object.visible) continue;
      return { t: h.object.userData.it || null, obj: h.object };
    }
    return { t: null, obj: null };
  }

  window.addEventListener('pointermove', (e) => {
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.over = e.target === canvas; ptr.moved = true;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { ptr.over = false; });

  function react(t, obj) {
    if (!t || t.cool > 0) return;
    t.cool = 0.35;
    W.react(t.id, obj);
    if (t.sfx) audio.sfx(t.sfx);
    if (t.dip) audio.dip();
    flashT = 0.5; frame.classList.remove('hit'); void frame.offsetWidth; frame.classList.add('hit');
    if (opts.hud && fine && hov === t && t.state) setTimeout(() => { if (hov === t) opts.hud.pill(t.title, t.state(W)); }, 220);
    hideChip();
  }

  // desktop: click reacts, dblclick focuses
  canvas.addEventListener('click', (e) => {
    if (!active || e.pointerType === 'touch') return;
    const p = pick(e.clientX, e.clientY);
    react(p.t, p.obj);
  });
  canvas.addEventListener('dblclick', (e) => {
    if (!active) return;
    const p = pick(e.clientX, e.clientY);
    if (p.t) enter(p.t);
  });
  // touch: tap reacts (+ brief brackets), double-tap focuses
  let down = null, lastTap = { t: 0, id: null };
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') down = { x: e.clientX, y: e.clientY, at: performance.now() }; }, { passive: true });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || e.pointerType === 'mouse' || !active) { down = null; return; }
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dur = performance.now() - down.at;
    down = null;
    if (moved > 12 || dur > 450) return;
    const p = pick(e.clientX, e.clientY);
    if (!p.t) return;
    const now = performance.now();
    if (lastTap.id === p.t.id && now - lastTap.t < 380) { enter(p.t); lastTap = { t: 0, id: null }; return; }
    lastTap = { t: now, id: p.t.id };
    touchShow = { t: p.t, time: 1.6 };
    react(p.t, p.obj);
    if (!chipSeen) showChip(e.clientX, e.clientY);
  });
  let touchShow = null;

  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && focus) exit(); });
  window.addEventListener('wheel', (e) => { if (focus && Math.abs(e.deltaY) > 30) exit(); }, { passive: true });

  function showChip(x, y) {
    chipT = 4; chip.classList.add('on');
    chip.style.transform = `translate3d(${x + 22}px,${y - 34}px,0)`;
  }
  function hideChip() {
    if (!chip.classList.contains('on') && chipSeen) return;
    chip.classList.remove('on'); chipT = 0;
    if (!chipSeen) { chipSeen = true; safeLocal.setItem(CHIP_KEY, '1'); }
  }

  /* ---------- focus mode ---------- */
  function enter(t) {
    if (focus === t) return;
    measure(t);
    focus = t;
    const c = t.center, r = t.radius;
    const dist = Math.max(0.9, r * 3.2);
    const dir = v.copy(camera.position).sub(c); dir.y *= 0.4; dir.normalize();
    dir.lerp(v2.set(0, 0.12, 1), 0.3).normalize(); // lean toward the room's open side
    fp.copy(c).addScaledVector(dir, dist); fp.y += r * 0.35;
    fp.x = clamp(fp.x, -6.5, 6.5); fp.y = clamp(fp.y, 0.45, 3.85); fp.z = clamp(fp.z, -4.25, 4.5);
    fl.copy(c); fov = 34;
    bar.querySelector('.itf-n').textContent = pad(t.n) + ' / ' + pad(targets.length);
    bar.querySelector('.itf-t').textContent = t.title;
    body.classList.add('it-focused');
    if (onFocus) onFocus(true, t);
    setTimeout(() => bar.querySelector('.itf-x').focus({ preventScroll: true }), 60);
    hideChip();
  }
  function exit() {
    if (!focus) return;
    focus = null;
    body.classList.remove('it-focused');
    if (onFocus) onFocus(false, null);
  }

  /* ---------- per frame ---------- */
  function setHover(t) {
    if (t === hov) return;
    hov = t; dwell = 0;
    if (t) {
      if (opts.hud && fine) opts.hud.pill(t.title, t.cat);
      tagN.textContent = pad(t.n); tagS.textContent = t.cat;
      if (!chipSeen && fine && !chip.classList.contains('on')) showChip(ptr.x, ptr.y);
    } else if (opts.hud) opts.hud.hidePill();
  }

  function update(dt, isActive) {
    if (isActive !== active) {
      active = isActive;
      if (!active) { setHover(null); exit(); }
    }
    targets.forEach((t) => { t.cool = Math.max(0, t.cool - dt); });

    // throttled raycast (~20 Hz), only while the pointer is over the 3D scene
    rayAcc += dt;
    if (active && fine && rayAcc > 0.05) {
      rayAcc = 0;
      setHover(ptr.over ? pick(ptr.x, ptr.y).t : null);
    }
    if (!fine && touchShow) { touchShow.time -= dt; if (touchShow.time <= 0) touchShow = null; }
    const shown = active ? (fine ? hov : touchShow && touchShow.t) : null;

    // glow (exp-lerp λ 10) — world.js reads W.hover for its live materials
    targets.forEach((t) => {
      const goal = t === shown || t === focus ? 1 : 0;
      t.k += (goal - t.k) * (1 - Math.exp(-dt * 10));
      if (t.k < 0.002 && goal === 0) t.k = 0;
      W.hover[t.id] = t.k;
      t.mats.forEach(({ m, base, bi }) => {
        m.emissive.copy(base).lerp(GLOW, Math.min(1, t.k));
        m.emissiveIntensity = lerp(bi, Math.max(bi, 0.35), t.k);
      });
    });

    // hover-zoom (S2): dwell 600ms → ease 15% toward the object
    if (hov && active) { dwell += dt; if (dwell > 0.6) { measure(hov); zc.copy(hov.center); } }
    const zGoal = hov && dwell > 0.6 && !focus && !reduce ? 1 : 0;
    zoomK += (zGoal - zoomK) * (1 - Math.exp(-dt * 2.4));
    focusK += ((focus ? 1 : 0) - focusK) * (1 - Math.exp(-dt * (focus ? 2.2 : 2.8)));
    if (focus) { measure(focus); fl.lerp(focus.center, 1 - Math.exp(-dt * 6)); }

    // brackets + reticle snap
    let snapK = 0;
    if (shown) {
      measure(shown);
      const r = project(box);
      if (r) {
        frame.style.transform = `translate3d(${r.x0.toFixed(1)}px,${r.y0.toFixed(1)}px,0)`;
        frame.style.width = (r.x1 - r.x0).toFixed(1) + 'px';
        frame.style.height = (r.y1 - r.y0).toFixed(1) + 'px';
        frame.classList.add('on');
        v.copy(shown.center).project(camera);
        if (UI && UI.snap) { UI.snap.x = (v.x * 0.5 + 0.5) * innerWidth; UI.snap.y = (-v.y * 0.5 + 0.5) * innerHeight; }
        snapK = 1;
      } else frame.classList.remove('on');
      if (!fine && tagN.textContent !== pad(shown.n)) { tagN.textContent = pad(shown.n); tagS.textContent = shown.cat; }
    } else frame.classList.remove('on');
    if (UI && UI.snap) UI.snap.k = snapK;
    if (cursorEl) cursorEl.classList.toggle('snap', snapK > 0);

    if (chipT > 0) {
      chipT -= dt;
      if (fine) chip.style.transform = `translate3d(${ptr.x + 22}px,${ptr.y - 34}px,0)`;
      if (chipT <= 0) hideChip();
    }
    flashT = Math.max(0, flashT - dt);
  }

  function project(b) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(camera);
      if (v.z > 1) return null;
      const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const p = 8;
    x0 = clamp(x0 - p, 4, innerWidth - 4); x1 = clamp(x1 + p, 4, innerWidth - 4);
    y0 = clamp(y0 - p, 4, innerHeight - 4); y1 = clamp(y1 + p, 4, innerHeight - 4);
    if (x1 - x0 < 8 || y1 - y0 < 8) return null;
    return { x0, y0, x1, y1 };
  }

  /* camera: called by main.updateCamera after the scroll shot is built */
  function apply(goal) {
    if (zoomK > 0.001) { goal.p.lerp(zc, 0.15 * zoomK); goal.l.lerp(zc, 0.35 * zoomK); }
    if (focusK > 0.001) {
      goal.p.lerp(fp, focusK); goal.l.lerp(fl, focusK); goal.f = lerp(goal.f, fov, focusK);
    }
  }

  return {
    update, apply, exit,
    set hud(value) { opts.hud = value; },
    get focused() { return focus; },
    get focusK() { return focusK; },
    get hovered() { return hov; },
    object(id) { const t = byId[id]; return t ? t.roots[0] : null; },
    targets,
    _debug: () => ({ active, hov: hov && hov.id, focus: focus && focus.id, zoomK: +zoomK.toFixed(2), focusK: +focusK.toFixed(2), n: targets.length, meshes: meshes.length }),
    _test: { react: (id) => react(byId[id]), enter: (id) => enter(byId[id]), pick },
  };
}
