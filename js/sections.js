// Everything below the opening: petals and gold dust, the scratch card, the countdown,
// calendar files, arrivals on scroll.

import { rng, clamp, reducedMotion } from './util.js';

const TAU = Math.PI * 2;

/* ───────────── petals, confetti, gold dust (one canvas over the page) ───────────── */

const GOLD = ['#d9b866', '#c39a45', '#efd9a0', '#b8944a'];
const PETAL = ['#f3d2c6', '#e8b2a6', '#fbf2e2', '#f7e2d6', '#d98b98', '#f0c9ba'];
const LEAF = ['#8fa46b', '#7d9765', '#a9bb88'];
const FOIL = ['#9fb37a', '#dfe6b8', '#5f7646', '#e0c688'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class FX {
  constructor(canvas) {
    this.c = canvas; this.x = canvas.getContext('2d'); this.p = []; this.raf = null; this.off = reducedMotion();
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  resize() {
    const d = (this.d = Math.min(window.devicePixelRatio || 1, 2));
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.c.width = Math.round(this.w * d); this.c.height = Math.round(this.h * d);
  }
  spawn(o) {
    if (this.off) return;
    if (this.p.length > 700) this.p.splice(0, this.p.length - 700);
    this.p.push(Object.assign({ vx: 0, vy: 0, g: 600, drag: 0.6, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 6, age: 0, life: 2.5, size: 6, sway: 0, ph: Math.random() * TAU, kind: 'dot', color: '#d9b866', delay: 0 }, o));
    this.run();
  }
  // Gold dust: a quick burst from a point (the seal, a button).
  dust(x, y, n = 26) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = 60 + Math.random() * 260;
      this.spawn({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 260, drag: 2.2, size: 2 + Math.random() * 3.6, life: 0.9 + Math.random() * 0.9, color: pick(GOLD) });
    }
  }
  // Confetti that leaps up and falls: petals, leaves and gold.
  burst(x, y, n = 90, spread = 1) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.5 * spread, v = 220 + Math.random() * 520;
      const r = Math.random();
      const kind = r < 0.5 ? 'petal' : r < 0.72 ? 'leaf' : 'dot';
      this.spawn({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 620, drag: 1.25, kind,
        size: kind === 'dot' ? 3 + Math.random() * 3.5 : 9 + Math.random() * 9,
        life: 2.6 + Math.random() * 1.6, sway: kind === 'dot' ? 0 : 40 + Math.random() * 50,
        color: kind === 'petal' ? pick(PETAL) : kind === 'leaf' ? pick(LEAF) : pick(GOLD),
      });
    }
  }
  // Petals that drift down from the top of the screen, between x0 and x1.
  rain(n, x0, x1) {
    for (let i = 0; i < n; i++) {
      const kind = Math.random() < 0.82 ? 'petal' : 'dot';
      this.spawn({
        x: x0 + Math.random() * (x1 - x0), y: -20 - Math.random() * 60, vx: (Math.random() - 0.5) * 40, vy: 70 + Math.random() * 120,
        g: 26, drag: 0.12, kind, size: kind === 'dot' ? 3 + Math.random() * 2.5 : 10 + Math.random() * 10, life: 9,
        sway: 30 + Math.random() * 60, color: kind === 'petal' ? pick(PETAL) : pick(GOLD), delay: Math.random() * 1.3,
      });
    }
  }
  // Foil flakes that fall from under the finger while scratching.
  flakes(x, y, n = 2) {
    for (let i = 0; i < n; i++) {
      this.spawn({ x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 110, vy: -30 - Math.random() * 60, g: 760, drag: 1, size: 2 + Math.random() * 3.4, life: 0.9 + Math.random() * 0.6, color: pick(FOIL) });
    }
  }
  run() {
    if (this.raf != null) return;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const x = this.x, d = this.d;
      x.setTransform(d, 0, 0, d, 0, 0);
      x.clearRect(0, 0, this.w, this.h);
      const keep = [];
      for (const p of this.p) {
        if (p.delay > 0) { p.delay -= dt; keep.push(p); continue; }
        p.age += dt;
        if (p.age >= p.life || p.y > this.h + 60) continue;
        const k = Math.exp(-p.drag * dt);
        p.vx *= k; p.vy = p.vy * k + p.g * dt;
        p.ph += dt * 3.2;
        p.x += (p.vx + Math.sin(p.ph) * p.sway) * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const a = clamp((p.life - p.age) / (p.life * 0.3));
        x.globalAlpha = a;
        x.fillStyle = p.color;
        if (p.kind === 'dot') { x.beginPath(); x.arc(p.x, p.y, p.size / 2, 0, TAU); x.fill(); }
        else {
          x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(p.ph * 0.8)));
          x.beginPath();
          const s = p.size;
          if (p.kind === 'petal') { x.moveTo(0, -s * 0.5); x.bezierCurveTo(s * 0.62, -s * 0.42, s * 0.5, s * 0.42, 0, s * 0.5); x.bezierCurveTo(-s * 0.5, s * 0.42, -s * 0.62, -s * 0.42, 0, -s * 0.5); }
          else { x.moveTo(-s * 0.6, 0); x.quadraticCurveTo(0, -s * 0.36, s * 0.6, 0); x.quadraticCurveTo(0, s * 0.36, -s * 0.6, 0); }
          x.fill(); x.restore();
        }
        keep.push(p);
      }
      x.globalAlpha = 1;
      this.p = keep;
      if (keep.length) this.raf = requestAnimationFrame(tick);
      else { this.raf = null; x.clearRect(0, 0, this.w, this.h); }
    };
    this.raf = requestAnimationFrame(tick);
  }
}

/* ───────────── scratch to reveal ───────────── */

function heartPath(c, s) {
  c.moveTo(100 * s, 172 * s);
  c.bezierCurveTo(40 * s, 128 * s, 8 * s, 92 * s, 8 * s, 54 * s);
  c.bezierCurveTo(8 * s, 26 * s, 30 * s, 8 * s, 54 * s, 8 * s);
  c.bezierCurveTo(74 * s, 8 * s, 90 * s, 18 * s, 100 * s, 34 * s);
  c.bezierCurveTo(110 * s, 18 * s, 126 * s, 8 * s, 146 * s, 8 * s);
  c.bezierCurveTo(170 * s, 8 * s, 192 * s, 26 * s, 192 * s, 54 * s);
  c.bezierCurveTo(192 * s, 92 * s, 160 * s, 128 * s, 100 * s, 172 * s);
  c.closePath();
}

export function initScratch({ root, canvas, skip, fx, sound, onDone }) {
  const ctx = canvas.getContext('2d');
  const GX = 26, GY = 24;
  let w = 0, h = 0, d = 1, done = false, down = false, last = null, lastTick = 0;
  let inside = [], hit = [], total = 0, got = 0;

  function paint() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    d = Math.min(window.devicePixelRatio || 1, 2.5);
    w = canvas.width = Math.round(r.width * d); h = canvas.height = Math.round(r.height * d);
    const s = w / 200, R = rng(1402);
    ctx.save();
    ctx.beginPath(); heartPath(ctx, s); ctx.clip();
    const g = ctx.createRadialGradient(w * 0.4, h * 0.34, 0, w * 0.5, h * 0.46, w * 0.66);
    g.addColorStop(0, '#e6ecc2'); g.addColorStop(0.42, '#a3b77e'); g.addColorStop(1, '#5b7243');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3200; i++) {
      const x = R() * w, y = R() * h, sz = (0.5 + R() * 1.5) * d, t = R();
      ctx.fillStyle = t < 0.36 ? `rgba(255,251,226,${0.3 + R() * 0.55})` : t < 0.68 ? `rgba(236,210,140,${0.35 + R() * 0.5})` : `rgba(44,66,30,${0.2 + R() * 0.35})`;
      ctx.beginPath(); ctx.arc(x, y, sz / 2 + 0.3, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,253,240,0.95)';
    for (let i = 0; i < 30; i++) {
      const x = R() * w, y = R() * h, sz = (2.2 + R() * 3.4) * d;
      ctx.beginPath();
      ctx.moveTo(x, y - sz); ctx.quadraticCurveTo(x, y, x + sz, y); ctx.quadraticCurveTo(x, y, x, y + sz);
      ctx.quadraticCurveTo(x, y, x - sz, y); ctx.quadraticCurveTo(x, y, x, y - sz); ctx.fill();
    }
    const sheen = ctx.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0.25, 'rgba(255,255,255,0)'); sheen.addColorStop(0.45, 'rgba(255,255,255,0.26)'); sheen.addColorStop(0.62, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen; ctx.fillRect(0, 0, w, h);
    ctx.restore();
    // which cells of a coarse grid lie inside the heart: this is how "how much is scratched" is measured
    const path = new Path2D(); heartPath(path, s);
    inside = []; hit = []; total = 0; got = 0;
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      const ok = ctx.isPointInPath(path, ((i + 0.5) / GX) * w, ((j + 0.5) / GY) * h);
      inside.push(ok); hit.push(false); if (ok) total++;
    }
  }

  function mark(x, y, rad) {
    const cw = w / GX, ch = h / GY;
    const i0 = Math.max(0, Math.floor((x - rad) / cw)), i1 = Math.min(GX - 1, Math.floor((x + rad) / cw));
    const j0 = Math.max(0, Math.floor((y - rad) / ch)), j1 = Math.min(GY - 1, Math.floor((y + rad) / ch));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const q = j * GX + i;
      if (!inside[q] || hit[q]) continue;
      const dx = (i + 0.5) * cw - x, dy = (j + 0.5) * ch - y;
      if (dx * dx + dy * dy <= rad * rad) { hit[q] = true; got++; }
    }
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) * w) / r.width, ((e.clientY - r.top) * h) / r.height];
  }

  function scratch(p, e) {
    const bw = w * 0.17;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = bw;
    ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0] + 0.01, p[1] + 0.01); ctx.stroke();
    ctx.restore();
    const steps = Math.max(1, Math.ceil(Math.hypot(p[0] - last[0], p[1] - last[1]) / (bw * 0.4)));
    for (let i = 0; i <= steps; i++) mark(last[0] + ((p[0] - last[0]) * i) / steps, last[1] + ((p[1] - last[1]) * i) / steps, bw * 0.5);
    last = p;
    if (fx) fx.flakes(e.clientX, e.clientY, 2);
    const now = performance.now();
    if (sound && now - lastTick > 95) { lastTick = now; sound.play('tick'); }
    if (total && got / total > 0.52) finish();
  }

  function finish() {
    if (done) return;
    done = true; down = false;
    root.classList.add('is-done');
    if (skip) skip.hidden = true;
    const r = canvas.getBoundingClientRect();
    if (fx) fx.burst(r.left + r.width / 2, r.top + r.height * 0.5, 110);
    if (sound) sound.play('sparkle');
    if (onDone) onDone();
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (done) return;
    down = true; last = pos(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    scratch(pos(e), e);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => { if (down && !done) { scratch(pos(e), e); e.preventDefault(); } });
  const up = () => { down = false; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  if (skip) skip.addEventListener('click', finish);

  paint();
  return { repaint: () => { if (!done) paint(); }, finish, get done() { return done; } };
}

/* ───────────── countdown ───────────── */

export function initCountdown(targetIso, cells, onPassed) {
  const target = new Date(targetIso).getTime();
  const prev = {};
  const set = (el, v) => {
    const s = String(v).padStart(2, '0');
    if (prev[el.id] === s) return;
    prev[el.id] = s; el.textContent = s;
    el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
  };
  let passed = false;
  const tick = () => {
    let ms = target - Date.now();
    if (ms <= 0) { ms = 0; if (!passed) { passed = true; if (onPassed) onPassed(); } }
    const sec = Math.floor(ms / 1000);
    set(cells.d, Math.floor(sec / 86400)); set(cells.h, Math.floor((sec % 86400) / 3600));
    set(cells.m, Math.floor((sec % 3600) / 60)); set(cells.s, sec % 60);
  };
  tick();
  return setInterval(tick, 250);
}

/* ───────────── calendar ───────────── */

const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
// The calendar day in India as yyyymmdd, plus `add` days.
const dayStamp = (iso, add = 0) => {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600e3 + add * 86400e3);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
};

export function buildICS(events) {
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hariharan and Swetha//Wedding Invitation//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  events.forEach((e, i) => {
    out.push('BEGIN:VEVENT', `UID:hs-wedding-${i}-${dayStamp(e.start)}@invite`, `DTSTAMP:${stamp(new Date().toISOString())}`);
    if (e.allDay) out.push(`DTSTART;VALUE=DATE:${dayStamp(e.start)}`, `DTEND;VALUE=DATE:${dayStamp(e.start, 1)}`);
    else out.push(`DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end || e.start)}`);
    out.push(`SUMMARY:${esc(e.title)}`, `LOCATION:${esc(e.location || '')}`, `DESCRIPTION:${esc(e.note || '')}`, 'END:VEVENT');
  });
  out.push('END:VCALENDAR');
  return out.join('\r\n');
}

export function googleCalUrl(e) {
  const dates = e.allDay ? `${dayStamp(e.start)}/${dayStamp(e.start, 1)}` : `${stamp(e.start)}/${stamp(e.end || e.start)}`;
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates, details: e.note || '', location: e.location || '', ctz: 'Asia/Kolkata' });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

/* ───────────── arrivals on scroll ───────────── */

export function initReveals() {
  const all = Array.from(document.querySelectorAll('.rv'));
  // siblings arrive one after another
  const seen = new Map();
  for (const el of all) {
    const par = el.parentElement, n = seen.get(par) || 0;
    el.style.setProperty('--rd', Math.min(n, 6) * 0.09 + 's');
    seen.set(par, n + 1);
  }
  const show = (el) => el.classList.add('is-in');
  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((ents) => { for (const en of ents) if (en.isIntersecting) { show(en.target); io.unobserve(en.target); } }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    all.forEach((el) => io.observe(el));
  }
  // The observer does not fire in a hidden or frozen document, so anything at or above the fold is
  // also revealed by measurement. No lower bound: content scrolled past must never stay invisible.
  const sweep = () => {
    if (document.documentElement.classList.contains('is-locked')) return;
    const vh = window.innerHeight;
    for (const el of all) if (!el.classList.contains('is-in') && el.getBoundingClientRect().top < vh * 0.96) show(el);
  };
  ['load', 'scroll', 'resize', 'pageshow'].forEach((ev) => addEventListener(ev, sweep, { passive: true }));
  return sweep;
}

/* ───────────── paper grain for the sheet ───────────── */

export function paperTile() {
  const c = document.createElement('canvas'); c.width = c.height = 220;
  const x = c.getContext('2d'), img = x.createImageData(220, 220), R = rng(5);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = R();
    img.data[i] = 120; img.data[i + 1] = 88; img.data[i + 2] = 44;
    img.data[i + 3] = Math.round(v * v * 46);
  }
  x.putImageData(img, 0, 0);
  return `url(${c.toDataURL('image/png')})`;
}
