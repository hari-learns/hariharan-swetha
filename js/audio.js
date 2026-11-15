// All sound is made in the browser: no audio files. A quiet drone and a slow plucked melody in
// Mohanam (the five-note raga of auspicious beginnings), plus a few soft effects for the opening.

const TONIC = 293.66;                         // D4 is Sa
const semi = (n) => TONIC * Math.pow(2, n / 12);
const BEAT = 0.82;

// Sa Ri Ga Pa Dha = 0 2 4 7 9 semitones. [semitone, beats]
const PHRASES = [
  [[4, 1], [7, 1], [9, 1], [12, 2], [9, 1], [7, 1], [4, 2]],
  [[12, 1], [9, 1], [7, 1], [4, 1], [2, 1], [0, 3]],
  [[4, 1], [2, 1], [0, 1], [-3, 1], [0, 1], [2, 1], [4, 2]],
  [[7, 1], [4, 1], [2, 1], [4, 1], [7, 1], [9, 1], [7, 2]],
  [[9, 1], [12, 1], [14, 1], [12, 1], [9, 1], [7, 1], [4, 2]],
  [[0, 1], [2, 1], [4, 1], [7, 2], [4, 1], [2, 1], [0, 3]],
  [[12, 2], [9, 1], [12, 1], [14, 1], [16, 2], [14, 1], [12, 3]],
];

export class Sound {
  constructor() { this.ctx = null; this.on = false; this.musicOn = false; this.last = -1; this.prev = null; }

  get available() { return !!(window.AudioContext || window.webkitAudioContext); }

  ensure() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.music = ctx.createGain(); this.music.gain.value = 0; this.music.connect(this.master);
    this.fx = ctx.createGain(); this.fx.gain.value = 0.9; this.fx.connect(this.master);
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(3.2, 2.4);
    const wet = ctx.createGain(); wet.gain.value = 0.4;
    this.verb.connect(wet); wet.connect(this.master);
    this.send = ctx.createGain(); this.send.gain.value = 1; this.send.connect(this.verb);
    const len = ctx.sampleRate * 2, nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else if (this.on) this.ctx.resume();
    });
    return true;
  }

  // A soft hall: filtered noise that dies away.
  impulse(seconds, decay) {
    const ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * seconds), buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len, n = Math.random() * 2 - 1;
        lp += (n - lp) * (0.5 - 0.38 * t);
        d[i] = lp * Math.pow(1 - t, decay) * Math.min(1, i / (rate * 0.012));
      }
    }
    return buf;
  }

  async enable() {
    if (!this.ensure()) return false;
    try { await this.ctx.resume(); } catch (e) { console.warn('[sound] could not start:', e); return false; }
    this.on = true;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.85, t + 0.25);
    return true;
  }

  disable() {
    if (!this.ctx) return;
    this.on = false;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + 0.3);
    setTimeout(() => { if (!this.on && this.ctx) this.ctx.suspend(); }, 420);
  }

  /* ── voices ── */

  pluck(freq, when, o = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = Math.max(when, ctx.currentTime + 0.005);
    const dur = o.dur || 2.6, vel = o.vel || 0.18, bus = o.bus || this.music;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator();
    const g = ctx.createGain(), g2 = ctx.createGain(), lg = ctx.createGain(), f = ctx.createBiquadFilter();
    o1.type = 'triangle'; o2.type = 'sine';
    const setF = (p, mult) => {
      if (o.slide) { p.setValueAtTime(o.slide * mult, t); p.exponentialRampToValueAtTime(freq * mult, t + 0.12); }
      else p.setValueAtTime(freq * mult, t);
    };
    setF(o1.frequency, 1); setF(o2.frequency, 2.004);
    g2.gain.value = 0.3;
    f.type = 'lowpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(Math.min(9000, freq * 7), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(420, freq * 1.5), t + 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.014);
    g.gain.exponentialRampToValueAtTime(vel * 0.4, t + 0.24);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lfo.frequency.value = 5.1;
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(freq * 0.0045, t + 0.55);
    lfo.connect(lg); lg.connect(o1.frequency);
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(bus); g.connect(this.send);
    for (const osc of [o1, o2, lfo]) { osc.start(t); osc.stop(t + dur + 0.06); }
  }

  bell(freq, when, vel = 0.12, dur = 2.6) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = Math.max(when, ctx.currentTime + 0.005);
    [[1, 1, 1], [2.76, 0.42, 0.6], [5.4, 0.2, 0.38], [8.93, 0.09, 0.22]].forEach(([m, a, life]) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq * m;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * a, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * life);
      osc.connect(g); g.connect(this.fx); g.connect(this.send);
      osc.start(t); osc.stop(t + dur * life + 0.05);
    });
  }

  whoosh(when, dur, f0, f1, vel, type = 'bandpass') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = Math.max(when, ctx.currentTime + 0.005);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; src.loop = true;
    f.type = type; f.Q.value = 0.8;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + dur * 0.42);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.fx); g.connect(this.send);
    src.start(t); src.stop(t + dur + 0.05);
  }

  thud(when, vel = 0.4) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = Math.max(when, ctx.currentTime + 0.005);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(58, t + 0.16);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    osc.connect(g); g.connect(this.fx);
    osc.start(t); osc.stop(t + 0.3);
  }

  /* ── moments ── */

  play(name) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime + 0.01;
    if (name === 'press') {
      this.thud(t, 0.32);
      this.whoosh(t, 0.07, 3200, 5200, 0.07, 'highpass');
      [0, 7, 12].forEach((s, i) => this.bell(semi(s + 12), t + 0.05 + i * 0.085, 0.085, 2.4));
    } else if (name === 'doors') {
      this.whoosh(t, 1.7, 180, 620, 0.2);
      this.whoosh(t + 0.1, 1.5, 900, 1700, 0.035);
    } else if (name === 'curtain') {
      this.whoosh(t, 2.7, 700, 2600, 0.06);
      [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24].forEach((s, i) => this.pluck(semi(s), t + 0.25 + i * 0.125, { vel: 0.085 + i * 0.004, dur: 2.4, bus: this.fx }));
    } else if (name === 'reveal') {
      [0, 7, 12, 16].forEach((s, i) => this.bell(semi(s), t + i * 0.16, 0.06, 3.2));
    } else if (name === 'sparkle') {
      [24, 19, 28, 21, 31, 24].forEach((s, i) => this.bell(semi(s), t + i * 0.075, 0.05, 1.5));
      [0, 7, 12].forEach((s) => this.bell(semi(s), t + 0.1, 0.07, 3));
    } else if (name === 'petal') {
      const s = [12, 14, 16, 19, 21, 24][Math.floor(Math.random() * 6)];
      this.pluck(semi(s), t, { vel: 0.11, dur: 1.8, bus: this.fx });
    } else if (name === 'tick') {
      this.whoosh(t, 0.05, 2600, 4200, 0.03, 'highpass');
    }
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const ctx = this.ctx, t = ctx.currentTime;
    this.music.gain.setValueAtTime(0.0001, t);
    this.music.gain.exponentialRampToValueAtTime(0.9, t + 4.5);
    // drone: Sa, Pa, Sa, each breathing at its own pace
    [[-12, 0.05, 0.11], [-5, 0.032, 0.07], [0, 0.022, 0.05]].forEach(([s, amp, rate], i) => {
      const osc = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine'; osc.frequency.value = semi(s);
      g.gain.value = amp; lfo.frequency.value = rate; lg.gain.value = amp * 0.55;
      lfo.connect(lg); lg.connect(g.gain);
      osc.connect(g); g.connect(this.music); g.connect(this.send);
      osc.start(); lfo.start();
    });
    this.nextT = t + 1.6;
    this.timer = setInterval(() => this.schedule(), 250);
  }

  schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.on || ctx.state !== 'running') return;
    if (this.nextT < ctx.currentTime) this.nextT = ctx.currentTime + 0.3;
    while (this.nextT < ctx.currentTime + 1.4) {
      let i; do { i = Math.floor(Math.random() * PHRASES.length); } while (i === this.last);
      this.last = i;
      const shift = Math.random() < 0.3 ? -12 : 0;
      for (const [s, beats] of PHRASES[i]) {
        const fq = semi(s + shift);
        const near = this.prev && Math.abs(Math.log2(fq / this.prev)) < 0.3;
        this.pluck(fq, this.nextT, { vel: 0.15 + Math.random() * 0.05, dur: Math.max(2.2, beats * BEAT * 1.9), slide: near && Math.random() < 0.45 ? this.prev : null });
        this.prev = fq;
        this.nextT += beats * BEAT;
      }
      this.nextT += BEAT * 2;
      this.prev = null;
    }
  }
}
