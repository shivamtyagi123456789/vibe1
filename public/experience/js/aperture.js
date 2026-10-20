/* =========================================================
   nook.fm REANIMATED — PART 1: APERTURE PROLOGUE  (sample S1)
   - full-screen animated topographic contour field (marching
     squares over 2D value noise) that rings the void + the cursor
   - a black "void" circle; inside it the room is BUILT UP from the
     floor by a rising world-space clipping plane + teal scan frame,
     seen as a slowly orbiting top-down site plan
   - entering irises the circle open while the camera swoops down a
     bezier from the plan view into the intro's first shot (no pop)
   All 3D extras (clip plane, plan lights, scan frame) are created
   BEFORE renderer.compile() and are only zeroed afterwards, so the
   hand-off never recompiles shaders.
   API: createAperture({...}) → { active, update(dt), fadeDom(), finishNow() }
   ========================================================= */
import * as THREE from 'three';
import { PORTALS } from './portals.config.js';
import { clamp, lerp, smooth, easeInOut } from './utils.js';

const hash2 = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// marching-squares segment table, edges: 0 top, 1 right, 2 bottom, 3 left
export const SEG = [[], [3, 2], [2, 1], [3, 1], [0, 1], [3, 0, 2, 1], [0, 2], [3, 0], [3, 0], [0, 2], [3, 2, 0, 1], [0, 1], [3, 1], [2, 1], [3, 2], []];

const BUILD_AT = 0.9, BUILD_DUR = 2.6, CUT_MAX = 3.9, FLIGHT = 3.6, AUTO_ENTER = 14;

export function createAperture({ renderer, scene, camera, audio, introShot, onEnter, onDone }) {
  const body = document.body;
  const apps = PORTALS.filter((p) => p.enabled !== false);
  let active = true, phase = 'idle', T = 0, tOpen = 0, hEnter = 0, buildK = 0, gone = false;

  /* ---------------- 3D extras ---------------- */
  const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), -0.05); // keeps y <= constant
  // per-material (NOT renderer.clippingPlanes, that would also clip the post-FX quads)
  renderer.localClippingEnabled = true;
  scene.traverse((o) => {
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.clippingPlanes = [plane]; });
  });
  const hemi = new THREE.HemisphereLight('#d9dcff', '#3a2448', 0);
  const sun = new THREE.DirectionalLight('#ffe2c4', 0);
  sun.position.set(6, 12, 8); sun.target.position.set(0, 0, -2);
  scene.add(hemi, sun, sun.target);

  const fx0 = -7.05, fx1 = 7.05, fz0 = -4.75, fz1 = 3.2;
  const fp = [];
  const seg = (ax, az, bx, bz) => fp.push(ax, 0, az, bx, 0, bz);
  seg(fx0, fz0, fx1, fz0); seg(fx1, fz0, fx1, fz1); seg(fx1, fz1, fx0, fz1); seg(fx0, fz1, fx0, fz0);
  for (let x = Math.ceil(fx0); x <= fx1; x++) { seg(x, fz0, x, fz0 + 0.18); seg(x, fz1, x, fz1 - 0.18); } // ruler ticks
  for (let z = Math.ceil(fz0); z <= fz1; z++) { seg(fx0, z, fx0 + 0.18, z); seg(fx1, z, fx1 - 0.18, z); }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  const frameMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#5fd4cf').multiplyScalar(2.4), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const frame = new THREE.LineSegments(fGeo, frameMat); frame.frustumCulled = false; frame.renderOrder = 5;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(fx1 - fx0, fz1 - fz0), new THREE.MeshBasicMaterial({ color: '#5fd4cf', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  sheet.rotation.x = -Math.PI / 2; sheet.position.set(0, 0, (fz0 + fz1) / 2); sheet.renderOrder = 4;
  scene.add(frame, sheet);
  const fogD = scene.fog ? scene.fog.density : 0;

  /* ---------------- DOM ---------------- */
  body.classList.add('aperture');
  const root = document.createElement('section');
  root.className = 'ap'; root.id = 'aperture'; root.setAttribute('aria-label', 'Prologue: Vibes, seen from above');
  const ticks = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, major = i % 6 === 0, r1 = major ? 102 : 104, r2 = major ? 110 : 107;
    ticks.push(`<line x1="${(Math.cos(a) * r1).toFixed(2)}" y1="${(Math.sin(a) * r1).toFixed(2)}" x2="${(Math.cos(a) * r2).toFixed(2)}" y2="${(Math.sin(a) * r2).toFixed(2)}"${major ? ' class="mj"' : ''}/>`);
  }
  const pad = (n) => String(n).padStart(2, '0');
  root.innerHTML = `
    <canvas class="ap-topo" aria-hidden="true"></canvas>
    <div class="ap-ring" aria-hidden="true">
      <svg viewBox="-116 -116 232 232"><g class="ap-ticks">${ticks.join('')}</g><circle class="ap-orbit" r="113"/><circle class="ap-rim" r="100"/></svg>
      <span class="ap-elev">ELEV <b>0.00</b> M</span>
      <span class="ap-n">N</span>
    </div>
    <button class="ap-void" type="button" data-pill="Vibes|ENTER" aria-label="Enter Vibes with sound"></button>
    <p class="ap-status" aria-live="polite">BUILDING THE ROOM <b>0%</b></p>
    <div class="ap-info">
      <p class="ap-idx"><b>01</b> | ${pad(apps.length)} PORTALS</p>
      <h2 class="ap-title">Vibes</h2>
      <p class="ap-copy">One room, ${apps.length} hidden doors. It’s 22:47, it’s been raining since six, and he’s almost home.</p>
      <ul class="ap-tags"><li>Real-time 3D</li><li>Lo-fi</li><li class="hot">Secret portals</li></ul>
    </div>
    <div class="ap-actions">
      <button class="btn primary ap-go" type="button" data-sound data-pill="Sound on|RECOMMENDED"><span>Tune in</span> <b aria-hidden="true">♪</b></button>
      <button class="btn ghost ap-go" type="button" data-pill="No sound|QUIET"><span>Enter silently</span></button>
    </div>
    <div class="ap-foot" aria-hidden="true"><span>PLAN 1:50 · ROOM 03 · FLOOR 2</span><span>SCROLL, OR CLICK THE VOID</span></div>`;
  document.body.appendChild(root);
  const cv = root.querySelector('.ap-topo'), g = cv.getContext('2d');
  const elevB = root.querySelector('.ap-elev b'), statusEl = root.querySelector('.ap-status');

  root.querySelector('.ap-void').addEventListener('click', () => enter(true));
  root.querySelectorAll('.ap-go').forEach((b) => b.addEventListener('click', () => enter(b.hasAttribute('data-sound'))));

  /* ---------------- layout + input ---------------- */
  let W = 0, H = 0, cx = 0, cy = 0, r0 = 0, dpr = 1, dist = 24, iris = 0;
  const mouse = { x: -9999, y: -9999, nx: 0, ny: 0, sx: 0, sy: 0 };
  function layout() {
    W = innerWidth; H = innerHeight;
    const mobile = W < 760;
    cx = W / 2; cy = mobile ? H * 0.47 : H * 0.5;
    r0 = mobile ? Math.min(W * 0.4, H * 0.25) : Math.min(W, H) * 0.33;
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    root.style.setProperty('--cx', cx + 'px'); root.style.setProperty('--cy', cy + 'px'); root.style.setProperty('--r0', r0 + 'px');
    // fit ~5 m of room inside the circle (≈4.2 m on phones)
    const frac = r0 / (H / 2), tanH = Math.tan(THREE.MathUtils.degToRad(38) / 2);
    dist = clamp((mobile ? 4.4 : 5.4) / (frac * tanH), 16, 46);
    if (!iris || phase === 'idle') iris = r0;
    drawTopo();
  }
  const onResize = () => layout();
  const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.nx = (e.clientX / W - 0.5) * 2; mouse.ny = (e.clientY / H - 0.5) * 2; };
  const onWheel = (e) => { if (Math.abs(e.deltaY) > 6) enter(false); };
  let ty = null;
  const onTS = (e) => { ty = e.touches[0].clientY; };
  const onTM = (e) => { if (ty !== null && ty - e.touches[0].clientY > 42) { ty = null; enter(false); } };
  const onKey = (e) => {
    if (phase !== 'idle') return;
    if ([' ', 'ArrowDown', 'PageDown'].includes(e.key) || (e.key === 'Enter' && (e.target === document.body || !e.target.closest('button,a')))) { e.preventDefault(); enter(false); }
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('touchstart', onTS, { passive: true });
  window.addEventListener('touchmove', onTM, { passive: true });
  window.addEventListener('keydown', onKey);

  /* ---------------- topographic field ---------------- */
  let V = new Float32Array(0);
  const CELL = 13;
  function drawTopo() {
    const nx = Math.ceil(W / CELL) + 1, ny = Math.ceil(H / CELL) + 1;
    if (V.length < nx * ny) V = new Float32Array(nx * ny);
    const md = Math.min(W, H), spacing = md * 0.042, t = T;
    const mr2 = 125 * 125, hasM = mouse.x > -999;
    for (let j = 0; j < ny; j++) {
      const y = j * CELL;
      for (let i = 0; i < nx; i++) {
        const x = i * CELL, dx = x - cx, dy = y - cy;
        let f = Math.sqrt(dx * dx + dy * dy) / spacing
          + 2.3 * vnoise(x * 0.0034 + t * 0.045, y * 0.0034 - t * 0.03)
          + 0.8 * vnoise(x * 0.009 - t * 0.05, y * 0.009 + 3.1)
          - t * 0.2;
        if (hasM) { const ex = x - mouse.x, ey = y - mouse.y; f -= 2.8 * Math.exp(-(ex * ex + ey * ey) / mr2); }
        V[j * nx + i] = f;
      }
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0b0712'; g.fillRect(0, 0, W, H);
    const pA = new Path2D(), pB = new Path2D();
    const skipR = Math.max(0, iris - CELL * 1.5);
    for (let j = 0; j < ny - 1; j++) {
      const y0 = j * CELL, y1 = y0 + CELL;
      for (let i = 0; i < nx - 1; i++) {
        const x0 = i * CELL, x1 = x0 + CELL;
        const ccx = x0 + CELL / 2 - cx, ccy = y0 + CELL / 2 - cy;
        if (ccx * ccx + ccy * ccy < skipR * skipR) continue;
        const k = j * nx + i, a = V[k], b = V[k + 1], c = V[k + nx + 1], d = V[k + nx];
        const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
        for (let L = Math.ceil(lo); L < hi; L++) {
          const cs = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
          const s = SEG[cs]; if (!s.length) continue;
          const P = (((L % 4) + 4) % 4) === 0 ? pB : pA;
          for (let q = 0; q < s.length; q += 2) {
            for (let w = 0; w < 2; w++) {
              const e = s[q + w]; let px, py;
              if (e === 0) { px = x0 + ((L - a) / (b - a)) * CELL; py = y0; }
              else if (e === 1) { px = x1; py = y0 + ((L - b) / (c - b)) * CELL; }
              else if (e === 2) { px = x0 + ((L - d) / (c - d)) * CELL; py = y1; }
              else { px = x0; py = y0 + ((L - a) / (d - a)) * CELL; }
              if (w === 0) P.moveTo(px, py); else P.lineTo(px, py);
            }
          }
        }
      }
    }
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,243,223,0.13)'; g.stroke(pA);
    g.lineWidth = 1.3; g.strokeStyle = 'rgba(255,157,181,0.42)'; g.stroke(pB);
    // warm halo hugging the rim + corner vignette
    const halo = g.createRadialGradient(cx, cy, iris, cx, cy, iris + 90);
    halo.addColorStop(0, 'rgba(255,79,123,0.22)'); halo.addColorStop(0.35, 'rgba(255,197,107,0.06)'); halo.addColorStop(1, 'rgba(255,79,123,0)');
    g.fillStyle = halo; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, md * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    vg.addColorStop(0, 'rgba(11,7,18,0)'); vg.addColorStop(1, 'rgba(11,7,18,0.85)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // punch the aperture: the WebGL room shows through the hole
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(cx, cy, Math.max(0, iris), 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
  }

  layout(); // after the field helpers exist (TDZ)

  /* ---------------- enter / finish ---------------- */
  const P0 = new THREE.Vector3(), L0 = new THREE.Vector3(), P1 = new THREE.Vector3(), P2 = new THREE.Vector3(...introShot.p), L2 = new THREE.Vector3(...introShot.l);
  const look = new THREE.Vector3(), pos = new THREE.Vector3();
  let F0 = 38, h = -0.05;

  function enter(withSound) {
    if (phase !== 'idle' || !active) return;
    phase = 'open'; tOpen = T; hEnter = h;
    P0.copy(camera.position); L0.copy(look); F0 = camera.fov;
    P1.set((P0.x + P2.x) / 2 - 0.4, Math.max(6.5, P0.y * 0.32), Math.max(P0.z, P2.z) + 4.2);
    root.classList.add('open');
    statusEl.innerHTML = 'ENTERING <b>22:47</b>';
    if (withSound && onEnter) Promise.resolve(onEnter()).then(() => sweep()).catch(() => {});
    else sweep();
  }
  function sweep() {
    if (!audio || !audio.enabled || !audio.ctx) return;
    try {
      const c = audio.ctx, t = c.currentTime, o = c.createOscillator(), gn = c.createGain(), f = c.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(420, t + 2.4);
      f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 2.2);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.03, t + 0.6); gn.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
      o.connect(f); f.connect(gn); gn.connect(c.destination); o.start(t); o.stop(t + 3.1);
    } catch (e) { /* ignore */ }
  }
  function cleanup3D() {
    plane.constant = 1e5;               // keep the plane → no shader recompile
    hemi.intensity = 0; sun.intensity = 0;
    frame.visible = false; sheet.visible = false;
    if (scene.fog) scene.fog.density = fogD;
  }
  function removeDom() {
    if (gone) return; gone = true;
    body.classList.remove('aperture');
    root.classList.add('gone');
    setTimeout(() => root.remove(), 700);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTS);
    window.removeEventListener('touchmove', onTM);
    window.removeEventListener('keydown', onKey);
  }
  function finish(viaFlight) {
    if (!active) return;
    active = false; phase = 'done';
    cleanup3D(); removeDom();
    if (viaFlight && onDone) onDone();
  }

  /* ---------------- per frame ---------------- */
  let topoAcc = 1, lastElev = '';
  function planCamera(b) {
    mouse.sx += (mouse.nx - mouse.sx) * 0.04; mouse.sy += (mouse.ny - mouse.sy) * 0.04;
    const tilt = lerp(0.05, 0.36, smooth(clamp((T - BUILD_AT) / 4.2, 0, 1))) + mouse.sy * 0.05;
    const az = 0.22 * Math.sin(T * 0.11) + mouse.sx * 0.14;
    look.set(0.4, 0.6, -1.6);
    pos.set(look.x + dist * Math.sin(tilt) * Math.sin(az), look.y + dist * Math.cos(tilt), look.z + dist * Math.sin(tilt) * Math.cos(az));
    camera.position.copy(pos); camera.lookAt(look);
    if (Math.abs(camera.fov - 38) > 0.01) { camera.fov = 38; camera.updateProjectionMatrix(); }
    return b;
  }

  let dbgT = 0;
  const DEBUG_AP = new URLSearchParams(location.search).get('debug') === 'aperture'; // was always on (console spam)
  function update(dt) {
    if (!active) return;
    T += dt;
    if (DEBUG_AP && (dbgT += dt) > 1) { dbgT = 0; console.log('[ap]', T.toFixed(1), 'h', h.toFixed(2), 'cam', camera.position.toArray().map((v) => v.toFixed(1)).join(','), 'fov', camera.fov, 'hemi', hemi.intensity.toFixed(2), 'calls', renderer.info.render.calls, 'tris', renderer.info.render.triangles); }
    const lightIn = smooth(clamp((T - 0.4) / 1.2, 0, 1));
    if (phase === 'idle') {
      buildK = smooth(clamp((T - BUILD_AT) / BUILD_DUR, 0, 1));
      h = lerp(-0.05, CUT_MAX, buildK);
      planCamera();
      hemi.intensity = 1.35 * lightIn; sun.intensity = 1.5 * lightIn;
      if (scene.fog) scene.fog.density = 0.006;
      iris = r0;
      if (T > AUTO_ENTER) enter(false);
    }
    if (phase === 'open') {
      const u = clamp((T - tOpen) / FLIGHT, 0, 1);
      const ui = easeInOut(clamp(u / 0.5, 0, 1));
      iris = lerp(r0, Math.hypot(W, H) * 0.6 + 40, ui);
      h = u > 0.8 ? 60 : lerp(hEnter, CUT_MAX, smooth(clamp(u / 0.25, 0, 1)));
      buildK = Math.max(buildK, smooth(clamp(u / 0.25, 0, 1)));
      const e = easeInOut(u), m = 1 - e;
      pos.set(0, 0, 0).addScaledVector(P0, m * m).addScaledVector(P1, 2 * m * e).addScaledVector(P2, e * e);
      look.copy(L0).lerp(L2, smooth(clamp(u * 1.15, 0, 1)));
      camera.position.copy(pos); camera.lookAt(look);
      camera.fov = lerp(F0, introShot.f, e); camera.updateProjectionMatrix();
      const fade = 1 - smooth(clamp((u - 0.3) / 0.55, 0, 1));
      hemi.intensity = 1.35 * fade; sun.intensity = 1.5 * fade;
      if (scene.fog) scene.fog.density = lerp(0.006, fogD, e);
      cv.style.opacity = (1 - smooth(clamp((u - 0.32) / 0.25, 0, 1))).toFixed(3);
      if (u >= 1) { camera.position.copy(P2); camera.lookAt(L2); finish(true); return; }
    }
    plane.constant = h;
    frame.position.y = Math.max(0.005, Math.min(h, CUT_MAX) - 0.01);
    sheet.position.y = frame.position.y - 0.002;
    const scanning = buildK > 0 && buildK < 1;
    frameMat.opacity = phase === 'open' ? 0 : (scanning ? 1 : (buildK >= 1 ? 0.22 : 0));
    sheet.material.opacity = scanning ? 0.06 : 0;
    root.style.setProperty('--r', iris.toFixed(1) + 'px');

    const ev = Math.max(0, Math.min(h, CUT_MAX)).toFixed(2);
    if (ev !== lastElev) { lastElev = ev; elevB.textContent = ev; }
    if (phase === 'idle') {
      const pct = Math.round(buildK * 100);
      const s = pct < 100 ? `BUILDING THE ROOM <b>${pct}%</b>` : 'CLICK THE VOID <b>· ENTER</b>';
      if (pct >= 100 && !root.classList.contains('built')) root.classList.add('built');
      if (statusEl.dataset.s !== s) { statusEl.dataset.s = s; statusEl.innerHTML = s; }
    }
    topoAcc += dt;
    if (phase === 'open' || topoAcc > 1 / 30) { topoAcc = 0; drawTopo(); }
  }

  return {
    get active() { return active; },
    update,
    fadeDom() { root.classList.add('skip'); },
    finishNow() { finish(false); },
  };
}
