// The opening scene: two embossed doors, a pair of satin curtains strung with gold pearls, and the
// garden stage behind them. One WebGL canvas, drawn back to front:
//   stage (back)  →  fountain droplets  →  curtains + pearls + valance  →  stage (front)  →  doors

import { clamp, lerp, seg, easeInOut } from './util.js';
import { VERT, RELIEF_FRAG, FABRIC_FRAG, POINT_VERT, POINT_FRAG, FLAT_FRAG } from './shaders.js';
import { paintDoor, paintStageBack, paintStageFront } from './art.js';

const GOLD = [0.88, 0.70, 0.40];
const DROP = [0.84, 0.93, 0.94];
const norm = (v) => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };

// Seconds after the tap at which each beat of the opening lands.
export const BEATS = { doors: 1.9, curtain: 2.3, reveal: 4.5, done: 7.2 };

export class Scene {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.s = { door: 0, curtain: 0, press: 0 };
    this.ptr = [0, 0];
    this.ptrS = [0, 0];
    this.t0 = null; this.hold = 0; this.fixedT = null; this.T = null;
    this.fired = {};
    this.time = 0; this.last = 0; this.frame = 0; this.raf = null; this.active = false;
    this.stageReady = false; this.stageToken = 0; this.frontFade = 0;
    this.pts = new Float32Array(7 * 2400);
    this.frontOff = [0, 0];
    this.rs = 1; this.slow = 0; this.slowN = 0; this.drops = 0; this.lastTick = 0;
    this.lite = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || window.innerWidth <= 820;
  }

  /* ── setup ── */

  init() {
    const gl = this.canvas.getContext('webgl', {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return false;
    if (!gl.getExtension('OES_standard_derivatives')) return false;
    this.gl = gl;
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    const prec = hp && hp.precision > 0 ? 'highp' : 'mediump';
    this.pRelief = this.prog(VERT, RELIEF_FRAG(prec, this.lite ? 6 : 10), ['aPos', 'aUv']);
    this.pFabric = this.prog(VERT, FABRIC_FRAG(prec), ['aPos', 'aUv']);
    this.pPoint = this.prog(POINT_VERT, POINT_FRAG, ['aP', 'aC']);
    this.pFlat = this.prog(VERT, FLAT_FRAG, ['aPos', 'aUv']);
    this.qb = gl.createBuffer(); this.qd = new Float32Array(16);
    this.ptBuf = gl.createBuffer();
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
    return true;
  }

  prog(vs, fs, attribs) {
    const gl = this.gl;
    const mk = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh));
      return sh;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }

  tex(canvas, old) {
    const gl = this.gl, t = old || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  layer(art, old) {
    const l = { h: this.tex(art.hC, old && old.h), a: this.tex(art.aC, old && old.a), tw: art.hC.width, th: art.hC.height };
    art.hC.width = art.hC.height = art.aC.width = art.aC.height = 0;   // hand the memory back
    return l;
  }

  // Size everything to the canvas and (re)paint the artwork. Safe to call again on a width change.
  build() {
    const r = this.canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(r.width)), cssH = Math.max(1, Math.round(r.height));
    // phones get a lighter canvas: the artwork is soft relief, so it holds up, and the frame rate matters more
    const weak = this.lite && navigator.deviceMemory && navigator.deviceMemory <= 4;
    let dpr = Math.min(window.devicePixelRatio || 1, weak ? 1.3 : this.lite ? 1.6 : 2);
    const budget = this.lite ? 1.5e6 : 2.4e6;
    if (cssW * cssH * dpr * dpr > budget) dpr = Math.sqrt(budget / (cssW * cssH));
    if (cssH * dpr > this.maxTex) dpr = this.maxTex / cssH;
    this.cssW = cssW; this.cssH = cssH; this.dpr = dpr;
    const W = (this.W = Math.round(cssW * dpr)), H = (this.H = Math.round(cssH * dpr));
    this.canvas.width = Math.round(W * this.rs); this.canvas.height = Math.round(H * this.rs);
    const k = (this.k = W / 390);
    this.gs = clamp(H / W / 1.72, 0.9, 1.28);
    const gardenTop = H - 292 * k * this.gs;
    this.tieY = clamp(gardenTop - 62 * k, 0.34 * H, 0.5 * H);
    this.tailH = Math.min(0.105 * H, 72 * k);

    this.paintDoorNow();
    this.buildCloth();
    this.stageReady = false; this.frontFade = 0;
    const token = ++this.stageToken;
    setTimeout(() => {
      if (token !== this.stageToken) return;
      const b = paintStageBack(W, H, k, this.gs);
      this.meta = b.meta;
      this.back = this.layer(b, this.back);
      setTimeout(() => {
        if (token !== this.stageToken) return;
        const f = paintStageFront(W, H, k, this.gs);
        const top = f.top, flames = f.meta.flames;
        this.front = Object.assign(this.layer(f, this.front), { top });
        this.flames = flames;
        this.stageReady = true;
        if (this.hooks.onStage) this.hooks.onStage(this.flamePositions());
      }, 40);
    }, 80);
  }

  paintDoorNow() {
    if (this.s.door >= 1) return;
    const d = paintDoor(this.W, this.H, this.k, this.hooks.label());
    this.seal = d.seal;
    this.door = this.layer(d, this.door);
    if (this.hooks.onSeal) {
      const q = this.dpr, s = d.seal;
      this.hooks.onSeal({ x: (s.cx - s.rx) / q, y: (s.cy - s.ry) / q, w: (s.rx * 2) / q, h: (s.ry * 2) / q });
    }
  }

  // Where the lamp flames sit, as fractions of the canvas, so the page can lay a glow over each one.
  flamePositions() {
    const sc = 1.035, { W, H } = this;
    return (this.flames || []).map(([x, y]) => [(W / 2 + (x - W / 2) * sc) / W, (H - (H - y) * sc) / H]);
  }

  grid(nu, nv) {
    const gl = this.gl, n = (nu + 1) * (nv + 1);
    const uv = new Float32Array(n * 2), idx = new Uint16Array(nu * nv * 6);
    let p = 0;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { uv[p++] = i / nu; uv[p++] = j / nv; }
    p = 0;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      idx[p++] = a; idx[p++] = b; idx[p++] = c; idx[p++] = b; idx[p++] = d; idx[p++] = c;
    }
    const m = { nu, nv, pos: new Float32Array(n * 2), count: idx.length, pb: gl.createBuffer(), ub: gl.createBuffer(), ib: gl.createBuffer() };
    gl.bindBuffer(gl.ARRAY_BUFFER, m.ub); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    return m;
  }

  buildCloth() {
    const gl = this.gl, { W, H, k } = this;
    if (!this.curt) this.curt = [this.grid(46, 60), this.grid(46, 60)];
    this.clothTau = -1;
    // the valance: three swags across the top, the middle one in front
    const cap = Math.min(1, H / (1.6 * W));
    // the three swags meet exactly under the two rosettes, pinched to the same height, so the cloth reads as one piece
    const dEnd = 0.036 * W * cap;
    const defs = [
      { x0: -0.12 * W, x1: 0.25 * W, dMid: 0.165 * W * cap, dEnd, seed: 2.0 },
      { x0: 0.75 * W, x1: 1.12 * W, dMid: 0.165 * W * cap, dEnd, seed: 5.0 },
      { x0: 0.25 * W, x1: 0.75 * W, dMid: 0.19 * W * cap, dEnd, seed: 8.0 },
    ];

    if (!this.swags) this.swags = defs.map(() => this.grid(40, 16));
    this.swagEdge = [];
    defs.forEach((d, si) => {
      const m = this.swags[si]; m.def = d;
      const depth = (a) => d.dEnd + (d.dMid - d.dEnd) * Math.pow(Math.sin(Math.PI * a), 0.8);
      let p = 0;
      for (let j = 0; j <= m.nv; j++) for (let i = 0; i <= m.nu; i++) {
        const a = i / m.nu, b = j / m.nv;
        m.pos[p++] = d.x0 + a * (d.x1 - d.x0);
        m.pos[p++] = -6 * k + b * (depth(a) + 6 * k);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, m.pb); gl.bufferData(gl.ARRAY_BUFFER, m.pos, gl.STATIC_DRAW);
      const edge = [];
      for (let i = 0; i <= 80; i++) { const a = i / 80; edge.push([d.x0 + a * (d.x1 - d.x0), depth(a)]); }
      this.swagEdge.push(edge);
    });
    this.rosettes = [[0.25 * W, dEnd * 0.62], [0.75 * W, dEnd * 0.62]];
  }

  /* ── cloth ── */

  // Where the point (u across, v down) of the left curtain is, `tau` of the way through opening.
  cpos(u, v, tau) {
    const { W, H, k } = this, m = 10 * k;
    const cx = -m + u * (W / 2 + m + 2.5 * k), cy = -4 * k + v * (H + 10 * k);
    const yt = this.tieY, g = 0.088 * W, xTop = 0.335 * W, vT = 0.8;
    let ox, oy;
    if (v <= vT) {
      const q = v / vT, ts = Math.pow(1 - q, 2.5);
      const pinch = 1 - 0.22 * Math.exp(-Math.pow((1 - q) / 0.09, 2));
      ox = -m + u * ((g + m) * pinch + (xTop - g) * ts);
      oy = -4 * k + q * (yt + 4 * k);
    } else {
      const w = (v - vT) / (1 - vT);
      const pinch = 1 - 0.22 * Math.exp(-Math.pow(w / 0.16, 2));
      ox = -m + u * (g + m) * pinch * (1 + 0.42 * Math.sin((w * Math.PI) / 2));
      oy = yt + w * this.tailH * (1 - 0.4 * u);
    }
    const D = 0.45;
    const d = D * (0.72 * Math.min(1, Math.abs(v - 0.46) / 0.54) + 0.28 * (1 - u));
    const e = easeInOut(clamp(tau * (1 + D) - d));
    let x = lerp(cx, ox, e);
    const y = lerp(cy, oy, e);
    x += Math.sin(v * 10 - this.time * 7 + u * 2) * 2.4 * k * Math.sin(Math.PI * e) * u;
    if (e > 0.98) x += Math.sin(this.time * 0.9 + v * 5) * 0.9 * k * clamp((v - 0.6) / 0.4) * u;
    return [x, y];
  }

  updateCurtains(tau) {
    const gl = this.gl, W = this.W;
    for (let side = 0; side < 2; side++) {
      const m = this.curt[side];
      let p = 0;
      for (let j = 0; j <= m.nv; j++) for (let i = 0; i <= m.nu; i++) {
        const [x, y] = this.cpos(i / m.nu, j / m.nv, tau);
        m.pos[p++] = side ? W - x : x; m.pos[p++] = y;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, m.pb); gl.bufferData(gl.ARRAY_BUFFER, m.pos, gl.DYNAMIC_DRAW);
    }
  }

  pushPt(x, y, size, c, a = 1) {
    const i = this.np * 7, p = this.pts;
    if (i + 7 > p.length) return;
    p[i] = x; p[i + 1] = y; p[i + 2] = size; p[i + 3] = c[0]; p[i + 4] = c[1]; p[i + 5] = c[2]; p[i + 6] = a;
    this.np++;
  }

  // Lay pearls along a polyline at an even spacing.
  beadLine(line, spacing, size, c, a = 1) {
    let acc = spacing * 0.5;
    for (let i = 1; i < line.length; i++) {
      const [x0, y0] = line[i - 1], [x1, y1] = line[i];
      const d = Math.hypot(x1 - x0, y1 - y0);
      if (d <= 0) continue;
      while (acc <= d) { const t = acc / d; this.pushPt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, size, c, a); acc += spacing; }
      acc -= d;
    }
  }

  clothPearls(tau) {
    const { W, k } = this;
    for (let side = 0; side < 2; side++) {
      const line = [];
      for (let i = 0; i <= 150; i++) { const [x, y] = this.cpos(1, i / 150, tau); line.push([side ? W - x : x, y]); }
      this.beadLine(line, 6.8 * k, 6.7 * k, GOLD);
      // tie-back: a band of pearls across the gather, with a drop hanging from it
      const ta = clamp((tau - 0.72) / 0.25);
      if (ta > 0) {
        const band = [];
        for (let i = 0; i <= 12; i++) {
          const u = 0.12 + (i / 12) * 0.9, [x, y] = this.cpos(Math.min(u, 1), 0.8, tau);
          band.push([side ? W - x : x, y + Math.sin(Math.PI * (i / 12)) * 3.2 * k]);
        }
        this.beadLine(band, 5.4 * k, 5.6 * k, GOLD, ta);
        const [ex, ey] = band[band.length - 1];
        const sw = Math.sin(this.time * 1.7 + side) * 0.05 + Math.exp(-Math.max(0, this.T - 5) * 1.1) * Math.sin(this.time * 6) * 0.22;
        let dy = 5.5 * k;
        for (const sz of [8.6, 5.2, 4.6, 4.0, 3.4, 6.4]) {
          this.pushPt(ex + Math.sin(sw) * dy * (side ? 1 : -1) * -1, ey + dy, sz * k, GOLD, ta);
          dy += sz * k * 0.92;
        }
      }
    }
  }

  valancePearls() {
    const k = this.k;
    for (const edge of this.swagEdge) this.beadLine(edge, 5.9 * k, 5.6 * k, GOLD);
    for (const [x, y] of this.rosettes) {
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; this.pushPt(x + Math.cos(a) * 9.2 * k, y + Math.sin(a) * 9.2 * k, 5.4 * k, GOLD); }
      this.pushPt(x, y, 13.5 * k, GOLD);
      let dy = 15 * k;
      for (const sz of [5.4, 4.6, 3.8, 6.2]) { this.pushPt(x + Math.sin(this.time * 1.3 + x) * 0.6 * k, y + dy, sz * k, GOLD); dy += sz * k * 0.95; }
    }
  }

  droplets() {
    const f = this.meta.fountain, U = this.meta.U, t = this.time;
    const arc = (x0, y0, x1, y1, lift, n, speed, phase, size) => {
      for (let i = 0; i < n; i++) {
        const p = (t * speed + i / n + phase) % 1;
        const x = lerp(x0, x1, p), y = lerp(y0, y1, p * p) - lift * 4 * p * (1 - p);
        this.pushPt(x, y, size * (0.75 + 0.5 * Math.sin(p * Math.PI)), DROP, 0.5 + 0.45 * Math.sin(p * Math.PI));
      }
    };
    for (const s of [-1, 1]) arc(f.cx, f.topY - 3 * U, f.cx + s * f.topRx * 0.62, f.topBowlY, 7 * U, 5, 0.85, s * 0.13, 3.6 * U);
    for (const dx of [-0.92, -0.45, 0.45, 0.92]) arc(f.cx + dx * f.topRx, f.topBowlY + 1.5 * U, f.cx + dx * f.bowlRx * 0.7, f.bowlY, 1.5 * U, 4, 0.9, dx * 0.37, 3.4 * U);
    for (const a of [-2.8, -0.34, 2.5, 0.64, 1.57, 1.1, 2.04]) {
      const cx = Math.cos(a), sy = Math.sin(a);
      arc(f.cx + cx * f.bowlRx * 0.97, f.bowlY + sy * f.bowlRy * 0.9, f.cx + cx * f.waterRx * 0.56, f.waterY + sy * f.waterRy * 0.5 + 2 * U, 3 * U, 6, 0.72, a * 0.21, 3.8 * U);
    }
  }

  /* ── clock ── */

  setPointer(x, y) { this.ptr[0] = clamp(x, -1, 1); this.ptr[1] = clamp(y, -1, 1); }

  open() {
    if (this.t0 != null || this.fixedT != null) return;
    this.t0 = performance.now(); this.hold = 0;
  }
  // Skip the performance and show the open stage (reduced motion, deep links, tests).
  jump(T = 99) { this.fixedT = T; }
  get opened() { return this.t0 != null || this.fixedT != null; }

  update(now) {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000 || 0));
    this.last = now; this.time += dt;
    const tx = this.ptr[0] + Math.sin(this.time * 0.23) * 0.16, ty = this.ptr[1] + Math.cos(this.time * 0.19) * 0.1;
    const f = 1 - Math.exp(-dt * 4.5);
    this.ptrS[0] += (tx - this.ptrS[0]) * f; this.ptrS[1] += (ty - this.ptrS[1]) * f;

    const s = this.s;
    if (this.opened) {
      let T = this.fixedT != null ? this.fixedT : (now - this.t0) / 1000 - this.hold;
      if (this.fixedT == null && T > BEATS.curtain - 0.1 && !this.stageReady) { this.hold += dt; T = BEATS.curtain - 0.1; }
      this.T = T;
      s.press = T < 0.1 ? T / 0.1 : clamp(1 - (T - 0.1) / 0.22);
      s.door = easeInOut(seg(T, 0.24, BEATS.doors));
      s.curtain = this.stageReady ? seg(T, BEATS.curtain, 5.1) : 0;
      for (const name of ['doors', 'curtain', 'reveal', 'done']) {
        if (T >= BEATS[name] && !this.fired[name] && (name === 'doors' || this.stageReady)) {
          this.fired[name] = true;
          if (this.hooks.on) this.hooks.on(name);
        }
      }
    }
    if (this.stageReady && s.door > 0) this.frontFade = Math.min(1, this.frontFade + dt * 3.5);
  }

  /* ── drawing ── */

  quad(x0, y0, x1, y1, u0, v0, u1, v1) {
    const gl = this.gl, b = this.qd;
    b[0] = x0; b[1] = y0; b[2] = u0; b[3] = v0;
    b[4] = x1; b[5] = y0; b[6] = u1; b[7] = v0;
    b[8] = x0; b[9] = y1; b[10] = u0; b[11] = v1;
    b[12] = x1; b[13] = y1; b[14] = u1; b[15] = v1;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.qb); gl.bufferData(gl.ARRAY_BUFFER, b, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  useRelief(layer, L, o) {
    const gl = this.gl, P = this.pRelief, u = P.u, k = this.k;
    gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, layer.h);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, layer.a);
    gl.uniform1i(u.uH, 0); gl.uniform1i(u.uA, 1);
    gl.uniform2f(u.uRes, this.W, this.H);
    gl.uniform2f(u.uTexel, 1 / layer.tw, 1 / layer.th);
    gl.uniform2f(u.uClampX, 0, 1);
    gl.uniform3f(u.uL, L[0], L[1], L[2]);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uK, k);
    gl.uniform1f(u.uRelief, o.relief);
    gl.uniform1f(u.uShLen, o.shLen * k);
    gl.uniform1f(u.uShAmt, o.shAmt);
    gl.uniform1f(u.uHScale, o.hScale * k);
    gl.uniform1f(u.uMode, o.mode);
    gl.uniform1f(u.uLift, o.lift || 0);
    gl.uniform1f(u.uGlint, o.glint == null ? -9 : o.glint);
    gl.uniform1f(u.uFade, o.fade == null ? 1 : o.fade);
    gl.uniform1f(u.uGrain, o.grain);
    gl.uniform1f(u.uWeave, o.weave);
    gl.uniform1f(u.uBase, o.base || 0);
    gl.uniform3f(u.uShadowTint, o.tint[0], o.tint[1], o.tint[2]);
    gl.uniform2f(u.uOff, 0, 0);
    return u;
  }

  drawMesh(m, dynamic) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, m.pb); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.ub); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
  }

  drawPoints(L, off) {
    if (!this.np) return;
    const gl = this.gl, P = this.pPoint, k = this.k;
    gl.useProgram(P.p);
    gl.uniform2f(P.u.uRes, this.W, this.H);
    gl.uniform3f(P.u.uL, L[0], L[1], L[2]);
    gl.uniform1f(P.u.uFade, 1);
    gl.uniform1f(P.u.uPx, this.rs);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ptBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.pts.subarray(0, this.np * 7), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
    gl.uniform1f(P.u.uShadow, 1); gl.uniform2f(P.u.uOff, off[0] + 1.8 * k, off[1] + 2.6 * k);
    gl.drawArrays(gl.POINTS, 0, this.np);
    gl.uniform1f(P.u.uShadow, 0); gl.uniform2f(P.u.uOff, off[0], off[1]);
    gl.drawArrays(gl.POINTS, 0, this.np);
    this.np = 0;
  }

  draw() {
    const gl = this.gl;
    if (!gl || gl.isContextLost()) return;
    const { W, H, k, s } = this;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const px = this.ptrS[0], py = this.ptrS[1];
    const L = norm([-0.52 + 0.36 * px, -0.6 + 0.28 * py, 0.62]);
    const showCloth = s.door > 0.0005;
    const showStage = this.stageReady && s.curtain > 0.0005;
    const paper = [0.78, 0.66, 0.52];
    this.np = 0;

    if (showStage) {
      const sc = 1.02;
      const u = this.useRelief(this.back, L, { mode: 1, relief: 15, shLen: 15, shAmt: 0.6, hScale: 21, grain: 0.035, weave: 0.045, tint: paper });
      gl.uniform2f(u.uOff, -px * 2.2 * k, -py * 1.6 * k);
      this.quad(W / 2 - (W / 2) * sc, H / 2 - (H / 2) * sc, W / 2 + (W / 2) * sc, H / 2 + (H / 2) * sc, 0, 0, 1, 1);
      this.droplets();
      this.drawPoints(L, [-px * 2.2 * k, -py * 1.6 * k]);
    }

    if (showCloth) {
      const par = [-px * 4 * k, -py * 2.6 * k];
      const tau = s.curtain;
      const moving = tau > 0 && (tau < 1 || true);
      if (tau !== this.clothTau || moving) { this.updateCurtains(tau); this.clothTau = tau; }
      const P = this.pFabric, u = P.u;
      gl.useProgram(P.p);
      gl.uniform2f(u.uRes, W, H);
      gl.uniform3f(u.uL, L[0], L[1], L[2]);
      gl.uniform1f(u.uTime, this.time);
      gl.uniform1f(u.uFade, 1);
      gl.uniform1f(u.uPx, this.rs);
      // curtains
      gl.uniform2f(u.uAxis, 1, 0);
      gl.uniform1f(u.uN, Math.max(5, Math.round(W / 2 / k / 27)));
      gl.uniform1f(u.uAmp, 11 * k);
      gl.uniform1f(u.uDu0, 1 / (W / 2 + 12.5 * k));
      gl.uniform2f(u.uEdge, 1, 1);
      gl.uniform1f(u.uWave, 1.0);
      gl.uniform1f(u.uTopShade, 0.22 * W);
      if (showStage) {
        gl.uniform1f(u.uShadow, 1); gl.uniform2f(u.uOff, par[0] + 8 * k, par[1] + 7 * k);
        for (let i = 0; i < 2; i++) this.drawMesh(this.curt[i]);
      }
      gl.uniform1f(u.uShadow, 0); gl.uniform2f(u.uOff, par[0], par[1]);
      for (let i = 0; i < 2; i++) { gl.uniform1f(u.uSeed, i * 3.1); this.drawMesh(this.curt[i]); }
      this.clothPearls(tau);
      this.drawPoints(L, par);
      // valance
      gl.useProgram(P.p);
      gl.uniform1f(u.uPx, this.rs);
      gl.uniform2f(u.uAxis, 0, 1);
      gl.uniform1f(u.uN, 3.4);
      gl.uniform1f(u.uAmp, 7.5 * k);
      gl.uniform2f(u.uEdge, 0, 1);
      gl.uniform1f(u.uWave, 0.0);
      gl.uniform1f(u.uTopShade, 1.0);
      gl.uniform1f(u.uShadow, 1); gl.uniform2f(u.uOff, par[0] + 3 * k, par[1] + 11 * k);
      for (const m of this.swags) { gl.uniform1f(u.uDu0, 1 / (m.def.dMid + 6 * k)); this.drawMesh(m); }
      gl.uniform1f(u.uShadow, 0); gl.uniform2f(u.uOff, par[0], par[1]);
      for (const m of this.swags) { gl.uniform1f(u.uDu0, 1 / (m.def.dMid + 6 * k)); gl.uniform1f(u.uSeed, m.def.seed); this.drawMesh(m); }
      this.valancePearls();
      this.drawPoints(L, par);

      if (this.stageReady) {
        const f = this.front, sc = 1.035, fh = H - f.top;
        const ox = -px * 7 * k, oy = -py * 4.5 * k;
        this.frontOff[0] = ox / this.dpr; this.frontOff[1] = oy / this.dpr;
        const u2 = this.useRelief(f, L, { mode: 2, relief: 15, shLen: 22, shAmt: 0.62, hScale: 21, grain: 0.03, weave: 0.02, base: 0.34, tint: paper, fade: this.frontFade });
        gl.uniform2f(u2.uOff, ox, oy);
        this.quad(W / 2 - (W / 2) * sc, H - fh * sc, W / 2 + (W / 2) * sc, H, 0, 0, 1, 1);
      }
    }

    if (s.door < 1) {
      const off = s.door * (W / 2 + 18 * k);
      const cyc = (this.time % 4.8) / 1.25;
      const u = this.useRelief(this.door, L, {
        mode: 0, relief: 17, shLen: 17, shAmt: 0.62, hScale: 23, grain: 0.07, weave: 0.0, tint: [0.5, 0.6, 0.38],
        lift: 0.03 + 0.03 * Math.sin(this.time * 1.5) - s.press * 0.17,
        glint: this.opened ? -9 : (cyc < 1 ? lerp(0.24, 0.84, cyc) : -9),
      });
      const tw = this.door.tw;
      gl.uniform2f(u.uClampX, 0, 0.5 - 0.5 / tw);
      this.quad(-off, 0, W / 2 - off, H, 0, 0, 0.5, 1);
      gl.uniform2f(u.uClampX, 0.5 + 0.5 / tw, 1);
      this.quad(W / 2 + off, 0, W + off, H, 0.5, 0, 1, 1);
      if (off > 0.5) {
        const F = this.pFlat, a = Math.min(1, off / (8 * k));
        gl.useProgram(F.p);
        gl.uniform2f(F.u.uRes, W, H); gl.uniform2f(F.u.uOff, 0, 0);
        const xe = W / 2 - off, xr = W / 2 + off, t = 5 * k;
        const g0 = [0.50 * a, 0.37 * a, 0.14 * a, a], g1 = [0.96 * a, 0.84 * a, 0.55 * a, a], g2 = [0.66 * a, 0.50 * a, 0.22 * a, a];
        gl.uniform4fv(F.u.uCa, g0); gl.uniform4fv(F.u.uCb, g1); this.quad(xe, 0, xe + t * 0.45, H, 0, 0, 1, 1);
        gl.uniform4fv(F.u.uCa, g1); gl.uniform4fv(F.u.uCb, g2); this.quad(xe + t * 0.45, 0, xe + t, H, 0, 0, 1, 1);
        gl.uniform4fv(F.u.uCa, g2); gl.uniform4fv(F.u.uCb, g1); this.quad(xr - t, 0, xr - t * 0.5, H, 0, 0, 1, 1);
        gl.uniform4fv(F.u.uCa, g1); gl.uniform4fv(F.u.uCb, g0); this.quad(xr - t * 0.5, 0, xr, H, 0, 0, 1, 1);
        // the doors' shadow on the curtain behind them
        const sa = 0.42 * a;
        gl.uniform4fv(F.u.uCa, [0.10 * sa, 0.07 * sa, 0.03 * sa, sa]); gl.uniform4fv(F.u.uCb, [0, 0, 0, 0]);
        this.quad(xe + t, 0, xe + t + 34 * k, H, 0, 0, 1, 1);
        const sb = 0.2 * a;
        gl.uniform4fv(F.u.uCa, [0, 0, 0, 0]); gl.uniform4fv(F.u.uCb, [0.10 * sb, 0.07 * sb, 0.03 * sb, sb]);
        this.quad(xr - t - 14 * k, 0, xr - t, H, 0, 0, 1, 1);
      }
    }
    if (this.hooks.onDraw) this.hooks.onDraw(this);
  }

  // Draw one frame right now (first paint, tests).
  renderNow() { this.update(performance.now()); this.draw(); }

  start() {
    if (this.raf != null) return;
    this.active = true;
    this.last = performance.now();
    const tick = (now) => {
      this.raf = requestAnimationFrame(tick);
      this.frame++;
      // If the phone cannot keep up, draw the scene smaller (the page stretches it back). Up to three steps down.
      const gap = now - this.lastTick; this.lastTick = now;
      if (gap > 0 && gap < 250) {
        this.slow += gap; this.slowN++;
        if (this.slowN >= 30) {
          if (this.slow / this.slowN > 25 && this.drops < 3) {
            this.drops++; this.rs = Math.max(0.5, this.rs * 0.78);
            this.canvas.width = Math.round(this.W * this.rs); this.canvas.height = Math.round(this.H * this.rs);
          }
          this.slow = 0; this.slowN = 0;
        }
      }
      const busy = this.T != null && this.T < BEATS.done + 1;
      if (!busy && this.frame % 2) return;     // ambient life runs at half rate
      this.update(now); this.draw();
    };
    this.raf = requestAnimationFrame(tick);
  }
  stop() { if (this.raf != null) cancelAnimationFrame(this.raf); this.raf = null; this.active = false; }
}
