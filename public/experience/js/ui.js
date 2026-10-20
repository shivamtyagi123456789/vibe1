/* =========================================================
   nook.fm — DOM layer: loader, captions, split-text reveal,
   counters, magnetic buttons, custom cursor, now-playing wave
   ========================================================= */
import { clamp, lerp } from './utils.js';

const $ = (id) => document.getElementById(id);

export function createUI() {
  const UI = {};
  const body = document.body;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- loader ---------- */
  const ldBar = $('ldBar'), ldPct = $('ldPct'), loader = $('loader');
  let shown = 0, target = 0;
  UI.progress = (p) => { target = Math.max(target, clamp(p, 0, 1)); };
  UI.loaderTick = (dt) => {
    shown = lerp(shown, target, 1 - Math.exp(-dt * 8));
    if (target >= 1 && shown > 0.995) shown = 1;
    ldBar.style.transform = `scaleX(${shown})`;
    ldPct.textContent = Math.round(shown * 100);
    return shown >= 1;
  };
  UI.hideLoader = () => {
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 1400);
  };

  /* ---------- split headline into chars ---------- */
  document.querySelectorAll('[data-split]').forEach((line) => {
    const txt = line.textContent;
    line.textContent = '';
    const accessibleText = document.createElement('span');
    accessibleText.className = 'visually-hidden'; accessibleText.textContent = txt;
    line.appendChild(accessibleText);
    [...txt].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--i', i);
      s.textContent = ch === ' ' ? '\u00a0' : ch;
      line.appendChild(s);
    });
  });

  /* ---------- counters ---------- */
  const counters = [...document.querySelectorAll('[data-count]')];
  let counted = false;
  const runCounters = () => {
    if (counted) return; counted = true;
    counters.forEach((el, k) => {
      const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), suf = el.dataset.suf || '';
      const t0 = performance.now() + 900 + k * 140, dur = 1600;
      const step = (now) => {
        const u = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - u, 4);
        el.textContent = (to * e).toFixed(dec) + suf;
        if (u < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  };
  const resetCounters = () => { counted = false; counters.forEach((el) => (el.textContent = '0')); };

  /* ---------- reveal state ---------- */
  let revealed = false;
  UI.setRevealed = (on) => {
    if (on === revealed) return;
    revealed = on;
    body.classList.toggle('revealed', on);
    body.classList.toggle('intro', !on);
    if (on) runCounters(); else resetCounters();
  };

  /* ---------- captions + timecode ---------- */
  const capEl = $('capText'), tcEl = $('tc'), caption = $('caption');
  let curCap = null;
  UI.caption = (text) => {
    if (text === curCap) return;
    curCap = text;
    caption.classList.remove('show');
    clearTimeout(UI._capT);
    if (!text) return;
    UI._capT = setTimeout(() => { capEl.textContent = text; caption.classList.add('show'); }, 260);
  };
  UI.timecode = (t) => {
    const f = Math.floor((t % 1) * 24), s = Math.floor(t) % 60, m = Math.floor(t / 60);
    tcEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  };

  /* ---------- progress bars ---------- */
  const prog = $('prog'), npProg = $('npProg');
  UI.setProgress = (u) => { prog.style.transform = `scaleX(${clamp(u, 0, 1)})`; };
  UI.setTrack = (u) => { npProg.style.transform = `scaleX(${u % 1})`; };

  /* ---------- now-playing waveform (driven by analyser or beat) ---------- */
  const wave = $('npWave');
  const WB = 28, bars = [];
  for (let i = 0; i < WB; i++) { const b = document.createElement('i'); wave.appendChild(b); bars.push(b); }
  const wv = new Float32Array(WB);
  UI.wave = (freq, beatPulse, t, music) => {
    for (let i = 0; i < WB; i++) {
      let v;
      if (freq) v = freq[Math.min(freq.length - 1, 1 + Math.floor(i * 1.5))] / 255;
      else v = music * (0.25 + 0.45 * Math.abs(Math.sin(t * (2 + (i % 5) * 0.7) + i * 0.9)) * (0.6 + 0.4 * beatPulse));
      wv[i] = lerp(wv[i], v, 0.35);
      bars[i].style.transform = `scaleY(${0.08 + wv[i] * 0.92})`;
    }
  };

  /* ---------- sound button ---------- */
  const sBtn = $('soundBtn');
  UI.onSound = (fn) => sBtn.addEventListener('click', fn);
  UI.setSound = (on) => {
    sBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    sBtn.classList.toggle('on', on);
    sBtn.querySelector('em').textContent = on ? 'Sound on' : 'Sound off';
  };

  /* ---------- live clock ---------- */
  const clockEl = $('clock');
  const tick = () => {
    const d = new Date();
    clockEl.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  tick(); setInterval(tick, 15000);

  /* ---------- pointer: cursor, magnetic, normalized mouse ---------- */
  UI.mouse = { x: 0, y: 0 };
  UI.snap = { x: 0, y: 0, k: 0 }; // REANIMATED Part 2: interact.js pulls the ring 35% toward a hovered object
  let snapS = 0;
  const cursor = document.querySelector('.cursor');
  const dot = cursor.querySelector('.c-dot'), ring = cursor.querySelector('.c-ring');
  const cp = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 };
  if (fine) body.classList.add('has-cursor');
  window.addEventListener('pointermove', (e) => {
    UI.mouse.x = (e.clientX / innerWidth - 0.5) * 2;
    UI.mouse.y = (e.clientY / innerHeight - 0.5) * 2;
    cp.x = e.clientX; cp.y = e.clientY;
  }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    if (e.target.closest('a,button')) cursor.classList.add('hover');
  });
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest('a,button')) cursor.classList.remove('hover');
  });
  document.addEventListener('pointerdown', () => cursor.classList.add('down'));
  document.addEventListener('pointerup', () => cursor.classList.remove('down'));

  const mags = [...document.querySelectorAll('.magnetic')].map((el) => ({ el, x: 0, y: 0, tx: 0, ty: 0 }));
  if (fine) {
    mags.forEach((m) => {
      m.el.addEventListener('pointermove', (e) => {
        const r = m.el.getBoundingClientRect();
        m.tx = (e.clientX - (r.left + r.width / 2)) * 0.28;
        m.ty = (e.clientY - (r.top + r.height / 2)) * 0.38;
      });
      m.el.addEventListener('pointerleave', () => { m.tx = 0; m.ty = 0; });
    });
  }

  UI.frame = (dt) => {
    if (fine) {
      const k = 1 - Math.exp(-dt * 14);
      snapS = lerp(snapS, UI.snap.k, 1 - Math.exp(-dt * 10));
      const tx = lerp(cp.x, UI.snap.x, 0.35 * snapS), ty = lerp(cp.y, UI.snap.y, 0.35 * snapS);
      cp.rx = lerp(cp.rx, tx, k); cp.ry = lerp(cp.ry, ty, k);
      dot.style.transform = `translate(${cp.x}px,${cp.y}px)`;
      ring.style.transform = `translate(${cp.rx}px,${cp.ry}px)`;
      const km = 1 - Math.exp(-dt * 10);
      mags.forEach((m) => {
        m.x = lerp(m.x, m.tx, km); m.y = lerp(m.y, m.ty, km);
        if (Math.abs(m.x) + Math.abs(m.y) > 0.02 || m.tx || m.ty) m.el.style.transform = `translate(${m.x.toFixed(2)}px,${m.y.toFixed(2)}px)`;
      });
    }
  };

  /* ---------- beat → CSS var (cheap, compositor-only) ---------- */
  const root = document.documentElement;
  let lastBeat = -1;
  UI.beat = (pulse) => {
    const q = Math.round(pulse * 20) / 20;
    if (q !== lastBeat) { lastBeat = q; root.style.setProperty('--beat', q); }
  };

  UI.flash = () => {
    body.classList.remove('flash'); void body.offsetWidth; body.classList.add('flash');
  };

  return UI;
}
