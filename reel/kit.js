// The feature reels' moving parts (styles in reel/kit.css). Like reel/lib.js,
// everything is a function of t, so a frame rendered twice is the same frame.
//
//   const phone = Phone(container)                 a 3D phone holding real captures
//   phone.screens(t, [[t0, src], [t1, src]…])      crossfades between screens
//   phone.pose(t, [[t0, pose], [t1, pose]…])       pose = { cx, cy, s, rx, ry, rz, x, y }:
//                                                  screen point (cx, cy) in capture pixels,
//                                                  put at (x, y) in the frame, scaled by s
//   phone.place(el, rect, pad)                     an overlay on a real UI element
//   tap / ring / notif / slam / say                small timed effects
import { at, ease, pop } from './lib.js';

export const K = 600 / 1170;        // capture pixels → screen pixels
const BEZEL = 18;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mk = (cls, html = '') => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; return e; };

export function Phone(parent) {
  const root = mk('p3d', `<div class="p3d-body"><div class="p3d-screen"><img class="ia" alt=""><img class="ib" alt=""><div class="p3d-fx"></div></div>
    <div class="p3d-island"></div><div class="p3d-glare"></div></div>`);
  parent.appendChild(root);
  const body = root.querySelector('.p3d-body');
  const ia = root.querySelector('.ia'), ib = root.querySelector('.ib');
  const fx = root.querySelector('.p3d-fx'), glare = root.querySelector('.p3d-glare');
  const setSrc = (img, src) => { if (img.getAttribute('src') !== src) img.setAttribute('src', src); };
  return {
    root, fx,
    show(on) { root.style.visibility = on ? 'visible' : 'hidden'; },
    screens(t, list) {
      let i = 0;
      while (i + 1 < list.length && list[i + 1][0] <= t) i++;
      const [t0, src] = list[i];
      const prev = i > 0 ? list[i - 1][1] : src;
      const k = i > 0 ? clamp01((t - t0) / 0.2) : 1;
      setSrc(ia, prev); setSrc(ib, src);
      ib.style.opacity = k;
    },
    pose(t, keys) {
      const f = (name, dflt) => at(keys.map(([tk, p]) => [tk, p[name] ?? dflt]), t, ease.inOut);
      const cx = f('cx', 585), cy = f('cy', 1266), s = f('s', 1), x = f('x', 540), y = f('y', 1000);
      const rx = f('rx', 0), ry = f('ry', 0), rz = f('rz', 0);
      const ox = BEZEL + cx * K, oy = BEZEL + cy * K;
      body.style.transformOrigin = `${ox}px ${oy}px`;
      body.style.transform = `translate(${x - ox}px, ${y - oy}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;
      glare.style.backgroundPosition = `${50 + ry * 3 + rx * 1.5}% 0`;
    },
    // An overlay on a real element: rect in capture pixels, pad in capture pixels.
    place(el, r, pad = 14) {
      if (el.parentNode !== fx) fx.appendChild(el);
      Object.assign(el.style, { left: `${(r.x - pad) * K}px`, top: `${(r.y - pad) * K}px`, width: `${(r.w + 2 * pad) * K}px`, height: `${(r.h + 2 * pad) * K}px` });
    },
    point(el, r) {
      if (el.parentNode !== fx) fx.appendChild(el);
      Object.assign(el.style, { left: `${(r.x + r.w / 2) * K}px`, top: `${(r.y + r.h / 2) * K}px` });
    },
  };
}

/** A fingertip tap at t0: a soft disc that presses in and fades. */
export function tap(el, t, t0) {
  const on = t >= t0 - 0.12 && t < t0 + 0.45;
  el.style.visibility = on ? 'visible' : 'hidden';
  if (!on) return;
  const s = t < t0 ? at([[t0 - 0.12, 1.3], [t0, 0.8]], t) : at([[t0, 0.8], [t0 + 0.45, 1.6]], t);
  const o = t < t0 ? at([[t0 - 0.12, 0], [t0, 1]], t) : at([[t0, 1], [t0 + 0.45, 0]], t);
  el.style.transform = `scale(${s})`; el.style.opacity = o;
}

/** A ring of light from t0 to t1, breathing while it is up. */
export function ring(el, t, t0, t1 = Infinity) {
  const on = t >= t0 && t < t1 + 0.2;
  el.style.visibility = on ? 'visible' : 'hidden';
  if (!on) return;
  const inK = clamp01((t - t0) / 0.25), outK = t > t1 ? clamp01((t - t1) / 0.2) : 0;
  el.style.opacity = inK * (1 - outK);
  el.style.transform = `scale(${at([[t0, 1.25], [t0 + 0.3, 1]], t, ease.back) + 0.015 * Math.sin((t - t0) * 7)})`;
}

/** An iOS-style notification. `stack` = later notifications that push it down. */
export function makeNotif(parent, { app = 'KAIRO', title, body, when = 'now', icon = 'K', iconBg = '' }) {
  const el = mk('notif', `<div class="ic" style="${iconBg ? `background:${iconBg}` : ''}">${icon}</div><div style="flex:1;min-width:0"><div class="top"><span>${app}</span><span>${when}</span></div>
    <div class="ttl"></div><div class="msg"></div></div>`);
  el.querySelector('.ttl').textContent = title; el.querySelector('.msg').textContent = body;
  parent.appendChild(el);
  return el;
}
export function notif(el, t, t0, top, later = [], gap = 236, t1 = Infinity) {
  const on = t >= t0 && t < t1 + 0.25;
  el.style.visibility = on ? 'visible' : 'hidden';
  if (!on) return;
  let push = 0;
  for (const tl of later) push += gap * ease.out(clamp01((t - tl) / 0.3));
  const drop = at([[t0, -140], [t0 + 0.35, 0]], t, ease.back);
  const n = later.filter((tl) => t >= tl).length;
  el.style.top = `${top + push + drop}px`;
  el.style.opacity = clamp01((t - t0) / 0.12) * (1 - 0.15 * n) * (t > t1 ? 1 - clamp01((t - t1) / 0.25) : 1);
  el.style.transform = `scale(${1 - 0.03 * n})`;
}

/** One loud word: lands big and blurred, settles sharp. Gone after t1. */
export function slam(el, t, t0, t1 = Infinity) {
  const on = t >= t0 && t < t1;
  el.style.visibility = on ? 'visible' : 'hidden';
  if (!on) return;
  const k = clamp01((t - t0) / 0.2);
  el.style.opacity = Math.min(1, k * 2);
  el.style.transform = `scale(${1.7 - 0.7 * ease.out(k)})`;
  el.style.filter = k < 1 ? `blur(${14 * (1 - k)}px)` : 'none';
}

/** A line that pops in at t0 and fades out at t1. */
export function say(el, t, t0, t1 = Infinity, opts) {
  pop(el, t, t0, t1, opts);
}

/** A highlighter swipe from t0 (the word stays white until the marker is under it). */
export function hl(el, t, t0) {
  const k = at([[t0, 0], [t0 + 0.25, 1]], t);
  el.style.setProperty('--hl', k);
  el.style.color = k > 0.7 ? '#0b0b0d' : '#fff';
}

/** The stage's glows drift slowly. */
export function stage(el, t, on) {
  el.style.visibility = on ? 'visible' : 'hidden';
  if (!on) return;
  const [g1, g2] = el.querySelectorAll('.glow');
  g1.style.transform = `translate(${-200 + 140 * Math.sin(t * 0.5)}px, ${300 + 120 * Math.cos(t * 0.4)}px)`;
  g2.style.transform = `translate(${420 + 120 * Math.cos(t * 0.45)}px, ${900 + 140 * Math.sin(t * 0.35)}px)`;
}

/** A warm light leak across a cut at tc. */
export function leak(el, t, tc) {
  const k = (t - (tc - 0.25)) / 0.6;
  const on = k > 0 && k < 1;
  el.style.visibility = on ? 'visible' : 'hidden';
  if (!on) return;
  el.style.opacity = Math.sin(Math.PI * k) * 0.9;
  el.style.transform = `translateX(${-700 + 1400 * k}px)`;
}

/** Film grain, rebuilt each frame from t so it moves but repeats exactly. */
export function grain(canvas, t) {
  const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  const img = c.createImageData(w, h); let seed = Math.floor(t * 30) * 9301 + 49297;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 9301 + 49297) % 233280; const v = (seed / 233280) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
}
