// The artwork. Nothing here is an image file: every leaf, pearl and petal is drawn twice with the
// same path, once as a height map and once as colour, and the scene's shader lights the pair like
// sculpted paper. Heights are greys (0 = lowest, 1 = highest).
//
// Height canvas channels: r = height. A shape flagged {g:true} also saturates green (mask A:
// the seal plaque on the door, water on the stage); {b:true} saturates blue (mask B: gold).

import { rng, clamp } from './util.js';

const TAU = Math.PI * 2;
const gray = (v) => { const c = Math.round(clamp(v) * 255); return `rgb(${c},${c},${c})`; };

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

// Darken (or tint) a shape from its edge inwards: this is what turns a flat fill into a pillow.
function inner(ctx, path, color, blur, times = 1) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  ctx.save();
  ctx.beginPath(); path(ctx); ctx.clip();
  ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = color;
  for (let i = 0; i < times; i++) {
    // everything except the shape: the whole canvas (in device space, whatever the transform) with the shape as a hole
    ctx.beginPath();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.rect(-60, -60, cw + 120, ch + 120); ctx.restore();
    path(ctx); ctx.fill('evenodd');
  }
  ctx.restore();
}

class Pair {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.hC = mk(w, h); this.aC = mk(w, h);
    this.H = this.hC.getContext('2d'); this.A = this.aC.getContext('2d');
  }
  save() { this.H.save(); this.A.save(); }
  restore() { this.H.restore(); this.A.restore(); }
  translate(x, y) { this.H.translate(x, y); this.A.translate(x, y); }
  rotate(r) { this.H.rotate(r); this.A.rotate(r); }
  scale(x, y) { this.H.scale(x, y); this.A.scale(x, y); }

  // path(ctx) must start with moveTo and must not call beginPath.
  shape(path, o) {
    const H = this.H, A = this.A;
    if (o.top != null || o.hFill) {
      H.beginPath(); path(H);
      H.fillStyle = o.hFill ? o.hFill(H) : gray(o.top);
      H.fill();
      if (o.bevel) inner(H, path, gray(o.edge != null ? o.edge : (o.top || 0.5) - 0.16), o.bevel, o.bevelN || 1);
    }
    if (o.col || o.cFill) {
      A.beginPath(); path(A);
      A.fillStyle = o.cFill ? o.cFill(A) : o.col;
      A.fill();
      if (o.colEdge) inner(A, path, o.colEdge, o.colBevel || o.bevel || 4, 1);
    }
    if (o.g) this.mask(path, 'rgb(0,255,0)');
    if (o.b) this.mask(path, 'rgb(0,0,255)');
  }
  mask(path, color) {
    const H = this.H;
    H.save(); H.globalCompositeOperation = 'lighter';
    H.beginPath(); path(H); H.fillStyle = color; H.fill();
    H.restore();
  }
  // A groove (darker than its surroundings) or a ridge (lighter), with optional colour.
  line(path, o) {
    const H = this.H, A = this.A;
    if (o.top != null) {
      H.save(); H.beginPath(); path(H);
      H.lineWidth = o.w; H.lineCap = o.cap || 'round'; H.lineJoin = 'round';
      H.strokeStyle = gray(o.top); H.stroke(); H.restore();
    }
    if (o.col) {
      A.save(); A.beginPath(); path(A);
      A.lineWidth = o.cw || o.w; A.lineCap = o.cap || 'round'; A.lineJoin = 'round';
      A.strokeStyle = o.col; A.stroke(); A.restore();
    }
  }
  // A little dome: bead, bud, pearl, finial.
  dome(x, y, r, o) {
    const p = (c) => { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); };
    this.shape(p, {
      hFill: (c) => {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, gray(o.top)); g.addColorStop(0.55, gray(o.top - (o.top - o.edge) * 0.25)); g.addColorStop(1, gray(o.edge));
        return g;
      },
      col: o.col, colEdge: o.colEdge, colBevel: r * 0.7, b: o.b, g: o.g,
    });
  }
}

function mottle(ctx, W, H, k, R, light, dark, n, aMax = 0.08) {
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = R() * H, r = (40 + R() * 130) * k;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = R() < 0.5 ? light : dark;
    g.addColorStop(0, c + (0.03 + R() * aMax) + ')'); g.addColorStop(1, c + '0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// A pointed leaf lying along +x from (0,0) to (len,0).
const leafPath = (len, wid) => (c) => {
  c.moveTo(0, 0);
  c.bezierCurveTo(len * 0.22, -wid, len * 0.68, -wid * 0.92, len, 0);
  c.bezierCurveTo(len * 0.68, wid * 0.92, len * 0.22, wid, 0, 0);
  c.closePath();
};

function leaf(P, x, y, len, wid, rot, o) {
  P.save(); P.translate(x, y); P.rotate(rot);
  P.shape(leafPath(len, wid), { top: o.top, edge: o.edge, bevel: o.bevel, col: o.col, colEdge: o.colEdge, colBevel: o.colBevel, b: o.b});
  if (o.rib != null) {
    P.line((c) => { c.moveTo(len * 0.07, 0); c.lineTo(len * 0.93, 0); }, { w: o.ribW, top: o.rib, col: o.ribCol, cw: o.ribW });
    if (o.veins) {
      for (let i = 1; i <= o.veins; i++) {
        const t = 0.16 + (i / (o.veins + 1)) * 0.62;
        const reach = wid * 0.62 * Math.sin(Math.PI * Math.min(1, t * 1.05));
        for (const s of [-1, 1]) {
          P.line((c) => { c.moveTo(len * t, 0); c.lineTo(len * (t + 0.13), s * reach); }, { w: o.ribW * 0.7, top: o.vein != null ? o.vein : o.rib + 0.03 });
        }
      }
    }
  }
  P.restore();
}

/* ───────────────────────── the door ───────────────────────── */

function sprig(P, x, y, rot, L, R, k) {
  P.save(); P.translate(x, y); P.rotate(rot);
  const bend = (R() - 0.5) * 0.46 * L;
  const pt = (t) => {
    const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    return [b * L * 0.5 + c * L, b * bend];
  };
  const tg = (t) => Math.atan2(2 * (1 - t) * bend + 2 * t * (0 - bend), 2 * (1 - t) * L * 0.5 + 2 * t * (L - L * 0.5));
  // stem
  P.line((c) => { c.moveTo(0, 0); c.quadraticCurveTo(L * 0.5, bend, L, 0); }, { w: 2.5 * k, top: 0.355 });
  // bud sprays near the foot of the stem
  for (const [t, side] of [[0.07, -1], [0.2, 1]]) {
    if (R() < 0.25) continue;
    const [bx, by] = pt(t), a = tg(t) + side * (1.0 + R() * 0.3);
    const sl = (11 + R() * 5) * k;
    const ex = bx + Math.cos(a) * sl, ey = by + Math.sin(a) * sl;
    P.line((c) => { c.moveTo(bx, by); c.quadraticCurveTo((bx + ex) / 2 + side * 2 * k, (by + ey) / 2, ex, ey); }, { w: 1.5 * k, top: 0.345 });
    for (const [dx, dy, rr] of [[0, 0, 2.7], [3.4, -3.2, 2.2], [-3.3, -2.6, 2.1], [0.6, -6, 1.8]]) {
      P.dome(ex + (dx * Math.cos(a) - dy * Math.sin(a)) * k * 0.9, ey + (dx * Math.sin(a) + dy * Math.cos(a)) * k * 0.9, rr * k, { top: 0.43, edge: 0.31 });
    }
  }
  // leaves, alternating up the stem
  const nodes = 7 + Math.floor(R() * 2);
  for (let i = 0; i < nodes; i++) {
    const t = 0.2 + (i / nodes) * 0.74;
    const [px, py] = pt(t);
    const side = i % 2 ? 1 : -1;
    const len = (25 - i * 1.5) * k * (0.9 + R() * 0.22);
    const ang = tg(t) + side * (0.78 - i * 0.035 + (R() - 0.5) * 0.16);
    leaf(P, px, py, len, len * 0.37, ang, { top: 0.405, edge: 0.3, bevel: 3.4 * k, rib: 0.35, ribW: 1.25 * k, veins: 3, vein: 0.375 });
  }
  const [ex, ey] = pt(1);
  leaf(P, ex, ey, 22 * k, 8 * k, tg(1) + (R() - 0.5) * 0.2, { top: 0.405, edge: 0.3, bevel: 3.4 * k, rib: 0.35, ribW: 1.25 * k, veins: 3, vein: 0.375 });
  P.restore();
}

function spacedText(ctx, str, x, y, sp) {
  const chars = Array.from(str);
  const ws = chars.map((ch) => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
  let cx = x - total / 2;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += ws[i] + sp; });
  return total;
}

// The cream seal that hangs on the seam and says "tap to open".
function seal(P, cx, cy, k, label) {
  const rx = 74 * k, ry = 95 * k;
  const outline = (c) => {
    const N = 440;
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * TAU - Math.PI / 2;
      const r = 1 + 0.05 * Math.pow(Math.abs(Math.sin(th * 7)), 0.72) + 0.034 * Math.cos(4 * th);
      const x = cx + Math.cos(th) * rx * r, y = cy + Math.sin(th) * ry * r;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.closePath();
  };
  P.shape(outline, {
    top: 0.82, edge: 0.56, bevel: 6 * k, bevelN: 2,
    cFill: (c) => {
      const g = c.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 0, cx, cy, ry * 1.2);
      g.addColorStop(0, '#f8eed6'); g.addColorStop(0.6, '#f1e1c0'); g.addColorStop(1, '#e6d0a8');
      return g;
    },
    colEdge: 'rgba(168,126,62,0.55)', colBevel: 7 * k,
  });
  // a string of gold beads just inside the edge
  const pts = [];
  for (let i = 0; i <= 720; i++) {
    const th = (i / 720) * TAU - Math.PI / 2;
    const r = 0.86 * (1 + 0.034 * Math.cos(4 * th));
    pts.push([cx + Math.cos(th) * rx * r, cy + Math.sin(th) * ry * r]);
  }
  let acc = 0; const step = 5.4 * k;
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc >= step) { acc -= step; P.dome(pts[i][0], pts[i][1], 1.75 * k, { top: 0.94, edge: 0.8, col: '#c9a251', colEdge: 'rgba(110,78,24,0.7)', b: true }); }
  }
  // leaf ornaments above and below the words
  const gold = { top: 0.9, edge: 0.8, bevel: 1.6 * k, col: '#bf9846', colEdge: 'rgba(104,74,22,0.6)', colBevel: 2 * k, b: true };
  for (const s of [-1, 1]) {
    const oy = cy + s * 37 * k;
    leaf(P, cx, oy, 15 * k, 5.2 * k, s * Math.PI / 2, gold);
    leaf(P, cx, oy + s * 1 * k, 11.5 * k, 4.2 * k, s * Math.PI / 2 - 0.72, gold);
    leaf(P, cx, oy + s * 1 * k, 11.5 * k, 4.2 * k, s * Math.PI / 2 + 0.72, gold);
    P.dome(cx, oy - s * 1.5 * k, 2.3 * k, { top: 0.93, edge: 0.8, col: '#c9a251', colEdge: 'rgba(110,78,24,0.7)', b: true });
    const dy = cy + s * 21.5 * k;
    for (const [dx, rr] of [[-11, 1.5], [0, 2.3], [11, 1.5]]) P.dome(cx + dx * k, dy, rr * k, { top: 0.93, edge: 0.8, col: '#c9a251', colEdge: 'rgba(110,78,24,0.7)', b: true });
  }
  // the words, pressed into the card and inked in gold
  const lines = label.lines;
  const size = label.size * k, gap = label.gap * k;
  const y0 = cy - ((lines.length - 1) * gap) / 2 + (label.dy || 0) * k;
  const draw = (ctx, style) => {
    ctx.save();
    ctx.font = `${label.weight} ${size}px ${label.font}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = style;
    lines.forEach((ln, i) => {
      if (label.spacing) spacedText(ctx, ln, cx, y0 + i * gap, label.spacing * k);
      else { ctx.textAlign = 'center'; ctx.fillText(ln, cx, y0 + i * gap); }
    });
    ctx.restore();
  };
  draw(P.H, gray(0.735));
  draw(P.A, '#8e6a26');
  P.H.save(); P.H.globalCompositeOperation = 'lighter'; draw(P.H, 'rgb(0,0,255)'); P.H.restore();
  // the plaque mask goes on last so nothing drawn above can punch a hole in it
  P.mask(outline, 'rgb(0,255,0)');
  // the knot where the seal hangs from the seam
  const ky = cy - ry * 1.055;
  P.dome(cx - 5.4 * k, ky + 2.6 * k, 3 * k, { top: 0.9, edge: 0.6, col: '#c9a251', colEdge: 'rgba(110,78,24,0.7)', b: true });
  P.dome(cx + 5.4 * k, ky + 2.6 * k, 3 * k, { top: 0.9, edge: 0.6, col: '#c9a251', colEdge: 'rgba(110,78,24,0.7)', b: true });
  P.dome(cx, ky, 5 * k, { top: 0.97, edge: 0.62, col: '#d2ad5c', colEdge: 'rgba(110,78,24,0.7)', b: true });
  return { cx, cy, rx: rx * 1.09, ry: ry * 1.09 };
}

export function paintDoor(W, H, k, label) {
  const P = new Pair(W, H);
  const R = rng(20270214);
  P.H.fillStyle = gray(0.3); P.H.fillRect(0, 0, W, H);
  P.A.fillStyle = '#8fa46b'; P.A.fillRect(0, 0, W, H);
  mottle(P.A, W, H, k, R, 'rgba(218,228,172,', 'rgba(50,72,32,', 54, 0.075);

  const cx = W / 2, cy = H * 0.5 - 4 * k;
  // sprigs scattered like a block-printed paper: two on the outside, one in the middle, row after row
  const rowH = 104 * k, rows = Math.ceil(H / rowH) + 1;
  const spots = [];
  for (let r = -1; r < rows; r++) {
    const y = (r + 0.5) * rowH + (R() - 0.5) * 26 * k;
    if (r % 2 === 0) {
      spots.push([W * (0.2 + (R() - 0.5) * 0.1), y, -1]);
      spots.push([W * (0.8 + (R() - 0.5) * 0.1), y + (R() - 0.5) * 30 * k, 1]);
    } else {
      spots.push([W * (0.5 + (R() - 0.5) * 0.14), y, R() < 0.5 ? -1 : 1]);
      spots.push([W * (-0.03 + R() * 0.05), y + 30 * k, -1]);
      spots.push([W * (1.03 - R() * 0.05), y - 20 * k, 1]);
    }
  }
  for (const [sx, sy, side] of spots) {
    const dx = (sx - cx) / (70 * k), dy = (sy - cy) / (92 * k);
    const L = (104 + R() * 34) * k;
    const rot = -Math.PI / 2 + side * (0.5 + R() * 0.75) + (R() < 0.2 ? Math.PI : 0);
    if (dx * dx + dy * dy < 0.5) { R(); continue; }
    // start each sprig so that its middle sits on the spot
    sprig(P, sx - Math.cos(rot) * L * 0.5, sy - Math.sin(rot) * L * 0.5, rot, L, R, k);
  }

  // the seam, edged in gold on both doors
  P.H.fillStyle = gray(0.12); P.H.fillRect(cx - 0.8 * k, 0, 1.6 * k, H);
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? cx - 3.5 * k : cx + 0.8 * k;
    const p = (c) => { c.moveTo(x0, 0); c.lineTo(x0 + 2.7 * k, 0); c.lineTo(x0 + 2.7 * k, H); c.lineTo(x0, H); c.closePath(); };
    P.shape(p, { top: 0.46, col: '#c7a253', b: true });
  }

  const s = seal(P, cx, cy, k, label);
  return { hC: P.hC, aC: P.aC, seal: s };
}

/* ───────────────────────── the stage, back layer ───────────────────────── */

function bananaLeaf(P, x0, y0, ang, L, droop, wMax, U, tone) {
  // spine: a quadratic that leaves the crown at `ang` (from straight up, + = right) and sags at the tip
  const dx = Math.sin(ang), dy = -Math.cos(ang);
  const c1 = [x0 + dx * L * 0.55, y0 + dy * L * 0.55];
  const p2 = [x0 + dx * L, y0 + dy * L + droop * L];
  const at = (t) => {
    const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    return [a * x0 + b * c1[0] + c * p2[0], a * y0 + b * c1[1] + c * p2[1]];
  };
  const nrm = (t) => {
    const tx = 2 * (1 - t) * (c1[0] - x0) + 2 * t * (p2[0] - c1[0]);
    const ty = 2 * (1 - t) * (c1[1] - y0) + 2 * t * (p2[1] - c1[1]);
    const m = Math.hypot(tx, ty) || 1;
    return [-ty / m, tx / m, tx / m, ty / m];
  };
  const wd = (t) => (t < 0.07 ? 0 : wMax * Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.07) / 0.93 * 1.02)), 0.5) * (1 - 0.22 * t));
  const N = 22, lft = [], rgt = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, [px, py] = at(t), [nx, ny] = nrm(t), w = wd(t);
    lft.push([px + nx * w, py + ny * w]); rgt.push([px - nx * w, py - ny * w]);
  }
  const path = (c) => {
    c.moveTo(lft[0][0], lft[0][1]);
    for (let i = 1; i <= N; i++) c.lineTo(lft[i][0], lft[i][1]);
    for (let i = N; i >= 0; i--) c.lineTo(rgt[i][0], rgt[i][1]);
    c.closePath();
  };
  P.shape(path, { top: 0.5, edge: 0.385, bevel: 2.6 * U, col: tone[0], colEdge: tone[2], colBevel: 3.5 * U});
  // ribs
  for (let i = 3; i < N; i++) {
    const t = i / N, [px, py] = at(t), [nx, ny, tx, ty] = nrm(t), w = wd(t) * 0.94;
    for (const s of [-1, 1]) {
      P.line((c) => { c.moveTo(px, py); c.lineTo(px + s * nx * w + tx * w * 0.32, py + s * ny * w + ty * w * 0.32); }, { w: 0.9 * U, top: 0.455, col: tone[3], cw: 0.7 * U });
    }
  }
  // midrib
  P.line((c) => { c.moveTo(x0, y0); c.quadraticCurveTo(c1[0], c1[1], at(0.97)[0], at(0.97)[1]); }, { w: 2.1 * U, top: 0.565, col: tone[1], cw: 1.7 * U });
}

function bananaTree(P, x, yBase, U, dir, R) {
  const crownY = yBase - 112 * U, cxp = x + dir * 5 * U;
  const trunk = (c) => { c.moveTo(x - 7.5 * U, yBase); c.lineTo(x + 7.5 * U, yBase); c.lineTo(cxp + 4.6 * U, crownY); c.lineTo(cxp - 4.6 * U, crownY); c.closePath(); };
  P.shape(trunk, {
    hFill: (c) => { const g = c.createLinearGradient(x - 8 * U, 0, x + 8 * U, 0); g.addColorStop(0, gray(0.35)); g.addColorStop(0.5, gray(0.5)); g.addColorStop(1, gray(0.35)); return g; },
    cFill: (c) => { const g = c.createLinearGradient(x - 8 * U, 0, x + 8 * U, 0); g.addColorStop(0, '#a9b68a'); g.addColorStop(0.5, '#d3dbb4'); g.addColorStop(1, '#a3b085'); return g; },
  });
  for (let y = yBase - 9 * U; y > crownY + 6 * U; y -= 12.5 * U) {
    const f = (yBase - y) / (yBase - crownY), hw = (7.5 - 2.9 * f) * U, xm = x + dir * 5 * U * f;
    P.line((c) => { c.moveTo(xm - hw, y - 1.5 * U); c.quadraticCurveTo(xm, y + 2.5 * U, xm + hw, y - 1.5 * U); }, { w: 1.2 * U, top: 0.33, col: 'rgba(92,112,70,0.45)', cw: 1 * U });
  }
  const tones = [
    ['#7d9765', '#bccb93', 'rgba(46,72,36,0.5)', 'rgba(52,80,40,0.28)'],
    ['#6f8a59', '#b2c38a', 'rgba(40,66,32,0.5)', 'rgba(46,74,36,0.28)'],
    ['#89a26f', '#c6d49c', 'rgba(52,78,40,0.5)', 'rgba(58,86,44,0.28)'],
  ];
  // [angle towards the page centre (deg from straight up), length, droop, width]
  const fan = [[-74, 62, 0.62, 12], [70, 70, 0.6, 13], [-44, 78, 0.34, 14], [46, 84, 0.36, 15], [-16, 88, 0.16, 15], [20, 94, 0.14, 16], [2, 76, 0.04, 13]];
  fan.forEach(([deg, L, droop, w], i) => {
    bananaLeaf(P, cxp, crownY + 3 * U, (dir * deg * Math.PI) / 180, L * U * (0.94 + R() * 0.12), droop, w * U, U, tones[i % 3]);
  });
}

function lotus(P, x, y, r, U) {
  const petal = (deg, len, wid, top, c0, c1) => {
    P.save(); P.translate(x, y); P.rotate((deg * Math.PI) / 180 - Math.PI / 2);
    P.shape(leafPath(len, wid), {
      top, edge: top - 0.13, bevel: 1.7 * U,
      cFill: (c) => { const g = c.createLinearGradient(0, 0, len, 0); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; },
      colEdge: 'rgba(150,70,86,0.4)', colBevel: 1.6 * U,
    });
    P.restore();
  };
  for (const d of [-78, 78, -52, 52]) petal(d, r * 1.12, r * 0.4, 0.5, '#cf8394', '#f0cfd0');
  for (const d of [-26, 26, 0]) petal(d, r * 1.3, r * 0.44, 0.57, '#d78d9b', '#f7e2dc');
  for (const d of [-58, 58, -30, 30]) petal(d, r * 0.82, r * 0.36, 0.63, '#de97a2', '#f9e8e0');
  petal(0, r * 0.74, r * 0.38, 0.7, '#e3a0a8', '#fbeee6');
  P.dome(x, y - r * 0.1, r * 0.2, { top: 0.76, edge: 0.6, col: '#d6b060', colEdge: 'rgba(120,84,26,0.6)' });
}

export function paintStageBack(W, H, k, gs) {
  const P = new Pair(W, H);
  const R = rng(1402);
  const U = k * gs, cx = W / 2;
  const by = (b) => H - b * U;

  // paper
  P.H.fillStyle = gray(0.3); P.H.fillRect(0, 0, W, H);
  P.A.fillStyle = '#eddcbe'; P.A.fillRect(0, 0, W, H);
  mottle(P.A, W, H, k, R, 'rgba(255,246,226,', 'rgba(196,160,112,', 44, 0.07);
  const vg = P.A.createRadialGradient(cx, H * 0.46, Math.min(W, H) * 0.3, cx, H * 0.5, Math.hypot(W, H) * 0.62);
  vg.addColorStop(0, 'rgba(160,120,70,0)'); vg.addColorStop(1, 'rgba(150,108,60,0.2)');
  P.A.fillStyle = vg; P.A.fillRect(0, 0, W, H);
  // the garden floor, a shade warmer than the page
  const fl = P.A.createLinearGradient(0, by(150), 0, H);
  fl.addColorStop(0, 'rgba(206,176,128,0)'); fl.addColorStop(0.35, 'rgba(206,176,128,0.2)'); fl.addColorStop(1, 'rgba(190,156,108,0.34)');
  P.A.fillStyle = fl; P.A.fillRect(0, by(150), W, 150 * U);

  // banana trees, the way a Tamil wedding marks its doorway
  const treeDx = Math.min(W / 2 - 20 * U, 176 * U);
  bananaTree(P, cx - treeDx, by(100), U, 1, R);
  bananaTree(P, cx + treeDx, by(100), U, -1, R);

  // low wall with posts
  const rect = (x0, y0, x1, y1) => (c) => { c.moveTo(x0, y0); c.lineTo(x1, y0); c.lineTo(x1, y1); c.lineTo(x0, y1); c.closePath(); };
  P.shape(rect(-20, by(136), W + 20, by(116)), { top: 0.4, edge: 0.33, bevel: 2 * U, col: '#efe1c6', colEdge: 'rgba(150,112,64,0.35)' });
  for (let x = cx % (7 * U) - 7 * U; x < W + 7 * U; x += 7 * U) {
    P.line((c) => { c.moveTo(x, by(132.5)); c.lineTo(x, by(121)); }, { w: 2.2 * U, top: 0.325, col: 'rgba(140,104,60,0.3)', cw: 2 * U });
  }
  P.shape(rect(-20, by(141.5), W + 20, by(135.5)), { top: 0.47, edge: 0.39, bevel: 1.6 * U, col: '#f5ead3', colEdge: 'rgba(150,112,64,0.3)' });
  P.shape(rect(-20, by(119), W + 20, by(113)), { top: 0.45, edge: 0.38, bevel: 1.6 * U, col: '#f2e6cd', colEdge: 'rgba(150,112,64,0.3)' });
  const posts = [];
  for (let d = 62; d * U < W / 2 + 12 * U; d += 112) posts.push(d, -d);
  for (const d of posts) {
    const px = cx + d * U;
    P.shape(rect(px - 9.5 * U, by(148), px + 9.5 * U, by(112)), { top: 0.52, edge: 0.4, bevel: 2.6 * U, col: '#f3e7cf', colEdge: 'rgba(150,112,64,0.42)' });
    P.shape(rect(px - 12 * U, by(152), px + 12 * U, by(146.5)), { top: 0.57, edge: 0.45, bevel: 1.8 * U, col: '#f7eedb', colEdge: 'rgba(150,112,64,0.35)' });
    P.shape(rect(px - 12 * U, by(115), px + 12 * U, by(110)), { top: 0.55, edge: 0.44, bevel: 1.8 * U, col: '#f5ebd5', colEdge: 'rgba(150,112,64,0.35)' });
    P.dome(px, by(159), 7.6 * U, { top: 0.78, edge: 0.46, col: '#f8f0de', colEdge: 'rgba(150,112,64,0.5)' });
  }

  // the lotus pond
  const py = by(56), prx = 108 * U, pry = 30 * U, wall = 13 * U;
  const front = (c) => {
    c.moveTo(cx - prx, py); c.lineTo(cx - prx, py + wall);
    c.ellipse(cx, py + wall, prx, pry, 0, Math.PI, 0, true);
    c.lineTo(cx + prx, py);
    c.ellipse(cx, py, prx, pry, 0, 0, Math.PI, false);
    c.closePath();
  };
  P.shape(front, {
    hFill: (c) => { const g = c.createLinearGradient(cx - prx, 0, cx + prx, 0); g.addColorStop(0, gray(0.37)); g.addColorStop(0.5, gray(0.52)); g.addColorStop(1, gray(0.37)); return g; },
    cFill: (c) => { const g = c.createLinearGradient(cx - prx, 0, cx + prx, 0); g.addColorStop(0, '#d9c6a2'); g.addColorStop(0.45, '#f1e4ca'); g.addColorStop(1, '#d3bf9a'); return g; },
    colEdge: 'rgba(130,96,54,0.4)', colBevel: 3 * U,
  });
  for (let i = -5; i <= 5; i++) {
    const a = Math.PI / 2 + i * 0.25, gx = cx + Math.cos(a) * prx, gy = py + Math.sin(a) * pry;
    P.line((c) => { c.moveTo(gx, gy + 1.5 * U); c.lineTo(gx, gy + wall - 1 * U); }, { w: 1.4 * U, top: 0.36, col: 'rgba(130,96,54,0.28)', cw: 1.2 * U });
  }
  const ell = (x, y, a, b) => (c) => { c.moveTo(x + a, y); c.ellipse(x, y, a, b, 0, 0, TAU); c.closePath(); };
  P.shape(ell(cx, py, prx, pry), { top: 0.6, edge: 0.48, bevel: 2.4 * U, col: '#f6ecd6', colEdge: 'rgba(140,104,60,0.42)', colBevel: 3 * U });
  const wrx = prx - 10.5 * U, wry = pry - 5.6 * U, wy = py - 0.6 * U;
  P.shape(ell(cx, wy, wrx, wry), {
    top: 0.36, edge: 0.27, bevel: 3.2 * U,
    cFill: (c) => { const g = c.createRadialGradient(cx, wy + wry * 0.3, 0, cx, wy, wrx); g.addColorStop(0, '#a9c7c3'); g.addColorStop(0.55, '#86a9aa'); g.addColorStop(1, '#668c90'); return g; },
    colEdge: 'rgba(30,62,68,0.55)', colBevel: 4.5 * U, g: true,
  });

  // lily pads and lotuses at the back of the water (drawn before the fountain)
  const pad = (dx, dy, r) => {
    const x = cx + dx * U, y = wy + dy * U;
    P.shape(ell(x, y, r * U, r * 0.4 * U), { top: 0.4, edge: 0.345, bevel: 1.4 * U, col: '#86a170', colEdge: 'rgba(40,70,40,0.5)', colBevel: 2 * U });
    P.line((c) => { c.moveTo(x - r * 0.8 * U, y); c.lineTo(x + r * 0.5 * U, y); }, { w: 0.9 * U, top: 0.365, col: 'rgba(40,70,40,0.35)', cw: 0.8 * U });
  };
  pad(-64, -9, 11); pad(60, -11, 10); pad(84, -1, 8);
  lotus(P, cx - 58 * U, wy - 6 * U, 11.5 * U, U);
  lotus(P, cx + 70 * U, wy - 6 * U, 10 * U, U);

  // the fountain
  const col = (x0w, x1w, y0, y1) => (c) => { c.moveTo(cx - x0w, y0); c.lineTo(cx + x0w, y0); c.lineTo(cx + x1w, y1); c.lineTo(cx - x1w, y1); c.closePath(); };
  const stone = (wmax) => ({
    hFill: (c) => { const g = c.createLinearGradient(cx - wmax, 0, cx + wmax, 0); g.addColorStop(0, gray(0.46)); g.addColorStop(0.45, gray(0.74)); g.addColorStop(1, gray(0.46)); return g; },
    cFill: (c) => { const g = c.createLinearGradient(cx - wmax, 0, cx + wmax, 0); g.addColorStop(0, '#dccaa6'); g.addColorStop(0.42, '#f9f1df'); g.addColorStop(1, '#d4c09a'); return g; },
    colEdge: 'rgba(130,96,54,0.38)', colBevel: 2 * U,
  });
  const fy = wy + 3 * U;                       // where the stem meets the water
  P.shape(ell(cx, fy, 14 * U, 3.6 * U), { top: 0.5, edge: 0.4, bevel: 1.5 * U, col: '#efe3c9', colEdge: 'rgba(130,96,54,0.4)' });
  P.shape(col(8 * U, 5 * U, fy, by(96)), stone(8 * U));
  P.shape(ell(cx, by(78), 8.4 * U, 2.4 * U), { top: 0.7, edge: 0.52, bevel: 1.2 * U, col: '#f7eedb', colEdge: 'rgba(130,96,54,0.4)' });
  const bwY = by(100), brx = 31 * U, bry = 7.6 * U;
  const bowl = (c) => {
    c.moveTo(cx - brx, bwY);
    c.bezierCurveTo(cx - brx * 0.92, bwY + 15 * U, cx - 7 * U, bwY + 15.5 * U, cx - 5 * U, bwY + 17 * U);
    c.lineTo(cx + 5 * U, bwY + 17 * U);
    c.bezierCurveTo(cx + 7 * U, bwY + 15.5 * U, cx + brx * 0.92, bwY + 15 * U, cx + brx, bwY);
    c.closePath();
  };
  P.shape(bowl, stone(brx));
  P.shape(ell(cx, bwY, brx, bry), { top: 0.76, edge: 0.6, bevel: 1.8 * U, col: '#faf3e3', colEdge: 'rgba(130,96,54,0.4)', colBevel: 2.4 * U });
  P.shape(ell(cx, bwY - 0.3 * U, brx - 5 * U, bry - 2.4 * U), {
    top: 0.6, edge: 0.52, bevel: 1.6 * U,
    cFill: (c) => { const g = c.createRadialGradient(cx, bwY, 0, cx, bwY, brx); g.addColorStop(0, '#a9c7c3'); g.addColorStop(1, '#779b9d'); return g; },
    colEdge: 'rgba(30,62,68,0.5)', colBevel: 2.4 * U, g: true,
  });
  P.shape(col(4 * U, 3 * U, bwY - 0.5 * U, by(120)), stone(4 * U));
  const tY = by(121), trx = 13.5 * U, tryy = 3.6 * U;
  const tbowl = (c) => { c.moveTo(cx - trx, tY); c.quadraticCurveTo(cx, tY + 13 * U, cx + trx, tY); c.closePath(); };
  P.shape(tbowl, stone(trx));
  P.shape(ell(cx, tY, trx, tryy), { top: 0.8, edge: 0.64, bevel: 1.3 * U, col: '#fbf5e7', colEdge: 'rgba(130,96,54,0.4)' });
  P.shape(col(2.2 * U, 1.6 * U, tY - 0.5 * U, by(129)), stone(2.4 * U));
  P.dome(cx, by(131), 3.4 * U, { top: 0.9, edge: 0.6, col: '#fbf5e7', colEdge: 'rgba(130,96,54,0.5)' });

  // pads and lotuses in front of the fountain
  pad(-22, 9, 9); pad(34, 10, 8); pad(-84, 2, 7);
  lotus(P, cx - 30 * U, wy + 9 * U, 10.5 * U, U);
  lotus(P, cx + 26 * U, wy + 12 * U, 8.5 * U, U);

  return {
    hC: P.hC, aC: P.aC,
    meta: {
      U,
      fountain: { cx, topY: by(131), topBowlY: tY, topRx: trx, bowlY: bwY, bowlRx: brx, bowlRy: bry, waterY: wy, waterRx: wrx, waterRy: wry },
      gardenTop: by(292),
    },
  };
}

/* ───────────────────────── the stage, front layer ───────────────────────── */

function rose(P, x, y, r, pal, R, U) {
  const rings = [
    { n: 6, d: 0.6, p: 0.5, h: 0.5 }, { n: 5, d: 0.41, p: 0.41, h: 0.58 },
    { n: 4, d: 0.25, p: 0.32, h: 0.66 }, { n: 3, d: 0.11, p: 0.23, h: 0.74 },
  ];
  let rot = R() * TAU;
  rings.forEach((g, j) => {
    for (let i = 0; i < g.n; i++) {
      const a = rot + (i / g.n) * TAU + (R() - 0.5) * 0.22;
      const px = x + Math.cos(a) * g.d * r, py = y + Math.sin(a) * g.d * r, pr = g.p * r;
      P.shape((c) => { c.moveTo(px + pr, py); c.arc(px, py, pr, 0, TAU); }, {
        hFill: (c) => {
          const gr = c.createRadialGradient(x, y, Math.max(0, g.d * r - pr), x, y, g.d * r + pr);
          gr.addColorStop(0, gray(g.h - 0.09)); gr.addColorStop(1, gray(g.h + 0.07));
          return gr;
        },
        edge: g.h - 0.16, bevel: 1.7 * U, col: pal.c[j], colEdge: pal.e, colBevel: 2.2 * U,
      });
    }
    rot += 0.55;
  });
  P.dome(x, y, r * 0.13, { top: 0.84, edge: 0.7, col: pal.c[3], colEdge: pal.e });
}

function blossom(P, x, y, r, R, U, tint = '#f8f0e0') {
  const rot = R() * TAU;
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * TAU) / 5, px = x + Math.cos(a) * r * 0.56, py = y + Math.sin(a) * r * 0.56;
    P.shape((c) => { c.moveTo(px + Math.cos(a) * r * 0.5, py + Math.sin(a) * r * 0.5); c.ellipse(px, py, r * 0.5, r * 0.37, a, 0, TAU); }, {
      hFill: (c) => { const g = c.createRadialGradient(x, y, 0, x, y, r * 1.1); g.addColorStop(0, gray(0.5)); g.addColorStop(1, gray(0.66)); return g; },
      edge: 0.46, bevel: 1.2 * U, col: tint, colEdge: 'rgba(160,120,80,0.4)', colBevel: 1.6 * U,
    });
  }
  P.dome(x, y, r * 0.24, { top: 0.74, edge: 0.56, col: '#cfa650', colEdge: 'rgba(110,78,24,0.6)', b: true });
}

function lamp(P, x, yBase, U, flames) {
  // lathe profile of a kuthu vilakku: [height above the foot, radius]
  const prof = [[0, 15.5], [3.5, 15.5], [5.5, 11.5], [9, 9.5], [12, 6], [19, 4.2], [26, 5.8], [30, 4], [42, 3.5], [50, 5.4],
    [54, 3.9], [68, 3.4], [76, 5.2], [80, 3.9], [89, 5.5], [93, 13], [96.5, 17.5], [99, 17.5]];
  const silhouette = (c) => {
    c.moveTo(x - prof[0][1] * U, yBase);
    for (const [h, r] of prof) c.lineTo(x - r * U, yBase - h * U);
    for (let i = prof.length - 1; i >= 0; i--) c.lineTo(x + prof[i][1] * U, yBase - prof[i][0] * U);
    c.closePath();
  };
  for (let i = 0; i < prof.length - 1; i++) {
    const [h0, r0] = prof[i], [h1, r1] = prof[i + 1], rm = Math.max(r0, r1) * U;
    const y0 = yBase - h0 * U + 0.6, y1 = yBase - h1 * U - 0.6;
    P.shape((c) => { c.moveTo(x - r0 * U, y0); c.lineTo(x + r0 * U, y0); c.lineTo(x + r1 * U, y1); c.lineTo(x - r1 * U, y1); c.closePath(); }, {
      hFill: (c) => { const g = c.createLinearGradient(x - rm, 0, x + rm, 0); g.addColorStop(0, gray(0.46)); g.addColorStop(0.42, gray(0.86)); g.addColorStop(1, gray(0.46)); return g; },
      cFill: (c) => { const g = c.createLinearGradient(x - rm, 0, x + rm, 0); g.addColorStop(0, '#7b5c24'); g.addColorStop(0.3, '#cdab5e'); g.addColorStop(0.46, '#f1dc9c'); g.addColorStop(0.68, '#bf9a50'); g.addColorStop(1, '#75561f'); return g; },
    });
  }
  for (const h of [3.5, 12, 30, 54, 80]) {
    const r = prof.find((p) => p[0] >= h)[1] * U * 0.96;
    P.line((c) => { c.moveTo(x - r, yBase - h * U); c.lineTo(x + r, yBase - h * U); }, { w: 1.1 * U, top: 0.5, col: 'rgba(84,58,16,0.55)', cw: 1 * U, cap: 'butt' });
  }
  P.mask(silhouette, 'rgb(0,0,255)');
  const dY = yBase - 99 * U, drx = 17.5 * U, dry = 4.4 * U;
  const ell = (px, py, a, b) => (c) => { c.moveTo(px + a, py); c.ellipse(px, py, a, b, 0, 0, TAU); c.closePath(); };
  const flame = (ang) => {
    const fx = x + Math.cos(ang) * drx * 0.9, fy = dY + Math.sin(ang) * dry * 0.9, w = 2.7 * U, h = 10.5 * U;
    P.shape((c) => {
      c.moveTo(fx, fy);
      c.bezierCurveTo(fx - w, fy - h * 0.2, fx - w * 0.62, fy - h * 0.74, fx, fy - h);
      c.bezierCurveTo(fx + w * 0.62, fy - h * 0.74, fx + w, fy - h * 0.2, fx, fy);
      c.closePath();
    }, {
      top: 0.92, edge: 0.7, bevel: 1 * U,
      cFill: (c) => { const g = c.createRadialGradient(fx, fy - h * 0.3, 0, fx, fy - h * 0.45, h * 0.62); g.addColorStop(0, '#fffbe6'); g.addColorStop(0.45, '#ffd874'); g.addColorStop(1, '#f39a32'); return g; },
    });
    flames.push([fx, fy - h * 0.5]);
  };
  flame(-2.55); flame(-0.6);
  P.shape(ell(x, dY, drx, dry), { top: 0.86, edge: 0.66, bevel: 1.5 * U, col: '#e6cc86', colEdge: 'rgba(96,66,18,0.7)', colBevel: 2 * U, b: true });
  P.shape(ell(x, dY, drx - 4 * U, dry - 1.5 * U), { top: 0.7, edge: 0.62, bevel: 1.2 * U, col: '#6a4b17', colEdge: 'rgba(40,24,4,0.6)' });
  // the spire that rises from the middle of the bowl
  const sp = [[0, 2.6], [6, 2], [9, 3.6], [12, 2.2], [20, 1.6], [24, 2.8], [30, 0.6]];
  for (let i = 0; i < sp.length - 1; i++) {
    const [h0, r0] = sp[i], [h1, r1] = sp[i + 1], rm = Math.max(r0, r1) * U + 0.5;
    const y0 = dY - h0 * U + 0.5, y1 = dY - h1 * U - 0.5;
    P.shape((c) => { c.moveTo(x - r0 * U, y0); c.lineTo(x + r0 * U, y0); c.lineTo(x + r1 * U, y1); c.lineTo(x - r1 * U, y1); c.closePath(); }, {
      hFill: (c) => { const g = c.createLinearGradient(x - rm, 0, x + rm, 0); g.addColorStop(0, gray(0.5)); g.addColorStop(0.42, gray(0.9)); g.addColorStop(1, gray(0.5)); return g; },
      cFill: (c) => { const g = c.createLinearGradient(x - rm, 0, x + rm, 0); g.addColorStop(0, '#80601f'); g.addColorStop(0.42, '#f1dc9c'); g.addColorStop(1, '#7b5c24'); return g; },
      b: true,
    });
  }
  flame(2.5); flame(0.62); flame(Math.PI / 2);
}

function bouquet(P, U, R, yB, v) {
  // drawn for the bottom-left corner (x grows right from 0); the caller mirrors it for the right
  const sage = [
    { col: '#6f8857', colEdge: 'rgba(34,56,26,0.55)' }, { col: '#84a06c', colEdge: 'rgba(40,62,30,0.5)' },
    { col: '#5f784a', colEdge: 'rgba(28,48,22,0.55)' }, { col: '#93ab7a', colEdge: 'rgba(46,68,34,0.5)' },
  ];
  const lf = (x, y, len, wid, deg, i) => leaf(P, x * U, yB - y * U, len * U, wid * U, (deg * Math.PI) / 180, {
    top: 0.5, edge: 0.385, bevel: 2.6 * U, ...sage[i % 4], colBevel: 3 * U, rib: 0.435, ribW: 1.2 * U, ribCol: 'rgba(30,52,24,0.4)', veins: 3, vein: 0.47,
  });
  lf(18, 46, 50, 16, -100, 0); lf(30, 40, 54, 17, -62, 1); lf(52, 24, 52, 16, -30, 2);
  lf(70, 10, 46, 14, -8, 3); lf(8, 60, 40, 13, -128, 2); lf(44, 34, 40, 13, -48, 3);
  lf(84, 4, 34, 11, 6, 0); lf(4, 34, 34, 12, -168, 1);
  const cream = { c: ['#f6ead0', '#f3e2c6', '#efd8bc', '#e9cdb0'], e: 'rgba(166,122,84,0.42)' };
  const blush = { c: ['#eec4b4', '#e8b3a4', '#e1a294', '#d89084'], e: 'rgba(150,78,70,0.42)' };
  const pink = { c: ['#f3d6c8', '#eec6b8', '#e7b4a8', '#df9f96'], e: 'rgba(156,90,78,0.4)' };
  if (v === 0) {
    rose(P, 31 * U, yB - 30 * U, 26 * U, cream, R, U);
    rose(P, 68 * U, yB - 15 * U, 18.5 * U, blush, R, U);
    rose(P, 9 * U, yB - 62 * U, 13.5 * U, pink, R, U);
  } else {
    rose(P, 30 * U, yB - 28 * U, 24 * U, blush, R, U);
    rose(P, 66 * U, yB - 16 * U, 19.5 * U, cream, R, U);
    rose(P, 10 * U, yB - 60 * U, 14 * U, cream, R, U);
  }
  blossom(P, 52 * U, yB - 47 * U, 8.5 * U, R, U);
  blossom(P, 91 * U, yB - 29 * U, 7 * U, R, U, '#f6e3d6');
  blossom(P, 96 * U, yB - 7 * U, 6.5 * U, R, U);
  blossom(P, 28 * U, yB - 66 * U, 6.5 * U, R, U, '#f6e3d6');
  // a trail of jasmine along the floor, towards the pond
  for (const [x, y, r] of [[112, 6, 4.6], [124, 12, 4], [136, 5, 3.6], [147, 10, 3.2]]) blossom(P, x * U, yB - y * U, r * U, R, U);
  for (const [x, y] of [[44, 58], [60, 40], [104, 18], [20, 78], [80, 34]]) P.dome(x * U, yB - y * U, 2.2 * U, { top: 0.62, edge: 0.44, col: '#d2ac58', colEdge: 'rgba(110,78,24,0.6)', b: true });
}

// The front layer is only as tall as the things in it, so its canvas is `top` pixels short of the full stage.
export function paintStageFront(W, H, k, gs) {
  const U = k * gs;
  const fh = Math.min(H, Math.ceil(176 * U));
  const top = H - fh;
  const P = new Pair(W, fh);
  const R = rng(77);
  const cx = W / 2, flames = [];
  const lampDx = Math.min(W / 2 - 34 * U, 152 * U);
  lamp(P, cx - lampDx, fh - 27 * U, U, flames);
  lamp(P, cx + lampDx, fh - 27 * U, U, flames);
  bouquet(P, U, R, fh + 4 * U, 0);
  P.save(); P.translate(W, 0); P.scale(-1, 1);
  bouquet(P, U, R, fh + 4 * U, 1);
  P.restore();
  return { hC: P.hC, aC: P.aC, top, meta: { flames: flames.map(([x, y]) => [x, y + top]) } };
}
