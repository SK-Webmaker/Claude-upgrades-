// The small engine the presenter-free reels share. Everything on screen is a
// function of t (seconds), so tools/render-page.mjs can seek to any frame and
// get the same picture every time.
//
//   at([[t0, v0], [t1, v1], ...], t, ease)   value between keyframes
//   anim(el, t, { o, x, y, s, r, b })        each prop is a keyframe list
//   Broll(img, name, frames)                 a Higgsfield clip as a frame sequence
//   words(el, text, start, step)             reveal a line one word per step

export const ease = {
  out: (p) => 1 - Math.pow(1 - p, 3),
  inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  back: (p) => { const c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
  lin: (p) => p,
};

export function at(keys, t, e = ease.out) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]; const [t0, v0] = keys[i - 1];
    if (t <= t1) { const p = t1 === t0 ? 1 : (t - t0) / (t1 - t0); return v0 + (v1 - v0) * e(p); }
  }
  return keys[keys.length - 1][1];
}

const DEF = { o: [[0, 1]], x: [[0, 0]], y: [[0, 0]], s: [[0, 1]], r: [[0, 0]], b: [[0, 0]] };
export function anim(el, t, k, e = ease.out) {
  const v = (n) => at(k[n] || DEF[n], t, n === 's' && k.back ? ease.back : e);
  const o = v('o');
  el.style.opacity = o;
  el.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
  el.style.transform = `translate(${v('x')}px, ${v('y')}px) scale(${v('s')}) rotate(${v('r')}deg)`;
  const b = v('b'); el.style.filter = b > 0.05 ? `blur(${b}px)` : 'none';
}

// A pop-in: hidden before t0, overshoots in, stays (until t1 if given).
export function pop(el, t, t0, t1 = Infinity, { from = 0.6, y = 40 } = {}) {
  const o = t < t0 ? 0 : t >= t1 ? Math.max(0, 1 - (t - t1) / 0.15) : Math.min(1, (t - t0) / 0.08);
  const s = t < t0 ? from : at([[t0, from], [t0 + 0.28, 1]], t, ease.back);
  const dy = t < t0 ? y : at([[t0, y], [t0 + 0.28, 0]], t);
  el.style.opacity = o; el.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
  el.style.transform = `translateY(${dy}px) scale(${s})`;
}

// A Higgsfield clip, extracted by tools/broll-frames.mjs to reel/out/broll/<name>/00001.jpg…
// Played at 30 fps from `start`, holding the last frame (or looping).
export function Broll(img, name, frames, { loop = false, bounce = false } = {}) {
  let last = '';
  return (local) => {
    let i = Math.floor(local * 30);
    // bounce: past the last frame, play back towards the first instead of freezing
    if (bounce && i >= frames) { const p = 2 * (frames - 1); i %= p; if (i >= frames) i = p - i; }
    i = loop ? ((i % frames) + frames) % frames : Math.max(0, Math.min(frames - 1, i));
    const src = `out/broll/${name}/${String(i + 1).padStart(5, '0')}.jpg`;
    if (src === last) return Promise.resolve();
    last = src;
    return new Promise((ok) => { img.onload = ok; img.onerror = ok; img.src = src; });
  };
}

// One word per `step` seconds from `start`; each word pops up from below.
export function words(el, t, start, step) {
  const ws = el.querySelectorAll('.w');
  ws.forEach((w, i) => {
    const t0 = start + i * step;
    const o = t < t0 ? 0 : Math.min(1, (t - t0) / 0.06);
    const y = t < t0 ? 60 : at([[t0, 60], [t0 + 0.22, 0]], t, ease.back);
    w.style.opacity = o; w.style.transform = `translateY(${y}px)`;
  });
}

/** Wrap each word of el's text in <span class="w">, keeping <b>-style spans whole. */
export function split(el) {
  el.innerHTML = el.innerHTML.replace(/(<[^>]+>[^<]*<\/[^>]+>|[^\s<]+)/g, '<span class="w">$1</span>');
  return el;
}

export const money = (n, cents = false) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
