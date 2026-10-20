/* =========================================================
   nook.fm — SECRET PORTALS ENGINE  (Part 1)
   - hidden hotspots glued to 3D objects (projected every frame)
   - proximity reveal: cursor near an object → hotspot shimmers in
   - hint glints, sonar scan (S key / radar button), secret word
   - discovery counter + toast, persisted in localStorage
   - portal card (glass modal) + warp-speed transition → opens app
   Public API: createPortals({ camera, audio }) → { update(dt, active) }
   ========================================================= */
import * as THREE from 'three';
import { PORTALS, PORTAL_SETTINGS as S } from './portals.config.js';
import { safeLocal, safeSession, storedArray } from './utils.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hostOf = (u) => { try { return new URL(u).host; } catch (e) { return u; } };

export function createPortals({ camera, audio, resolve }) {
  const params = new URLSearchParams(location.search);
  const DEBUG = params.get('debug') === 'portals' || window.NOOK_DEMO === true;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const list = PORTALS.filter((p) => p.enabled !== false);
  const found = new Set(storedArray(S.storageKey).filter((id) => list.some((p) => p.id === id)));
  let allRevealed = safeLocal.getItem(S.storageKey + '.all') === '1';
  let scanT = 0, glintT = 3, active = false, openCard = null;
  const mouse = { x: -9999, y: -9999 };
  const v = new THREE.Vector3();

  /* ---------- DOM: layer of hotspots ---------- */
  const layer = document.createElement('div');
  layer.className = 'portal-layer'; layer.setAttribute('aria-label', 'Hidden portals');
  document.body.appendChild(layer);

  const spots = list.map((p) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'portal-spot';
    el.style.setProperty('--pc', p.color);
    el.setAttribute('aria-label', `Secret portal: ${p.title}`);
    el.innerHTML = `<span class="ps-ring"></span><span class="ps-ring r2"></span><span class="ps-core">${esc(p.icon || '✦')}</span>
      <span class="ps-label"><b>${esc(p.title)}</b><em>${DEBUG ? esc(Array.isArray(p.anchor) ? p.anchor.join(', ') : '@' + p.anchor) : 'click to peek'}</em></span>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); openPortalCard(s); });
    el.addEventListener('pointerenter', () => { s.hover = true; blip(880, 0.05); });
    el.addEventListener('pointerleave', () => { s.hover = false; });
    layer.appendChild(el);
    const s = { p, el, pos: new THREE.Vector3(), x: 0, y: 0, vis: 0, shown: 0, hover: false, glint: 0, onScreen: false, obj: null, local: null };
    // REANIMATED Part 2: `anchor` may be a mesh name ('cat', 'mug', 'phones'…) → glued to that object
    // (follows it when it moves); xyz arrays still work, and are the fallback if the name is unknown.
    if (typeof p.anchor === 'string') {
      const o = resolve ? resolve(p.anchor) : null;
      if (o) {
        o.updateMatrixWorld(true);
        const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
        s.obj = o; s.local = o.worldToLocal(c.clone());
      } else console.warn('[portals] unknown anchor', p.anchor, '→ using p.fallback or the room centre');
      s.pos.fromArray(Array.isArray(p.fallback) ? p.fallback : [0, 1.2, -3]);
    } else s.pos.fromArray(p.anchor);
    return s;
  });

  /* ---------- HUD: secrets counter + radar button ---------- */
  const hud = document.createElement('div');
  hud.className = 'portal-hud';
  hud.innerHTML = `
    <button class="ph-scan" type="button" aria-label="Scan the room for secret portals (S)">
      <span class="ph-radar"><i></i></span><span class="ph-txt">Scan<kbd>S</kbd></span>
    </button>
    <div class="ph-count" aria-live="polite"><span class="ph-num">0</span>/<span>${list.length}</span> secrets
      <span class="ph-dots">${list.map((p) => `<i data-id="${esc(p.id)}" style="--pc:${p.color}"></i>`).join('')}</span>
    </div>`;
  document.body.appendChild(hud);
  const numEl = hud.querySelector('.ph-num');
  hud.querySelector('.ph-scan').addEventListener('click', () => scan());

  const toast = document.createElement('div');
  toast.className = 'portal-toast'; toast.setAttribute('role', 'status');
  document.body.appendChild(toast);
  let toastTimer = 0;
  const showToast = (html, color) => {
    toast.innerHTML = html; toast.style.setProperty('--pc', color || '#ff4f7b');
    toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  };

  const sonar = document.createElement('div');
  sonar.className = 'portal-sonar'; sonar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(sonar);

  function refreshCount() {
    numEl.textContent = found.size;
    hud.querySelectorAll('.ph-dots i').forEach((d) => d.classList.toggle('on', found.has(d.dataset.id)));
    hud.classList.toggle('complete', found.size === list.length);
    safeLocal.setItem(S.storageKey, JSON.stringify([...found]));
  }
  function discover(s, silent) {
    if (found.has(s.p.id)) return;
    found.add(s.p.id); refreshCount();
    s.el.classList.add('just-found'); setTimeout(() => s.el.classList.remove('just-found'), 1200);
    if (!silent) {
      blip(660, 0.08); setTimeout(() => blip(990, 0.08), 90);
      showToast(`<span>✦ secret found</span><b>${esc(s.p.title)}</b><em>${found.size}/${list.length}</em>`, s.p.color);
      if (found.size === list.length) setTimeout(() => showToast('<span>★ all secrets found</span><b>You know every corner of the nook.</b>', '#ffc56b'), 2800);
    }
  }
  refreshCount();

  /* ---------- scan + secret word ---------- */
  function scan() {
    if (!active) return;
    scanT = S.scanDuration;
    sonar.classList.remove('go'); void sonar.offsetWidth; sonar.classList.add('go');
    blip(420, 0.12, 'sine', 0.5);
  }
  let typed = '';
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (e.key === 'Escape' && openCard) { closeCard(); return; }
    if (!active || openCard || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    typed = (typed + k).slice(-S.secretWord.length);
    if (typed === S.secretWord) {
      allRevealed = true; safeLocal.setItem(S.storageKey + '.all', '1');
      spots.forEach((s) => discover(s, true)); refreshCount();
      showToast('<span>🔓 cheat code</span><b>Every portal revealed.</b>', '#9fe3ff');
      scan(); return;
    }
    if (k === S.scanKey) scan();
  });

  window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  // touch: a tap anywhere on the scene reveals nearby hotspots briefly
  window.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; } }, { passive: true });

  /* ---------- portal card ---------- */
  const card = document.createElement('div');
  card.className = 'portal-card-wrap'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.hidden = true;
  document.body.appendChild(card);
  card.addEventListener('click', (e) => { if (e.target === card || e.target.closest('[data-close]')) closeCard(); });

  function openPortalCard(s) {
    discover(s);
    openCard = s;
    const p = s.p;
    card.style.setProperty('--pc', p.color);
    card.innerHTML = `
      <article class="portal-card">
        <div class="pc-orb" aria-hidden="true"><i></i><i></i><i></i><span>${esc(p.icon || '✦')}</span></div>
        <p class="pc-eyebrow">secret portal · ${String(list.indexOf(p) + 1).padStart(2, '0')}</p>
        <h3>${esc(p.title)}</h3>
        <p class="pc-tag">${esc(p.tagline || '')}</p>
        <ul class="pc-tags">${(p.tags || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <div class="pc-url"><span class="pc-dot"></span>${esc(hostOf(p.url))}</div>
        <div class="pc-actions">
          <a class="btn primary pc-enter" href="${esc(p.url)}" ${p.newTab ? 'target="_blank" rel="noopener"' : ''}><span>Enter portal</span> <b aria-hidden="true">↗</b></a>
          <button class="btn ghost" type="button" data-close><span>Stay here</span></button>
        </div>
        <button class="pc-x" type="button" data-close aria-label="Close">×</button>
      </article>`;
    card.hidden = false;
    requestAnimationFrame(() => card.classList.add('open'));
    card.querySelector('.pc-enter').addEventListener('click', (e) => {
      if (!p.newTab) { e.preventDefault(); warp(p, () => { location.href = p.url; }); }
      else { warp(p, null); } // link opens natively in new tab (no popup blocker), we play the warp here
    });
    setTimeout(() => card.querySelector('.pc-enter').focus(), 50);
    blip(520, 0.1, 'triangle');
  }
  function closeCard() {
    if (!openCard) return;
    const s = openCard; openCard = null;
    card.classList.remove('open');
    setTimeout(() => { if (!openCard) card.hidden = true; }, 450);
    s.el.focus({ preventScroll: true });
  }

  /* ---------- warp transition (2D canvas hyperspace) ---------- */
  const wc = document.createElement('canvas');
  wc.className = 'portal-warp'; wc.setAttribute('aria-hidden', 'true');
  document.body.appendChild(wc);
  const g = wc.getContext('2d');
  let warping = false;
  function warp(p, done) {
    if (warping) return;
    warping = true;
    const dpr = Math.min(2, devicePixelRatio || 1);
    wc.width = innerWidth * dpr; wc.height = innerHeight * dpr;
    wc.classList.add('on');
    card.classList.add('warping');
    const cx = wc.width / 2, cy = wc.height / 2;
    const N = 420, stars = [];
    for (let i = 0; i < N; i++) stars.push({ a: Math.random() * Math.PI * 2, r: Math.random() * 40 * dpr, s: 0.4 + Math.random() * 1.6, w: (0.5 + Math.random() * 1.5) * dpr, c: Math.random() < 0.5 ? p.color : '#fff3df' });
    const t0 = performance.now(), OUT = 1300, BACK = 700;
    blip(180, 0.9, 'sawtooth', 1.2, 1400);
    const step = (now) => {
      const t = now - t0;
      const u = clamp(t / OUT, 0, 1), e = u * u * u;
      const back = done ? 0 : clamp((t - OUT) / BACK, 0, 1);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = `rgba(11,7,18,${0.35 - e * 0.2})`;
      g.fillRect(0, 0, wc.width, wc.height);
      g.globalCompositeOperation = 'lighter';
      const speed = 2 + e * 90;
      stars.forEach((st) => {
        const r0 = st.r; st.r += st.s * speed * dpr;
        const max = Math.hypot(cx, cy);
        if (st.r > max) { st.r = Math.random() * 30 * dpr; }
        g.strokeStyle = st.c; g.globalAlpha = clamp(0.25 + e, 0, 1) * (1 - back);
        g.lineWidth = st.w;
        g.beginPath();
        g.moveTo(cx + Math.cos(st.a) * r0, cy + Math.sin(st.a) * r0);
        g.lineTo(cx + Math.cos(st.a) * st.r, cy + Math.sin(st.a) * st.r);
        g.stroke();
      });
      g.globalAlpha = 1;
      // central tunnel glow → whiteout
      const rg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(cx, cy) * (0.2 + e * 1.4));
      rg.addColorStop(0, `rgba(255,243,223,${e * 0.9 * (1 - back)})`);
      rg.addColorStop(0.35, hexA(p.color, e * 0.55 * (1 - back)));
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, wc.width, wc.height);
      if (t < OUT || (!done && back < 1)) requestAnimationFrame(step);
      else if (done) done();
      if (!done && back >= 1) {
        wc.classList.remove('on'); card.classList.remove('warping'); warping = false;
        g.clearRect(0, 0, wc.width, wc.height); closeCard();
        showToast(`<span>↗ opened in a new tab</span><b>${esc(p.title)}</b>`, p.color);
      }
    };
    requestAnimationFrame(step);
  }
  const hexA = (hex, a) => {
    const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
  };

  /* ---------- tiny synth blips (only when the user enabled sound) ---------- */
  function blip(freq, dur = 0.08, type = 'sine', vol = 0.35, toFreq) {
    if (!audio || !audio.enabled || !audio.ctx) return;
    try {
      const c = audio.ctx, o = c.createOscillator(), gn = c.createGain(), t = c.currentTime;
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.06 * vol, t + 0.01);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn); gn.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  /* ---------- per-frame ---------- */
  function update(dt, isActive) {
    if (isActive !== active) {
      active = isActive;
      document.body.classList.toggle('portals-on', active);
      if (active && !found.size && !safeSession.getItem('nook.hint')) {
        safeSession.setItem('nook.hint', '1');
        setTimeout(() => showToast(`<span>psst…</span><b>This room hides ${list.length} secret portals.</b><em>${fine ? 'move your cursor around' : 'tap Scan'}</em>`, '#ff9db5'), 2600);
      }
    }
    layer.style.visibility = active ? 'visible' : 'hidden';
    if (!active) return;
    scanT = Math.max(0, scanT - dt);
    const scanK = scanT > 0 ? smooth(clamp(scanT / 0.6, 0, 1)) : 0;

    // hint glint: every few seconds an undiscovered spot twinkles
    glintT -= dt;
    if (glintT <= 0) {
      glintT = 4 + Math.random() * 4;
      const hidden = spots.filter((s) => !found.has(s.p.id) && s.onScreen);
      if (hidden.length) hidden[(Math.random() * hidden.length) | 0].glint = 1;
    }

    camera.updateMatrixWorld();
    const W = innerWidth, H = innerHeight, R = S.revealRadius;
    spots.forEach((s) => {
      if (s.obj) s.pos.copy(s.local).applyMatrix4(s.obj.matrixWorld);
      v.copy(s.pos).project(camera);
      const inFront = v.z > -1 && v.z < 1;
      s.x = (v.x * 0.5 + 0.5) * W; s.y = (-v.y * 0.5 + 0.5) * H;
      s.onScreen = inFront && s.x > 16 && s.x < W - 16 && s.y > 24 && s.y < H - 24;
      const d = Math.hypot(mouse.x - s.x, mouse.y - s.y);
      const prox = smooth(clamp(1 - d / R, 0, 1));
      let target = Math.max(prox, scanK, s.hover ? 1 : 0, allRevealed || DEBUG ? 0.75 : 0);
      if (!s.onScreen || openCard) target = openCard === s ? 1 : 0;
      s.vis += (target - s.vis) * (1 - Math.exp(-dt * 10));
      s.glint = Math.max(0, s.glint - dt * 0.7);
      if (prox > 0.82 && s.onScreen) discover(s);
      const shown = Math.max(s.vis, s.glint * 0.55);
      s.el.style.transform = `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0) scale(${(0.55 + shown * 0.45).toFixed(3)})`;
      s.el.style.opacity = shown.toFixed(3);
      s.el.style.pointerEvents = shown > 0.25 || (s.onScreen && prox > 0) ? 'auto' : 'none';
      s.el.classList.toggle('near', s.vis > 0.6);
      s.el.classList.toggle('found', found.has(s.p.id));
      s.el.tabIndex = s.onScreen ? 0 : -1;
    });
  }

  // REANIMATED Part 4: the catalog's "Open" button plays the same warp (and counts as a discovery)
  function launch(id, ev) {
    const s = spots.find((x) => x.p.id === id);
    if (!s) return;
    discover(s);
    if (!s.p.newTab) { if (ev) ev.preventDefault(); warp(s.p, () => { location.href = s.p.url; }); }
    else warp(s.p, null); // the <a target=_blank> opens natively (no popup blocker)
  }

  return { update, scan, list, found, launch, isFound: (id) => found.has(id), get open() { return !!openCard || warping; }, _debug: () => ({ W: innerWidth, H: innerHeight, active, scanT, DEBUG, openCard: !!openCard, spots: spots.map((s) => [s.p.id, s.onScreen, +s.vis.toFixed(2)]) }) };
}
