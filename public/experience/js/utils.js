/* =========================================================
   nook.fm — math helpers + monotone keyframe track engine
   ========================================================= */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const TAU = Math.PI * 2;

const safeStorage = (name) => ({
  getItem(key) { try { return window[name].getItem(key); } catch { return null; } },
  setItem(key, value) { try { window[name].setItem(key, value); } catch { /* Storage may be blocked in private or embedded browsers. */ } },
});
export const safeLocal = safeStorage('localStorage');
export const safeSession = safeStorage('sessionStorage');
export function storedArray(key) {
  try { const value = JSON.parse(safeLocal.getItem(key) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}

export function rng(seed = 1) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Cheap smooth 1D value noise */
export function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const h = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

/* ---------------------------------------------------------
   SmoothDamp — critically damped spring (Game Programming Gems 4).
   Unlike exponential lerp it starts with zero acceleration and
   carries velocity across goal changes → "waterflow" motion.
   One instance holds velocities for n channels.
   --------------------------------------------------------- */
export class SmoothDamp {
  constructor(n = 1) { this.vel = new Float64Array(n); }
  reset() { this.vel.fill(0); }
  step(cur, target, i, smoothTime, dt) {
    if (dt <= 0) return cur;
    const st = Math.max(1e-4, smoothTime);
    const omega = 2 / st, x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = cur - target;
    const temp = (this.vel[i] + omega * change) * dt;
    this.vel[i] = (this.vel[i] - omega * temp) * exp;
    let out = target + (change + temp) * exp;
    if ((target - cur > 0) === (out > target)) { out = target; this.vel[i] = 0; }
    return out;
  }
  vec3(v, goal, offset, smoothTime, dt) {
    v.x = this.step(v.x, goal.x, offset, smoothTime, dt);
    v.y = this.step(v.y, goal.y, offset + 1, smoothTime, dt);
    v.z = this.step(v.z, goal.z, offset + 2, smoothTime, dt);
    return v;
  }
}

/* ---------------------------------------------------------
   Track: keyframes [[time, value], ...]
   Fritsch–Butland monotone cubic Hermite → smooth velocity,
   never overshoots, holds are perfectly still.
   --------------------------------------------------------- */
export class Track {
  constructor(keys) {
    this.t = keys.map((k) => k[0]);
    this.v = keys.map((k) => k[1]);
    const n = keys.length;
    this.m = new Array(n).fill(0);
    for (let k = 1; k < n - 1; k++) {
      const h0 = this.t[k] - this.t[k - 1], h1 = this.t[k + 1] - this.t[k];
      const d0 = (this.v[k] - this.v[k - 1]) / h0, d1 = (this.v[k + 1] - this.v[k]) / h1;
      if (d0 * d1 <= 0) { this.m[k] = 0; continue; }
      this.m[k] = (3 * (h0 + h1)) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
    }
  }
  sample(time) {
    const T = this.t, V = this.v, n = T.length;
    if (n === 1 || time <= T[0]) return V[0];
    if (time >= T[n - 1]) return V[n - 1];
    let i = 0;
    while (i < n - 2 && time > T[i + 1]) i++;
    const h = T[i + 1] - T[i];
    const s = (time - T[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * V[i] + (s3 - 2 * s2 + s) * h * this.m[i] +
      (-2 * s3 + 3 * s2) * V[i + 1] + (s3 - s2) * h * this.m[i + 1];
  }
}

export class Timeline {
  constructor(defs) {
    this.tracks = {};
    for (const k in defs) this.tracks[k] = new Track(defs[k]);
  }
  get(name, time, fallback = 0) {
    const tr = this.tracks[name];
    return tr ? tr.sample(time) : fallback;
  }
}
