/* =========================================================
   nook.fm — procedural canvas textures (no image downloads)
   ========================================================= */
import * as THREE from 'three';
import { rng } from './utils.js';

const mk = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
};
const tex = (c, { repeat, srgb = true, mips = true } = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.generateMipmaps = mips;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  return t;
};

/* ---------- wood floor planks ---------- */
export function woodFloor() {
  const [c, g] = mk(1024, 1024);
  const r = rng(11);
  const rows = 8, rh = 1024 / rows;
  for (let y = 0; y < rows; y++) {
    let x = -r() * 400;
    while (x < 1024) {
      const w = 260 + r() * 260;
      const base = 34 + r() * 16;
      const hue = 22 + r() * 8;
      g.fillStyle = `hsl(${hue}, 38%, ${base}%)`;
      g.fillRect(x, y * rh, w, rh);
      // grain
      for (let i = 0; i < 26; i++) {
        g.strokeStyle = `hsla(${hue - 4}, 40%, ${base - 10 + r() * 6}%, ${0.15 + r() * 0.25})`;
        g.lineWidth = 0.6 + r() * 1.6;
        g.beginPath();
        const yy = y * rh + r() * rh;
        g.moveTo(x, yy);
        g.bezierCurveTo(x + w * 0.3, yy + (r() - 0.5) * 10, x + w * 0.6, yy + (r() - 0.5) * 10, x + w, yy + (r() - 0.5) * 6);
        g.stroke();
      }
      if (r() < 0.35) { // knot
        const kx = x + r() * w, ky = y * rh + r() * rh;
        const grd = g.createRadialGradient(kx, ky, 1, kx, ky, 10);
        grd.addColorStop(0, 'rgba(40,20,10,.55)'); grd.addColorStop(1, 'rgba(40,20,10,0)');
        g.fillStyle = grd; g.beginPath(); g.ellipse(kx, ky, 14, 6, 0, 0, 7); g.fill();
      }
      g.fillStyle = 'rgba(15,8,4,.65)';
      g.fillRect(x, y * rh, 2, rh);
      x += w;
    }
    g.fillStyle = 'rgba(15,8,4,.7)';
    g.fillRect(0, y * rh, 1024, 2);
  }
  return tex(c, { repeat: [3, 3] });
}

/* ---------- plum wallpaper with tiny stars ---------- */
export function wallpaper() {
  const [c, g] = mk(512, 512);
  const r = rng(5);
  g.fillStyle = '#3b2552'; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) { // soft stripes
    g.fillStyle = 'rgba(255,255,255,.025)'; g.fillRect(x, 0, 32, 512);
  }
  g.fillStyle = 'rgba(255,214,240,.22)';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const cx = x * 64 + (y % 2 ? 32 : 0) + 16, cy = y * 64 + 20;
    g.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, rr = k % 2 ? 1.6 : 4.5;
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.fill();
  }
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(r() * 512, r() * 512, 2, 2); }
  return tex(c, { repeat: [5, 2] });
}

/* ---------- round woven rug ---------- */
export function rug() {
  const [c, g] = mk(1024, 1024);
  const cols = ['#e8c79a', '#d9604f', '#f2e3c6', '#2f6f73', '#e8c79a', '#9c3d54', '#f2e3c6', '#e39b4e'];
  for (let i = 0; i < 16; i++) {
    g.fillStyle = cols[i % cols.length];
    g.beginPath(); g.arc(512, 512, 510 - i * 30, 0, Math.PI * 2); g.fill();
  }
  const r = rng(3);
  for (let i = 0; i < 40000; i++) {
    const a = r() * Math.PI * 2, d = r() * 510;
    g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.06)';
    g.fillRect(512 + Math.cos(a) * d, 512 + Math.sin(a) * d, 2, 2);
  }
  for (let i = 0; i < 64; i++) { // tassel ticks
    const a = (i / 64) * Math.PI * 2;
    g.strokeStyle = 'rgba(80,30,20,.35)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(512 + Math.cos(a) * 420, 512 + Math.sin(a) * 420); g.lineTo(512 + Math.cos(a) * 450, 512 + Math.sin(a) * 450); g.stroke();
  }
  return tex(c);
}

/* ---------- fabric noise (couch) ---------- */
export function fabric(hex = '#c3536b') {
  const [c, g] = mk(256, 256);
  g.fillStyle = hex; g.fillRect(0, 0, 256, 256);
  const r = rng(9);
  for (let y = 0; y < 256; y += 2) { g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`; g.fillRect(0, y, 256, 1); }
  for (let x = 0; x < 256; x += 2) { g.fillStyle = `rgba(255,255,255,${r() * 0.04})`; g.fillRect(x, 0, 1, 256); }
  return tex(c, { repeat: [3, 3] });
}

/* ---------- night city seen through the window ---------- */
export function city() {
  const W = 2048, H = 1024;
  const [c, g] = mk(W, H);
  const r = rng(21);
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0b0a24'); sky.addColorStop(0.45, '#2a1a4a'); sky.addColorStop(0.8, '#6b2e5e'); sky.addColorStop(1, '#c2577a');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // moon
  const mx = W * 0.72, my = H * 0.2;
  let grd = g.createRadialGradient(mx, my, 10, mx, my, 260);
  grd.addColorStop(0, 'rgba(255,240,220,.55)'); grd.addColorStop(1, 'rgba(255,240,220,0)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff4e2'; g.beginPath(); g.arc(mx, my, 46, 0, 7); g.fill();
  // clouds
  for (let i = 0; i < 26; i++) {
    const x = r() * W, y = r() * H * 0.45, w = 200 + r() * 420;
    grd = g.createRadialGradient(x, y, 5, x, y, w * 0.5);
    grd.addColorStop(0, 'rgba(140,90,160,.18)'); grd.addColorStop(1, 'rgba(140,90,160,0)');
    g.fillStyle = grd; g.beginPath(); g.ellipse(x, y, w * 0.5, w * 0.12, 0, 0, 7); g.fill();
  }
  // skyline layers
  const layer = (base, minH, maxH, col, winP, winCols) => {
    let x = 0;
    while (x < W) {
      const w = 50 + r() * 130, h = minH + r() * (maxH - minH);
      g.fillStyle = col; g.fillRect(x, H - base - h, w, h + base);
      if (r() < 0.25) g.fillRect(x + w * 0.4, H - base - h - 40, 4, 40); // antenna
      for (let wy = H - base - h + 12; wy < H - 20; wy += 16) {
        for (let wx = x + 8; wx < x + w - 8; wx += 12) {
          if (r() < winP) { g.fillStyle = winCols[(r() * winCols.length) | 0]; g.fillRect(wx, wy, 6, 8); }
        }
      }
      g.fillStyle = col;
      x += w + r() * 10;
    }
  };
  layer(0, 160, 420, '#24163a', 0.16, ['rgba(255,190,120,.55)', 'rgba(255,150,190,.45)']);
  layer(0, 80, 300, '#160d26', 0.26, ['#ffcf8a', '#ffd9a8', '#ff9db5', '#9fe3ff']);
  // neon signs
  const signs = [['#ff4f7b', 'BAR'], ['#5fd4cf', '24H'], ['#ffc56b', 'RAMEN'], ['#c6a2ff', 'HOTEL']];
  g.font = 'bold 34px Inter, sans-serif';
  signs.forEach(([col, t], i) => {
    const x = 180 + i * 470 + r() * 120, y = H - 160 - r() * 160;
    g.shadowColor = col; g.shadowBlur = 24; g.fillStyle = col; g.fillText(t, x, y);
  });
  g.shadowBlur = 0;
  // street glow
  grd = g.createLinearGradient(0, H - 140, 0, H);
  grd.addColorStop(0, 'rgba(255,120,150,0)'); grd.addColorStop(1, 'rgba(255,140,120,.35)');
  g.fillStyle = grd; g.fillRect(0, H - 140, W, 140);
  return tex(c);
}

/* ---------- neon sign "nook" (Pacifico script) ---------- */
export function neon(text = 'Vibes', color = '#ff4f7b') {
  const [c, g] = mk(1024, 420);
  g.clearRect(0, 0, 1024, 420);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '200px Pacifico, cursive';
  g.lineJoin = 'round';
  // glow passes
  g.shadowColor = color;
  for (const [blur, a] of [[60, 0.6], [30, 0.8]]) {
    g.shadowBlur = blur; g.strokeStyle = color; g.globalAlpha = a; g.lineWidth = 14; g.strokeText(text, 512, 190);
  }
  g.globalAlpha = 1; g.shadowBlur = 12; g.lineWidth = 10; g.strokeStyle = color; g.strokeText(text, 512, 190);
  g.shadowBlur = 0; g.lineWidth = 3.5; g.strokeStyle = '#ffe6ee'; g.strokeText(text, 512, 190);
  // underline swash + heart
  g.lineWidth = 9; g.strokeStyle = color; g.shadowColor = color; g.shadowBlur = 20;
  g.beginPath(); g.moveTo(250, 330); g.bezierCurveTo(420, 300, 620, 300, 760, 326); g.stroke();
  g.shadowBlur = 0; g.lineWidth = 3; g.strokeStyle = '#ffe6ee'; g.stroke();
  return tex(c, { mips: false });
}

/* ---------- framed posters ---------- */
export function poster(kind = 0) {
  const [c, g] = mk(512, 700);
  const r = rng(40 + kind);
  if (kind === 0) {
    const grd = g.createLinearGradient(0, 0, 0, 700);
    grd.addColorStop(0, '#2b1a4f'); grd.addColorStop(0.55, '#ff7a6b'); grd.addColorStop(1, '#ffc56b');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 700);
    g.fillStyle = '#ffe4a8'; g.beginPath(); g.arc(256, 380, 130, Math.PI, 0); g.fill();
    g.fillStyle = '#2b1a4f';
    for (let i = 0; i < 6; i++) g.fillRect(126, 300 + i * 18, 260, 6 + i * 1.5);
    g.fillStyle = '#1b1030'; g.fillRect(0, 380, 512, 320);
    g.fillStyle = '#fff3df'; g.font = 'italic 600 64px Fraunces, serif'; g.textAlign = 'center';
    g.fillText('Sundown', 256, 520);
    g.font = '500 20px Inter, sans-serif'; g.fillStyle = '#ff9db5'; g.fillText('L O - F I   S E S S I O N S', 256, 570);
  } else if (kind === 1) {
    g.fillStyle = '#16323a'; g.fillRect(0, 0, 512, 700);
    for (let i = 0; i < 9; i++) {
      g.strokeStyle = i % 2 ? '#5fd4cf' : '#ff9db5'; g.lineWidth = 10;
      g.beginPath(); g.arc(256, 300, 40 + i * 22, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = '#f2e3c6'; g.font = '600 56px Fraunces, serif'; g.textAlign = 'center'; g.fillText('84 BPM', 256, 600);
  } else {
    g.fillStyle = '#f2e3c6'; g.fillRect(0, 0, 512, 700);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = ['#ff4f7b', '#2f6f73', '#ffc56b', '#3b2552'][i % 4];
      g.beginPath(); g.arc(r() * 512, r() * 520, 20 + r() * 70, 0, 7); g.fill();
    }
    g.fillStyle = '#3b2552'; g.font = 'italic 500 60px Fraunces, serif'; g.textAlign = 'center'; g.fillText('slow days', 256, 630);
  }
  return tex(c);
}

/* ---------- vinyl record label + album covers ---------- */
export function record() {
  const [c, g] = mk(512, 512);
  g.fillStyle = '#0d0a12'; g.beginPath(); g.arc(256, 256, 256, 0, 7); g.fill();
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.02 + (i % 3) * 0.015})`; g.lineWidth = 1;
    g.beginPath(); g.arc(256, 256, 100 + i * 2.2, 0, 7); g.stroke();
  }
  // sheen
  const grd = g.createConicGradient ? g.createConicGradient(0, 256, 256) : null;
  if (grd) {
    grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.1, 'rgba(255,255,255,.12)'); grd.addColorStop(0.2, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0)'); grd.addColorStop(0.6, 'rgba(255,255,255,.12)'); grd.addColorStop(0.7, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill();
  }
  g.fillStyle = '#ff4f7b'; g.beginPath(); g.arc(256, 256, 84, 0, 7); g.fill();
  g.fillStyle = '#ffc56b'; g.beginPath(); g.arc(256, 256, 84, -0.6, 0.9); g.lineTo(256, 256); g.fill();
  g.fillStyle = '#fff3df'; g.font = 'italic 600 30px Fraunces, serif'; g.textAlign = 'center'; g.fillText('Vibes', 256, 240);
  g.fillStyle = '#111'; g.beginPath(); g.arc(256, 256, 6, 0, 7); g.fill();
  return tex(c);
}

export function cover(i) {
  const [c, g] = mk(256, 256);
  const pal = [['#ff4f7b', '#ffc56b'], ['#2f6f73', '#f2e3c6'], ['#6a4c93', '#ff9db5'], ['#e39b4e', '#3b2552'], ['#5fd4cf', '#16323a']][i % 5];
  g.fillStyle = pal[0]; g.fillRect(0, 0, 256, 256);
  g.fillStyle = pal[1];
  if (i % 2) { g.beginPath(); g.arc(128, 128, 70, 0, 7); g.fill(); }
  else { for (let k = 0; k < 6; k++) g.fillRect(0, 30 + k * 36, 256, 14); }
  return tex(c);
}

/* ---------- soft round sprite for particles / glows ---------- */
export function softDot() {
  const [c, g] = mk(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return tex(c, { mips: false });
}
