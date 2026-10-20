/* =========================================================
   nook.fm REANIMATED — PART 1: CINEMATIC HUD
   - scene tag  "● LIVE · THE COUCH" with scramble-decode   (S6)
   - left chapter rail: rotated scene name, ticks, 01/05,
     live camera readout x y z · fov                      (S1 + S2)
   - reticle cursor over the 3D scene                      (S2)
   - cursor pill for [data-pill="Title|CATEGORY"] + API     (S5)
   - logo letters spread from the centre on hover          (S2)
   API: createHUD({ chapters, goto }) → { update(dt, info), pill(t,c), hidePill() }
   ========================================================= */
import { clamp, lerp } from './utils.js';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·/#';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createHUD({ chapters, goto }) {
  const body = document.body;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const pad = (n) => String(n).padStart(2, '0');

  /* ---------- logo letter-spread (S2) ---------- */
  const brand = document.querySelector('.brand');
  if (brand && !brand.dataset.split) {
    brand.dataset.split = '1';
    const letters = [...'Vibes'].map((c) => [c, false]);
    const mid = (letters.length - 1) / 2;
    brand.innerHTML = '<span class="brand-dot"></span><span class="bl-wrap" aria-hidden="true">' +
      letters.map(([c, pink], i) => `<span class="bl${pink ? ' pk' : ''}" style="--d:${(i - mid).toFixed(1)}">${c}</span>`).join('') +
      '</span><i class="bl-box" aria-hidden="true"></i>';
  }

  /* ---------- scene tag (S6) ---------- */
  const tag = document.createElement('div');
  tag.className = 'hud-tag'; tag.setAttribute('aria-hidden', 'true');
  tag.innerHTML = '<i></i><span>LIVE</span><em>·</em><b>SITE PLAN</b>';
  document.body.appendChild(tag);
  const tagB = tag.querySelector('b');

  /* ---------- chapter rail (S1 index + S2 rotated label) ---------- */
  const rail = document.createElement('nav');
  rail.className = 'hud-rail'; rail.setAttribute('aria-label', 'Chapters');
  rail.innerHTML = `
    <p class="hr-side" aria-hidden="true"><span>SITE PLAN</span></p>
    <ol class="hr-ticks">${chapters.map((c, i) => `<li><button type="button" data-i="${i}" data-pill="${esc(c.title)}|${pad(i + 1)}" aria-label="Go to ${esc(c.title)}"><i></i></button></li>`).join('')}</ol>
    <p class="hr-count"><b>00</b>/${pad(chapters.length)}</p>
    <p class="hr-cam" aria-hidden="true">x <b>0.00</b><br>y <b>0.00</b><br>z <b>0.00</b><br>fov <b>40</b></p>`;
  document.body.appendChild(rail);
  const sideSpan = rail.querySelector('.hr-side span'), countB = rail.querySelector('.hr-count b');
  const camB = [...rail.querySelectorAll('.hr-cam b')];
  const tickBtns = [...rail.querySelectorAll('.hr-ticks button')];
  tickBtns.forEach((b) => b.addEventListener('click', () => goto && goto(chapters[+b.dataset.i].id)));

  /* ---------- scramble ---------- */
  const scr = new Map();
  function scramble(el, text) {
    if (el.dataset.txt === text) return;
    el.dataset.txt = text;
    scr.set(el, { text, t: 0, dur: 0.5 + text.length * 0.02 });
  }
  function runScramble(dt) {
    scr.forEach((s, el) => {
      s.t += dt;
      const k = clamp(s.t / s.dur, 0, 1), n = s.text.length, solid = Math.floor(k * n);
      let out = s.text.slice(0, solid);
      for (let i = solid; i < n; i++) out += s.text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = out;
      if (k >= 1) { el.textContent = s.text; scr.delete(el); }
    });
  }

  /* ---------- reticle + pill (S2 / S5) ---------- */
  const cursor = document.querySelector('.cursor');
  const pill = document.createElement('div');
  pill.className = 'hud-pill'; pill.setAttribute('aria-hidden', 'true');
  pill.innerHTML = '<b></b><em></em>';
  document.body.appendChild(pill);
  const pillB = pill.querySelector('b'), pillE = pill.querySelector('em');
  const pp = { x: innerWidth / 2, y: innerHeight / 2, sx: innerWidth / 2, sy: innerHeight / 2, on: false, api: false };
  const setPill = (t, c) => {
    if (pillB.textContent !== t) pillB.textContent = t;
    if (pillE.textContent !== (c || '')) pillE.textContent = c || '';
    pill.classList.toggle('solo', !c);
  };
  if (fine) {
    window.addEventListener('pointermove', (e) => {
      pp.x = e.clientX; pp.y = e.clientY;
      const t = e.target;
      const el = t.closest ? t.closest('[data-pill]') : null;
      if (el) { const [a, b] = el.dataset.pill.split('|'); setPill(a, b); pp.on = true; }
      else if (!pp.api) pp.on = false;
      const interactive = t.closest && t.closest('a,button,input,textarea,.panel,.np,.portal-card-wrap');
      const scene = !interactive && (t.id === 'gl' || t.tagName === 'MAIN' || (t.closest && t.closest('main,.ap-topo,.hero,.chapter')));
      if (cursor) cursor.classList.toggle('reticle', !!scene);
    }, { passive: true });
    document.addEventListener('pointerleave', () => { pp.on = false; });
  }

  /* ---------- per frame ---------- */
  let camAcc = 0;
  function update(dt, info) {
    runScramble(dt);
    const name = info.scene || 'VIBES';
    scramble(tagB, name);
    scramble(sideSpan, name);
    const idx = info.chapter == null ? -1 : info.chapter;
    const cnt = idx < 0 ? '00' : pad(idx + 1);
    if (countB.textContent !== cnt) countB.textContent = cnt;
    tickBtns.forEach((b, i) => b.classList.toggle('on', i === idx));
    rail.style.setProperty('--fill', idx < 0 ? 0 : clamp(info.u / Math.max(1, chapters.length - 1), 0, 1));
    camAcc += dt;
    if (camAcc > 0.1 && info.camera) {
      camAcc = 0;
      const p = info.camera.position;
      camB[0].textContent = p.x.toFixed(2); camB[1].textContent = p.y.toFixed(2); camB[2].textContent = p.z.toFixed(2);
      camB[3].textContent = Math.round(info.camera.fov);
    }
    if (fine) {
      const k = 1 - Math.exp(-dt * 9);
      pp.sx = lerp(pp.sx, pp.x, k); pp.sy = lerp(pp.sy, pp.y, k);
      pill.style.transform = `translate3d(${pp.sx.toFixed(1)}px,${pp.sy.toFixed(1)}px,0)`;
      pill.classList.toggle('on', pp.on);
    }
  }

  return {
    update,
    pill(t, c) { setPill(t, c); pp.api = true; pp.on = true; },
    hidePill() { pp.api = false; pp.on = false; },
  };
}
