/* =========================================================
   nook.fm — procedural lo-fi engine (Web Audio, zero samples)
   - 84 BPM swung beat: kick / snare / hats / bass / EP chords / plucks
   - tape wow (modulated delay), vinyl crackle, rain bed, reverb
   - "headphones on" moment: muffled → full-range filter sweep
   - every musical event is locked to the visual timeline grid
   ========================================================= */

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Fmaj9 → Em9 → Dm9 → Cmaj9  (one chord per bar)
const PROG = [
  { bass: 41, notes: [57, 60, 64, 67] },
  { bass: 40, notes: [55, 59, 62, 66] },
  { bass: 38, notes: [53, 57, 60, 64] },
  { bass: 36, notes: [52, 55, 59, 62] },
];
const PENTA = [72, 74, 76, 79, 81, 84];

// tiny deterministic hash so the groove is identical every loop
const hash = (n) => { const s = Math.sin(n * 91.345 + 17.17) * 43758.5453; return s - Math.floor(s); };

export class LofiAudio {
  constructor({ bpm = 84, musicStart = 0 } = {}) {
    this.bpm = bpm;
    this.beat = 60 / bpm;
    this.step = this.beat / 4;
    this.musicStart = musicStart;
    this.ctx = null;
    this.enabled = false;
    this.nextStep = 0;
    this.off = null;
    this.musicLive = false;
  }

  /* ---------------- graph ---------------- */
  _init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('Web Audio unsupported');
    const c = (this.ctx = new AC());

    this.master = c.createGain(); this.master.gain.value = 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3.2; comp.attack.value = 0.006; comp.release.value = 0.22;
    this.master.connect(comp); comp.connect(c.destination);
    this.analyser = c.createAnalyser(); this.analyser.fftSize = 128; this.analyser.smoothingTimeConstant = 0.78;
    comp.connect(this.analyser);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);

    // shared noise
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;

    // reverb
    this.verb = c.createConvolver(); this.verb.buffer = this._impulse(2.6, 3.2);
    this.verbIn = c.createGain(); this.verbIn.gain.value = 0.32;
    this.verbIn.connect(this.verb); this.verb.connect(this.master);

    // music bus → tape wow → headphone lowpass → out
    this.music = c.createGain(); this.music.gain.value = 0.9;
    const wowDelay = c.createDelay(0.05); wowDelay.delayTime.value = 0.012;
    const wow = c.createOscillator(); wow.frequency.value = 0.42;
    const wowAmt = c.createGain(); wowAmt.gain.value = 0.0011;
    wow.connect(wowAmt); wowAmt.connect(wowDelay.delayTime); wow.start();
    const flutter = c.createOscillator(); flutter.frequency.value = 6.3;
    const flAmt = c.createGain(); flAmt.gain.value = 0.00012;
    flutter.connect(flAmt); flAmt.connect(wowDelay.delayTime); flutter.start();
    const warm = c.createBiquadFilter(); warm.type = 'highshelf'; warm.frequency.value = 6500; warm.gain.value = -7;
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 380; this.lp.Q.value = 0.9;
    this.musicOut = c.createGain(); this.musicOut.gain.value = 0;
    this.wowDelay = wowDelay; // REANIMATED Part 2: turntable pitch dip
    this.music.connect(wowDelay); wowDelay.connect(warm); warm.connect(this.lp); this.lp.connect(this.musicOut);
    this.musicOut.connect(this.master); this.musicOut.connect(this.verbIn);

    // sfx bus
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.85; this.sfxBus.connect(this.master);
    this.sfxVerb = c.createGain(); this.sfxVerb.gain.value = 0.5; this.sfxBus.connect(this.sfxVerb); this.sfxVerb.connect(this.verbIn);

    // rain bed (brown noise, looped)
    const rb = c.createBuffer(2, c.sampleRate * 4, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = rb.getChannelData(ch); let last = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.035 * w) / 1.035; d[i] = last * 3.2 + w * 0.06; }
    }
    this.rain = c.createBufferSource(); this.rain.buffer = rb; this.rain.loop = true;
    this.rainLP = c.createBiquadFilter(); this.rainLP.type = 'lowpass'; this.rainLP.frequency.value = 2600;
    const rainHP = c.createBiquadFilter(); rainHP.type = 'highpass'; rainHP.frequency.value = 160;
    this.rainGain = c.createGain(); this.rainGain.gain.value = 0.34;
    this.rain.connect(rainHP); rainHP.connect(this.rainLP); this.rainLP.connect(this.rainGain); this.rainGain.connect(this.master);
    this.rain.start();

    // vinyl crackle (sparse impulses)
    const cb = c.createBuffer(1, c.sampleRate * 5, c.sampleRate);
    const cd = cb.getChannelData(0);
    for (let i = 0; i < cd.length; i++) {
      const r = Math.random();
      cd[i] = r < 0.0009 ? (Math.random() * 2 - 1) * (0.4 + Math.random() * 0.6) : r < 0.0011 ? (Math.random() * 2 - 1) * 1.4 : (Math.random() * 2 - 1) * 0.012;
    }
    this.crackle = c.createBufferSource(); this.crackle.buffer = cb; this.crackle.loop = true;
    const chp = c.createBiquadFilter(); chp.type = 'highpass'; chp.frequency.value = 1200;
    this.crackleGain = c.createGain(); this.crackleGain.gain.value = 0;
    this.crackle.connect(chp); chp.connect(this.crackleGain); this.crackleGain.connect(this.master);
    this.crackle.start();
  }

  _impulse(sec, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  }

  /* ---------------- public ---------------- */
  async enable(tl) {
    if (!this.ctx) this._init();
    if (this.ctx.state !== 'running') await this.ctx.resume();
    this.enabled = true;
    this.off = null;
    this.sync(tl);
    const g = this.master.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0.9, now + 0.6);
  }

  disable() {
    if (!this.ctx) return;
    this.enabled = false;
    const g = this.master.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + 0.35);
  }

  /* static levels for an arbitrary timeline position (after seek / enable) */
  sync(tl) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const live = tl >= this.musicStart;
    this.musicLive = live;
    const set = (p, v) => { p.cancelScheduledValues(now); p.setValueAtTime(v, now); };
    // before the plug-in moment the beat is faintly leaking from the headphones on the table
    set(this.musicOut.gain, live ? 1 : 0.3);
    set(this.lp.frequency, live ? 17000 : 380);
    set(this.rainGain.gain, live ? 0.09 : 0.34);
    set(this.rainLP.frequency, live ? 900 : 2600);
    set(this.crackleGain.gain, live ? 0.06 : 0);
    this.nextStep = Math.ceil((tl - this.musicStart) / this.step);
    this.off = null;
  }

  /* timeline → audio clock (kept stable, re-anchored only on drift) */
  _when(tlTime, tl) {
    const c = this.ctx;
    const off = c.currentTime - tl;
    if (this.off === null || Math.abs(off - this.off) > 0.045) this.off = off;
    return Math.max(c.currentTime, tlTime + this.off);
  }

  update(tl) {
    if (!this.enabled || !this.ctx) return;
    this._when(tl, tl);
    const look = 0.16;
    let guard = 0;
    while (guard++ < 64) {
      const n = this.nextStep;
      const swing = ((n % 2) + 2) % 2 ? this.step * 0.3 : 0;
      const st = this.musicStart + n * this.step + swing;
      if (st > tl + look) break;
      if (st >= tl - 0.03) this._playStep(n, this._when(st, tl));
      this.nextStep++;
    }
  }

  /* "plug in" moment: needle drop + filter sweep, rain ducks */
  plugIn() {
    if (!this.enabled) return;
    const c = this.ctx, t = c.currentTime;
    this.musicLive = true;
    const lin = (p, v, d) => { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + d); };
    lin(this.musicOut.gain, 1, 0.08);
    this.lp.frequency.cancelScheduledValues(t);
    this.lp.frequency.setValueAtTime(380, t);
    this.lp.frequency.exponentialRampToValueAtTime(1800, t + 0.45);
    this.lp.frequency.exponentialRampToValueAtTime(17000, t + 1.4);
    lin(this.rainGain.gain, 0.09, 1.2);
    this.rainLP.frequency.cancelScheduledValues(t);
    this.rainLP.frequency.setValueAtTime(this.rainLP.frequency.value, t);
    this.rainLP.frequency.exponentialRampToValueAtTime(900, t + 0.8);
    lin(this.crackleGain.gain, 0.06, 0.3);
    this._whoosh(t - 0.05);
    this._needle(t);
  }

  level() {
    if (!this.enabled || !this.ctx) return null;
    this.analyser.getByteFrequencyData(this.freq);
    return this.freq;
  }

  /* ---------------- sequencing ---------------- */
  _playStep(n, when) {
    const s = ((n % 16) + 16) % 16, bar = Math.floor(n / 16), b4 = ((bar % 4) + 4) % 4, ch = PROG[b4];
    const fill = b4 === 3;
    // drums
    if (s === 0 || s === 10 || (s === 7 && hash(bar) > 0.45)) this._kick(when, s === 7 ? 0.55 : 1);
    if (s === 4 || s === 12) this._snare(when, 1);
    if (s === 15 && fill) this._snare(when, 0.35);
    if (s % 2 === 0) this._hat(when, s % 4 === 2 ? 1 : 0.6);
    else if (hash(n * 3.1) > 0.7) this._hat(when, 0.3);
    // bass
    if (s === 0) this._bass(mtof(ch.bass), when, this.beat * 1.6, 1);
    if (s === 7) this._bass(mtof(ch.bass + 12), when, this.beat * 0.4, 0.6);
    if (s === 10) this._bass(mtof(ch.bass + 7), when, this.beat * 1.1, 0.85);
    if (s === 14 && fill) this._bass(mtof(PROG[(b4 + 1) % 4].bass + 1), when, this.beat * 0.45, 0.7);
    // keys
    if (s === 0) ch.notes.forEach((m, i) => this._ep(mtof(m), when + i * 0.018, this.beat * 3.4, 0.9 - i * 0.08));
    if (s === 10 && hash(bar * 7) > 0.35) ch.notes.slice(1).forEach((m, i) => this._ep(mtof(m), when + i * 0.014, this.beat * 1.6, 0.45));
    // melody plucks
    if ((s === 2 || s === 6 || s === 9 || s === 13) && hash(n * 1.7 + 4) > 0.42) {
      const m = PENTA[Math.floor(hash(n * 2.3) * PENTA.length)];
      this._pluck(mtof(m), when, 0.55 + hash(n) * 0.3);
    }
  }

  _env(g, when, peak, a, d) {
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + a);
    g.gain.exponentialRampToValueAtTime(0.0001, when + a + d);
  }

  _kick(when, v) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, when); o.frequency.exponentialRampToValueAtTime(44, when + 0.13);
    this._env(g, when, 0.95 * v, 0.004, 0.34);
    o.connect(g); g.connect(this.music); o.start(when); o.stop(when + 0.4);
    // beater click
    const n = c.createBufferSource(); n.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    const ng = c.createGain(); this._env(ng, when, 0.12 * v, 0.001, 0.025);
    n.connect(f); f.connect(ng); ng.connect(this.music); n.start(when, Math.random()); n.stop(when + 0.05);
  }

  _snare(when, v) {
    const c = this.ctx;
    const n = c.createBufferSource(); n.buffer = this.noise;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
    const g = c.createGain(); this._env(g, when, 0.34 * v, 0.002, 0.2);
    n.connect(bp); bp.connect(g); g.connect(this.music); g.connect(this.verbIn);
    n.start(when, Math.random()); n.stop(when + 0.3);
    const o = c.createOscillator(), og = c.createGain(); o.type = 'triangle';
    o.frequency.setValueAtTime(210, when); o.frequency.exponentialRampToValueAtTime(150, when + 0.08);
    this._env(og, when, 0.16 * v, 0.002, 0.09);
    o.connect(og); og.connect(this.music); o.start(when); o.stop(when + 0.15);
  }

  _hat(when, v) {
    const c = this.ctx, n = c.createBufferSource(); n.buffer = this.noise;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7200;
    const g = c.createGain(); this._env(g, when, 0.065 * v, 0.001, 0.045);
    n.connect(hp); hp.connect(g); g.connect(this.music); n.start(when, Math.random()); n.stop(when + 0.08);
  }

  _bass(f, when, dur, v) {
    const c = this.ctx, o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.value = 420;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.3 * v, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.16 * v, when + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(lp); lp.connect(g); g.connect(this.music); o.start(when); o.stop(when + dur + 0.05);
  }

  _ep(f, when, dur, v) {
    const c = this.ctx;
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.type = 'sine'; car.frequency.value = f;
    mod.type = 'sine'; mod.frequency.value = f;
    mg.gain.setValueAtTime(f * 1.1 * v, when); mg.gain.exponentialRampToValueAtTime(f * 0.08, when + 0.7);
    mod.connect(mg); mg.connect(car.frequency);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.075 * v, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.03 * v, when + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    car.connect(g); g.connect(this.music);
    car.start(when); mod.start(when); car.stop(when + dur + 0.05); mod.stop(when + dur + 0.05);
  }

  _pluck(f, when, v) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f * 2.001;
    const g2 = c.createGain(); g2.gain.value = 0.25;
    this._env(g, when, 0.06 * v, 0.004, 0.7);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.music); g.connect(this.verbIn);
    o.start(when); o2.start(when); o.stop(when + 0.8); o2.stop(when + 0.8);
  }

  /* ---------------- sfx ---------------- */
  sfx(name, opt = {}) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + (opt.delay || 0);
    const fn = this['_' + name];
    if (fn) fn.call(this, t, opt);
  }

  _noiseHit(when, { type = 'lowpass', freq = 800, q = 0.7, peak = 0.3, a = 0.002, d = 0.1, dest = this.sfxBus }) {
    const c = this.ctx, n = c.createBufferSource(); n.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); this._env(g, when, peak, a, d);
    n.connect(f); f.connect(g); g.connect(dest); n.start(when, Math.random()); n.stop(when + a + d + 0.05);
    return f;
  }

  _step(when, { v = 1 } = {}) {
    this._noiseHit(when, { freq: 520, peak: 0.16 * v, d: 0.09 });
    this._noiseHit(when + 0.01, { type: 'highpass', freq: 3000, peak: 0.025 * v, d: 0.03 });
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(90, when); o.frequency.exponentialRampToValueAtTime(50, when + 0.08);
    this._env(g, when, 0.18 * v, 0.003, 0.1); o.connect(g); g.connect(this.sfxBus); o.start(when); o.stop(when + 0.15);
  }

  _creak(when) {
    const c = this.ctx, o = c.createOscillator(), lfo = c.createOscillator(), la = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(140, when); o.frequency.linearRampToValueAtTime(210, when + 0.9);
    lfo.frequency.value = 23; la.gain.value = 18; lfo.connect(la); la.connect(o.frequency);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 9;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.05, when + 0.15);
    g.gain.linearRampToValueAtTime(0.035, when + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, when + 1.1);
    o.connect(bp); bp.connect(g); g.connect(this.sfxBus);
    o.start(when); lfo.start(when); o.stop(when + 1.2); lfo.stop(when + 1.2);
    this._click(when - 0.05, { v: 0.8 });
  }

  _click(when, { v = 1 } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(2400, when); o.frequency.exponentialRampToValueAtTime(900, when + 0.012);
    this._env(g, when, 0.06 * v, 0.0005, 0.018); o.connect(g); g.connect(this.sfxBus); o.start(when); o.stop(when + 0.04);
    this._noiseHit(when, { type: 'highpass', freq: 4000, peak: 0.05 * v, d: 0.015 });
  }

  _grab(when) {
    this._click(when, { v: 0.6 });
    this._click(when + 0.06, { v: 0.35 });
    this._noiseHit(when, { type: 'bandpass', freq: 1200, q: 2, peak: 0.06, d: 0.12 });
  }

  _whoosh(when) {
    const f = this._noiseHit(when, { type: 'bandpass', freq: 300, q: 1.6, peak: 0.22, a: 0.45, d: 0.7 });
    f.frequency.setValueAtTime(300, when); f.frequency.exponentialRampToValueAtTime(5200, when + 0.9);
  }

  _needle(when) {
    this._noiseHit(when, { freq: 300, peak: 0.25, d: 0.12 });
    this._noiseHit(when + 0.02, { type: 'highpass', freq: 2500, peak: 0.12, d: 0.05 });
  }

  _poof(when) {
    this._noiseHit(when, { freq: 650, peak: 0.28, a: 0.01, d: 0.28 });
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(95, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.2);
    this._env(g, when, 0.3, 0.005, 0.24); o.connect(g); g.connect(this.sfxBus); o.start(when); o.stop(when + 0.3);
  }

  _thunder(when, { k = 1 } = {}) {
    this._noiseHit(when, { type: 'highpass', freq: 1800, peak: 0.08 * k, a: 0.005, d: 0.25 });
    const f = this._noiseHit(when + 0.05, { freq: 260, q: 0.5, peak: 0.7 * k, a: 0.12, d: 3.2 });
    f.frequency.setValueAtTime(260, when); f.frequency.exponentialRampToValueAtTime(70, when + 3);
  }

  _purr(when) {
    const c = this.ctx, o = c.createOscillator(), am = c.createOscillator(), amg = c.createGain(), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = 27;
    am.frequency.value = 27; amg.gain.value = 0.5; am.connect(amg);
    lp.type = 'lowpass'; lp.frequency.value = 420;
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.2, when + 0.2);
    g.gain.setValueAtTime(0.2, when + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, when + 1.9);
    amg.connect(g.gain);
    o.connect(lp); lp.connect(g); g.connect(this.sfxBus);
    o.start(when); am.start(when); o.stop(when + 2); am.stop(when + 2);
    // little chirp
    const ch = c.createOscillator(), cg = c.createGain(), bp = c.createBiquadFilter();
    ch.type = 'triangle';
    ch.frequency.setValueAtTime(620, when); ch.frequency.linearRampToValueAtTime(980, when + 0.12); ch.frequency.linearRampToValueAtTime(700, when + 0.28);
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.5;
    this._env(cg, when, 0.07, 0.02, 0.3);
    ch.connect(bp); bp.connect(cg); cg.connect(this.sfxBus); ch.start(when); ch.stop(when + 0.4);
  }

  _scratch(when) {
    const f = this._noiseHit(when, { type: 'bandpass', freq: 900, q: 4, peak: 0.18, a: 0.01, d: 0.25 });
    f.frequency.setValueAtTime(600, when); f.frequency.linearRampToValueAtTime(2600, when + 0.09); f.frequency.linearRampToValueAtTime(700, when + 0.22);
  }

  /* ---------------- REANIMATED Part 2: object reaction sfx ---------------- */
  // tape-stop style wobble: ramping the wow delay bends the pitch down, then back up
  dip() {
    if (!this.enabled || !this.ctx || !this.wowDelay) return;
    const t = this.ctx.currentTime, d = this.wowDelay.delayTime;
    d.cancelScheduledValues(t); d.setValueAtTime(0.012, t);
    d.linearRampToValueAtTime(0.036, t + 0.22); d.linearRampToValueAtTime(0.012, t + 0.62);
  }

  _meow(when) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), bp = c.createBiquadFilter(), g = c.createGain();
    const vib = c.createOscillator(), vg = c.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    [o, o2].forEach((x, i) => {
      const k = i ? 1.004 : 1;
      x.frequency.setValueAtTime(520 * k, when); x.frequency.linearRampToValueAtTime(780 * k, when + 0.16);
      x.frequency.exponentialRampToValueAtTime(420 * k, when + 0.62);
    });
    vib.frequency.value = 7; vg.gain.value = 14; vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    bp.type = 'bandpass'; bp.Q.value = 3.5;
    bp.frequency.setValueAtTime(800, when); bp.frequency.linearRampToValueAtTime(1900, when + 0.2); bp.frequency.exponentialRampToValueAtTime(700, when + 0.6);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.07, when + 0.06);
    g.gain.setValueAtTime(0.07, when + 0.32); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.68);
    const g2 = c.createGain(); g2.gain.value = 0.35;
    o.connect(bp); o2.connect(g2); g2.connect(bp); bp.connect(g); g.connect(this.sfxBus);
    [o, o2, vib].forEach((x) => { x.start(when); x.stop(when + 0.72); });
  }

  _buzz(when) {
    const c = this.ctx, o = c.createOscillator(), hp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = 120;
    hp.type = 'highpass'; hp.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, when);
    for (let i = 0; i < 7; i++) { const s = when + i * 0.045; g.gain.setValueAtTime(i % 2 ? 0.004 : 0.05, s); }
    g.gain.setValueAtTime(0.03, when + 0.32); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.6);
    o.connect(hp); hp.connect(g); g.connect(this.sfxBus); o.start(when); o.stop(when + 0.62);
  }

  _knock(when) {
    [0, 0.17, 0.31].forEach((d, i) => {
      const w = when + d, v = i === 2 ? 0.75 : 1;
      this._noiseHit(w, { freq: 380, peak: 0.32 * v, d: 0.07 });
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(140, w); o.frequency.exponentialRampToValueAtTime(70, w + 0.08);
      this._env(g, w, 0.28 * v, 0.002, 0.1); o.connect(g); g.connect(this.sfxBus); o.start(w); o.stop(w + 0.14);
    });
  }

  _rustle(when) {
    for (let i = 0; i < 5; i++) this._noiseHit(when + i * 0.07 + Math.random() * 0.04, { type: 'bandpass', freq: 2600 + Math.random() * 2400, q: 0.9, peak: 0.05, a: 0.02, d: 0.12 + Math.random() * 0.1 });
  }

  _slide(when) {
    const f = this._noiseHit(when, { type: 'bandpass', freq: 900, q: 1.4, peak: 0.07, a: 0.14, d: 0.32 });
    f.frequency.setValueAtTime(800, when); f.frequency.linearRampToValueAtTime(1900, when + 0.4);
    this._click(when + 0.48, { v: 0.35 });
  }

  _hiss(when) {
    this._noiseHit(when, { type: 'highpass', freq: 2600, peak: 0.06, a: 0.08, d: 0.9 });
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = 2350;
    this._env(g, when, 0.035, 0.002, 0.4); o.connect(g); g.connect(this.sfxBus); o.start(when); o.stop(when + 0.45);
  }

  _thump(when) {
    [0, 0.13, 0.26].forEach((d, i) => {
      const w = when + d, c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(75, w); o.frequency.exponentialRampToValueAtTime(38, w + 0.16);
      this._env(g, w, 0.42 * Math.pow(0.6, i), 0.004, 0.2); o.connect(g); g.connect(this.sfxBus); o.start(w); o.stop(w + 0.24);
    });
  }

  _clink(when) {
    const c = this.ctx;
    [1760, 2690, 4120].forEach((fr, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.value = fr;
      this._env(g, when, 0.03 / (i + 1), 0.002, 0.9 - i * 0.2); o.connect(g); g.connect(this.sfxBus); o.start(when); o.stop(when + 1);
    });
  }

  _swish(when) {
    const f = this._noiseHit(when, { type: 'bandpass', freq: 600, q: 0.8, peak: 0.09, a: 0.22, d: 0.45 });
    f.frequency.setValueAtTime(500, when); f.frequency.exponentialRampToValueAtTime(2600, when + 0.5);
  }

  _tap(when) {
    this._noiseHit(when, { freq: 1100, peak: 0.12, d: 0.045 });
    this._noiseHit(when + 0.09, { freq: 900, peak: 0.06, d: 0.04 });
  }
}
