// Wires the invitation together: language, the opening, sound, and the sections below it.

import { $, $$, el, clamp, reducedMotion } from './util.js';
import { STR, fmtDate, fmtRange } from './i18n.js';
import { Scene } from './scene.js';
import { Sound } from './audio.js';
import { FX, buildICS, googleCalUrl, initReveals, paperTile } from './sections.js';

const C = window.INVITE || {};
const html = document.documentElement;
const hero = $('#hero');
const params = new URLSearchParams(location.search);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
};
const startLang = params.get('lang') || (C.languageSwitch && store.get('hs-lang')) || C.startLanguage || 'en';
const state = {
  lang: STR[startLang] ? startLang : 'en',
  booted: false, wantOpen: false, opened: false, revealed: false, done: false, gl: false, painted: false, pending: null,
  blessings: Math.max(0, parseInt(store.get('hs-bless') || '0', 10) || 0),
  guests: 2,
};
const sound = new Sound(C.musicFile || '');
const fx = new FX($('#fx'));
const soundBtn = $('#soundBtn'), langBtn = $('#langBtn');
let sweep = () => {};

const S = () => STR[state.lang];
const L = (o) => (o ? (o[state.lang] != null ? o[state.lang] : o.en) : '');
const iOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const scene = new Scene($('#gl'), {
  label: () => S().seal,
  onSeal: (r) => {
    hero.style.setProperty('--sx', r.x + 'px'); hero.style.setProperty('--sy', r.y + 'px');
    hero.style.setProperty('--sw', r.w + 'px'); hero.style.setProperty('--sh', r.h + 'px');
  },
  onStage: (flames) => {
    const box = $('#flames'); box.textContent = '';
    flames.forEach(([x, y], i) => box.append(el('i', { class: 'flame', style: `left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%;--d:${(-i * 0.37).toFixed(2)}s` })));
  },
  on: (name) => beat(name),
  onDraw: (s) => { $('#flames').style.transform = `translate(${s.frontOff[0].toFixed(2)}px, ${s.frontOff[1].toFixed(2)}px)`; },
});

/* ── words ── */

function calendarEvents() {
  const g = L(C.couple.groom.name), b = L(C.couple.bride.name);
  const title = state.lang === 'ta' ? `${g} – ${b} திருமண வரவேற்பு` : `${g} & ${b} · Wedding reception`;
  return [{ start: C.wedding.start, end: C.wedding.end, allDay: !C.wedding.showTime, title, note: '', location: `${C.venue.name.en}, ${C.venue.address.en}` }];
}

function blessLine() {
  const n = state.blessings;
  $('#blessCount').textContent = n === 0 ? '' : n === 1 ? S().blessOne : S().blessMany(n);
}

function applyLang() {
  const lang = state.lang, s = S();
  html.lang = lang;
  $$('[data-t]').forEach((n) => { const v = s[n.dataset.t]; if (typeof v === 'string') n.textContent = v; });
  $$('[data-ta]').forEach((n) => { const v = s[n.dataset.ta]; if (typeof v === 'string') n.setAttribute('aria-label', v); });
  const g = C.couple.groom, b = C.couple.bride, gn = L(g.name), bn = L(b.name);
  $$('[data-name="groom"]').forEach((n) => { n.textContent = gn; });
  $$('[data-name="bride"]').forEach((n) => { n.textContent = bn; });
  $$('[data-parents="groom"]').forEach((n) => { n.textContent = L(g.parents); });
  $$('[data-parents="bride"]').forEach((n) => { n.textContent = L(b.parents); });
  const title = lang === 'ta' ? `${gn} – ${bn} திருமண அழைப்பிதழ்` : `The wedding invitation of ${gn} and ${bn}`;
  $('#pageTitle').textContent = title;
  document.title = lang === 'ta' ? `${gn} – ${bn} · திருமண அழைப்பிதழ்` : `${gn} & ${bn} · Wedding Invitation`;
  $('#welcomeText').textContent = L(C.welcome);

  const w = C.wedding.start;
  $('#dDow').textContent = fmtDate(w, lang, { weekday: 'long' });
  $('#dDate').textContent = fmtDate(w, lang, { day: 'numeric', month: 'long', year: 'numeric' });
  const dTime = $('#dTime');
  dTime.textContent = C.wedding.showTime ? fmtRange(w, C.wedding.end, lang) : '';
  dTime.hidden = !C.wedding.showTime;
  $('#dWhere').textContent = L(C.venue.short) || L(C.venue.name);

  $('#venueName').textContent = L(C.venue.name);
  $('#venueAddr').textContent = L(C.venue.address);
  $('#mapBtn').href = C.venue.mapsUrl || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${C.venue.name.en}, ${C.venue.address.en}`);

  $('#footNames').textContent = `${gn} & ${bn}`;
  $('#footTag').textContent = C.couple.hashtag || '';
  $('#monoLabel').textContent = lang === 'ta' ? 'விநாயகர்' : 'Lord Ganesha';
  blessLine();
  const mc = C.musicFile && C.musicCredit;
  $('#credit').hidden = !mc;
  if (mc) {
    const link = $('#creditLink'); link.textContent = mc.title; link.href = mc.url;
    $('#creditBy').textContent = mc.by ? (lang === 'ta' ? ` · ${mc.by}` : ` by ${mc.by}`) : '';
  }

  langBtn.hidden = !C.languageSwitch;
  langBtn.textContent = lang === 'en' ? 'தமிழ்' : 'English';
  langBtn.lang = lang === 'en' ? 'ta' : 'en';
  langBtn.setAttribute('aria-label', lang === 'en' ? 'தமிழில் படிக்க' : 'Read in English');
  soundBtn.setAttribute('aria-label', s.music);
  $('#loaderNames').textContent = `${gn} & ${bn}`;
  $('#loaderLine').textContent = hero.classList.contains('no-gl') ? s.sealLabel : (lang === 'ta' ? 'அழைப்பிதழ் திறக்கிறது' : 'Opening your invitation');

  const evs = calendarEvents();
  const ics = $('#icsBtn');
  ics.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(buildICS(evs));
  if (iOS) ics.removeAttribute('download');
  $('#gcalBtn').href = googleCalUrl(evs[0]);

  if (!$('#rsvpDone').hidden) $('#rsvpDoneText').textContent = s.doneYes(state.guests);
  fitNames();
  state.painted = true;
}

/* ── layout of the names over the stage ── */

function layoutHero() {
  const r = hero.getBoundingClientRect();
  if (!r.width) return;
  const u = r.width / 390;
  const cap = Math.min(1, r.height / (1.6 * r.width));
  const top = 0.19 * r.width * cap + 14 * u;
  const gs = clamp(r.height / r.width / 1.72, 0.9, 1.28);
  const gardenTop = r.height - 292 * u * gs;
  const zone = Math.max(200 * u, gardenTop + 22 * u - top);
  hero.style.setProperty('--txt-top', top.toFixed(1) + 'px');
  hero.style.setProperty('--txt-h', zone.toFixed(1) + 'px');
  hero.style.setProperty('--hs', clamp(zone / (285 * u), 0.8, 1.26).toFixed(3));
  fitNames();
}

// The names are set in a wide script: shrink them until the longer one sits clear of the curtains.
function fitNames() {
  const r = hero.getBoundingClientRect();
  if (!r.width) return;
  hero.style.setProperty('--ns', '1');
  let need = 0;
  $$('.name').forEach((n) => {
    const fs = parseFloat(getComputedStyle(n).fontSize) || 1;
    const range = document.createRange(); range.selectNodeContents(n);
    need = Math.max(need, range.getBoundingClientRect().width + fs * 0.12);
  });
  const room = r.width * 0.69;
  if (need > room) hero.style.setProperty('--ns', (room / need).toFixed(3));
}

/* ── the opening ── */

async function startSound(withPress) {
  const ok = await sound.enable();
  if (!ok) return;
  soundBtn.setAttribute('aria-pressed', 'true');
  if (withPress) { sound.play('press'); setTimeout(() => sound.play('doors'), 240); }
  if (state.opened) sound.startMusic();          // the music begins with the tap
}

function beat(name) {
  if (name === 'doors') hero.classList.add('is-lit');
  if (name === 'curtain') sound.play('curtain');
  if (name === 'reveal') {
    state.revealed = true;
    hero.classList.add('is-revealed');
    sound.play('reveal');
    if (sound.on) sound.startMusic();
  }
  if (name === 'done') {
    state.done = true;
    hero.classList.add('is-done');
    html.classList.remove('is-locked');
    sweep();
    if (state.pending) {
      const target = $(state.pending); state.pending = null;
      if (target) requestAnimationFrame(() => { target.scrollIntoView(); if (target.focus) target.focus({ preventScroll: true }); sweep(); });
    }
  }
}

function openInvite(instant = false) {
  if (state.opened) return;
  if (!state.booted) {
    // tapped while the scene was still loading: remember it, and unlock sound while we are inside the tap
    state.wantOpen = true;
    if (C.sound !== false) sound.enable().then((ok) => { if (ok) soundBtn.setAttribute('aria-pressed', 'true'); });
    return;
  }
  state.opened = true;
  hero.classList.remove('is-closed');
  const quick = instant || reducedMotion();
  if (C.sound !== false && !instant) { sound.prime(); startSound(true); }
  if (!quick) {
    const r = $('#seal').getBoundingClientRect();
    if (r.width) fx.dust(r.left + r.width / 2, r.top + r.height / 2, 36);
  }
  if (state.gl) { if (quick) scene.jump(); else scene.open(); }
  else {
    const at = quick ? [0, 0, 0, 0] : [300, 500, 900, 2600];
    ['doors', 'curtain', 'reveal', 'done'].forEach((n, i) => setTimeout(() => beat(n), at[i]));
  }
}

/* ── the sections ── */

function column() { const r = $('#details').getBoundingClientRect(); return r.width ? r : hero.getBoundingClientRect(); }

function initSections() {
  html.style.setProperty('--paper-tile', paperTile());
  if (C.draft) $('#draft').hidden = false;

  const plate = $('#plate');
  plate.classList.add('is-idle');
  plate.addEventListener('click', () => {
    plate.classList.remove('is-idle');
    state.blessings++; store.set('hs-bless', String(state.blessings));
    const r = plate.getBoundingClientRect(), c = column();
    fx.burst(r.left + r.width / 2, r.top + r.height * 0.42, 24, 0.7);
    fx.rain(22, c.left, c.right);
    sound.play('petal');
    blessLine();
  });

  // RSVP
  const form = $('#rsvpForm'), done = $('#rsvpDone'), out = $('#gOut'), err = $('#rsvpError'), fName = $('#fName');
  const setGuests = (n) => { state.guests = clamp(n, 1, 12); out.textContent = String(state.guests); };
  $('#gMinus').addEventListener('click', () => setGuests(state.guests - 1));
  $('#gPlus').addEventListener('click', () => setGuests(state.guests + 1));
  fName.addEventListener('input', () => { err.hidden = true; });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = fName.value.trim();
    if (!name) { err.hidden = false; fName.focus(); return; }
    const s = S();
    const when = fmtDate(C.wedding.start, state.lang, { day: 'numeric', month: 'long', year: 'numeric' });
    const msg = s.waYes(name, state.guests, when);
    const num = String((C.rsvp && C.rsvp.whatsapp) || '').replace(/\D/g, '');
    const a = el('a', { href: `https://wa.me/${num}?text=${encodeURIComponent(msg)}`, target: '_blank', rel: 'noopener' });
    document.body.append(a); a.click(); a.remove();
    form.hidden = true; done.hidden = false;
    $('#rsvpDoneText').textContent = s.doneYes(state.guests);
    done.focus({ preventScroll: true });
    const c = column(); fx.rain(30, c.left, c.right); sound.play('sparkle');
  });
  $('#rsvpAgain').addEventListener('click', () => { done.hidden = true; form.hidden = false; fName.focus(); });

  $('#shareBtn').addEventListener('click', async () => {
    const url = location.origin + location.pathname;
    const data = { title: document.title, text: S().shareText(L(C.couple.groom.name), L(C.couple.bride.name)), url };
    if (navigator.share) { try { await navigator.share(data); } catch (e) { /* the guest closed the share sheet */ } return; }
    try { await navigator.clipboard.writeText(url); $('#copied').textContent = S().copied; }
    catch (e) { $('#copied').textContent = url; }
  });

  // the seal at the end: the card that opened the invitation comes back with their initials
  const mono = $('#mono');
  mono.addEventListener('click', () => {
    const r = mono.getBoundingClientRect();
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, 60, 1.2);
    sound.play('sparkle');
    mono.classList.remove('is-pop'); void mono.offsetWidth; mono.classList.add('is-pop');
  });
  mono.addEventListener('pointermove', (e) => {
    const r = mono.getBoundingClientRect();
    mono.style.setProperty('--rx', (((e.clientY - r.top) / r.height - 0.5) * -14).toFixed(1) + 'deg');
    mono.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 16).toFixed(1) + 'deg');
  });
  mono.addEventListener('pointerleave', () => { mono.style.setProperty('--rx', '0deg'); mono.style.setProperty('--ry', '0deg'); });

  sweep = initReveals();
}

/* ── controls ── */

function initControls() {
  hero.addEventListener('click', () => { if (!state.opened) openInvite(); });
  soundBtn.addEventListener('click', () => {
    if (sound.on) { sound.disable(); soundBtn.setAttribute('aria-pressed', 'false'); }
    else startSound(false);
  });
  langBtn.addEventListener('click', () => {
    state.lang = state.lang === 'en' ? 'ta' : 'en';
    store.set('hs-lang', state.lang);
    applyLang();
    if (state.gl && !state.opened) { scene.paintDoorNow(); scene.renderNow(); }
    sweep();
  });
  $('.skip').addEventListener('click', (e) => {
    if (state.done) return;
    e.preventDefault(); state.pending = '#details'; openInvite(true);
  });

  addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    scene.setPointer(((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2, ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2);
  }, { passive: true });
  // Tilt lights the paper on phones that share their orientation without a permission prompt.
  if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
    addEventListener('deviceorientation', (e) => {
      if (e.gamma == null || e.beta == null) return;
      scene.setPointer(clamp(e.gamma / 22, -1, 1), clamp((e.beta - 42) / 22, -1, 1));
    }, { passive: true });
  }

  let lw = innerWidth, lh = innerHeight, timer = null;
  addEventListener('resize', () => {
    const coarse = matchMedia('(pointer: coarse)').matches;
    if (innerWidth === lw && (coarse || innerHeight === lh)) return;   // the URL bar sliding away is not a resize
    lw = innerWidth; lh = innerHeight;
    clearTimeout(timer);
    timer = setTimeout(() => {
      layoutHero();
      if (state.gl) { scene.build(); scene.renderNow(); }
    }, 180);
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((ents) => {
      if (!state.gl) return;
      if (ents[0].isIntersecting && !document.hidden) scene.start(); else scene.stop();
    }, { threshold: 0 }).observe(hero);
  }
  document.addEventListener('visibilitychange', () => {
    if (!state.gl) return;
    if (document.hidden) scene.stop(); else if (hero.getBoundingClientRect().bottom > 0) scene.start();
  });
}

/* ── start ── */

async function boot() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  applyLang();
  layoutHero();
  initControls();
  initSections();

  // the seal's lettering is drawn on a canvas, so its typefaces have to be in before the first frame
  if (document.fonts && document.fonts.load) {
    const wait = Promise.all([
      document.fonts.load('700 20px "Cormorant Garamond"', 'TAP TO OPEN'),
      document.fonts.load('700 20px "Noto Serif Tamil"', 'திறக்கத் தொடுங்கள்'),
      document.fonts.load('italic 700 40px "Cormorant Garamond"', 'Hariharan Swetha'),
    ]).catch((err) => { console.warn('[fonts]', err); });
    await Promise.race([wait, new Promise((res) => setTimeout(res, 1800))]);
  }

  layoutHero();

  try {
    state.gl = scene.init();
    if (state.gl) {
      scene.build();
      scene.renderNow();
      hero.classList.add('is-live');
      scene.start();
    }
  } catch (err) {
    state.gl = false;
    console.warn('[scene] disabled, showing the still version:', err);
  }
  if (!state.gl) { hero.classList.add('no-gl'); $('#loaderLine').textContent = S().sealLabel; }

  state.booted = true;
  if (params.has('t')) {                       // ?t=3.2 freezes the opening at that second (for checking)
    state.opened = true; hero.classList.remove('is-closed');
    if (state.gl) scene.jump(parseFloat(params.get('t')) || 0);
  } else if (params.has('open')) {
    openInvite(true);
  } else if (location.hash.length > 1 && document.getElementById(location.hash.slice(1)) && location.hash !== '#top') {
    state.pending = location.hash; openInvite(true);
  }
  if (state.wantOpen) openInvite();
  window.__invite = { scene, sound, fx, state, openInvite };
}

boot().catch((err) => { console.error('[invite] could not start:', err); html.classList.remove('is-locked'); });
