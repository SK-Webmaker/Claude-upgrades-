/**
 * Hair art — the illustrated design elements that replace photographs.
 *
 * Why this exists: the photo library ran dry. Every face-free photograph of her
 * work had been used two or three times, and the brunette waves on ig-01 had
 * become the account's wallpaper. Invariant 2 rules out AI-generated hair, so
 * the replacement is drawn, not generated: hair as a colourist sees it — strands
 * with a root-to-end gradient, a swatch book, a foil, a gloss drop.
 *
 * Everything is plain SVG built from a seeded random stream, so a card renders
 * identically every time and the reels can animate the same strands frame by
 * frame (each path carries pathLength="1", so a draw-in is one dashoffset).
 */

/** Deterministic PRNG — mulberry32. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hair colour ramps, root → ends, as [offset, colour] stops. */
export const HAIR = {
  balayage: [[0, '#2B1A12'], [0.3, '#5A3520'], [0.58, '#A8692F'], [0.8, '#D9A55C'], [1, '#F2D39A']],
  blonde: [[0, '#6E5134'], [0.25, '#B08954'], [0.6, '#E2C088'], [1, '#FAEBC8']],
  honey: [[0, '#4A2C18'], [0.45, '#A3662C'], [0.8, '#DDA14E'], [1, '#F5CB7E']],
  copper: [[0, '#3F1A0E'], [0.4, '#8E3F1F'], [0.75, '#CF6D35'], [1, '#F0A064']],
  espresso: [[0, '#140C08'], [0.5, '#3B2416'], [0.85, '#6E4428'], [1, '#9A6538']],
  toner: [[0, '#4A3D6B'], [0.4, '#7E6DA8'], [0.75, '#C3B3DE'], [1, '#EEE6F6']],
  icy: [[0, '#6C6A70'], [0.35, '#B9B6BC'], [0.75, '#E8E5E6'], [1, '#FFFFFF']],
  rose: [[0, '#3E1F22'], [0.45, '#8C4E4E'], [0.8, '#D59A8E'], [1, '#F2C9BC']],
  caramel: [[0, '#2E1C12'], [0.4, '#6E4524'], [0.75, '#B98246'], [1, '#E3B878']],
  brassy: [[0, '#33261C'], [0.45, '#7A5E3E'], [0.8, '#A88B5E'], [1, '#BFA578']],
  gold: [[0, '#7A5320'], [0.45, '#C08B3E'], [0.8, '#E7C27C'], [1, '#FBE7B8']],
};

let UID = 0;
const uid = (p) => `${p}${++UID}`;

function gradient(id, stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1, units = 'objectBoundingBox' } = {}) {
  return `<linearGradient id="${id}" gradientUnits="${units}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</linearGradient>`;
}

/** Catmull-Rom through points → a smooth cubic path. */
function smooth(pts) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * A fall of hair: n strands flowing top → bottom inside a w×h box.
 * The bundle shares one S-curve (so it reads as a single lock with movement)
 * and each strand adds its own drift. A sheen band of lighter strands sits
 * across the middle, which is what makes drawn hair read as glossy rather
 * than as string.
 *
 * Returns an SVG <g> string. Coordinates are local to the box.
 */
export function strands({
  w, h, seed = 1, n = 140, ramp = HAIR.balayage, sway = 0.12, waves = 1.4, phase = 0,
  spread = 1, taper = 0.25, width = [1.2, 3.4], sheen = 0.5, cls = 'st', opacity = 1, jitter = 0.12, body = 0.35,
}) {
  const r = rng(seed);
  const g = uid('hg'), s = uid('hs');
  const defs = `<defs>${gradient(g, ramp, { units: 'userSpaceOnUse', y2: h })}
    ${gradient(s, [[0, '#fff', 0], [0.42, '#fff', 0], [0.5, '#fff', 0.9], [0.58, '#fff', 0], [1, '#fff', 0]], { units: 'userSpaceOnUse', y2: h })}</defs>`;
  const paths = [];
  const steps = 9;
  for (let i = 0; i < n; i++) {
    const u = (i + r() * 0.9) / n; // position across the lock, 0..1
    const x0 = w * (0.5 + (u - 0.5) * spread);
    const own = (r() - 0.5) * w * 0.05;
    const ph = phase + (r() - 0.5) * jitter;
    const pts = [];
    for (let k = 0; k <= steps; k++) {
      const v = k / steps;
      // ends taper toward the centre line, like a swatch or a cut end
      const tx = (x0 - w / 2) * (1 - taper * Math.pow(v, 1.6)) + w / 2;
      const x = tx + Math.sin((v * waves + ph) * Math.PI * 2) * w * sway * (0.4 + v) + own * v;
      const y = v * h * (0.94 + r() * 0.06);
      pts.push([x, y]);
    }
    // A body layer of wide, soft strokes underneath gives the lock mass, so
    // it reads as a head of hair rather than loose threads.
    if (r() < body) paths.push(`<path class="${cls}" pathLength="1" d="${smooth(pts)}" stroke="url(#${g})" stroke-width="${(width[1] * 2.4).toFixed(1)}" stroke-opacity=".28"/>`);
    const sw = (width[0] + r() * (width[1] - width[0])).toFixed(2);
    const a = (0.55 + r() * 0.45).toFixed(2);
    paths.push(`<path class="${cls}" pathLength="1" d="${smooth(pts)}" stroke="url(#${g})" stroke-width="${sw}" stroke-opacity="${a}"/>`);
    if (r() < sheen) paths.push(`<path class="${cls}" pathLength="1" d="${smooth(pts)}" stroke="url(#${s})" stroke-width="${(sw * 0.6).toFixed(2)}" stroke-opacity="${(a * 0.7).toFixed(2)}"/>`);
  }
  return `${defs}<g fill="none" stroke-linecap="round" opacity="${opacity}">${paths.join('')}</g>`;
}

/** A standalone strands SVG element sized w×h. */
export function strandsSvg(opts, style = '') {
  return `<svg width="${opts.w}" height="${opts.h}" viewBox="0 0 ${opts.w} ${opts.h}" style="overflow:visible;${style}">${strands(opts)}</svg>`;
}

/**
 * A swatch — the sample lock a colourist holds up against your hair. A dark
 * clip across the top with the shade on it, the lock hanging below and
 * tapering to a point.
 */
export function swatch({ w = 150, h = 560, ramp = HAIR.balayage, seed = 3, label = '', sub = '', clip = '#12100E', ink = '#F6F1E9', n = 70 }) {
  const ch = Math.round(w * 0.5);
  return `<g>
    <g transform="translate(0 ${ch - 8})">${strands({ w, h: h - ch + 8, seed, n, ramp, sway: 0.035, waves: 0.8, taper: 0.82, width: [1.4, 3.2], sheen: 0.45 })}</g>
    <rect x="-4" y="0" width="${w + 8}" height="${ch}" rx="${Math.round(w * 0.12)}" fill="${clip}"/>
    <rect x="${w * 0.1}" y="${ch * 0.18}" width="${w * 0.8}" height="4" rx="2" fill="${ink}" opacity=".25"/>
    ${label ? `<text x="${w / 2}" y="${ch * 0.62}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${Math.round(w * 0.2)}" fill="${ink}" letter-spacing="-1">${label}</text>` : ''}
    ${sub ? `<text x="${w / 2}" y="${ch * 0.86}" text-anchor="middle" font-family="Inter" font-weight="700" font-size="${Math.round(w * 0.085)}" fill="${ink}" opacity=".7" letter-spacing="2">${sub}</text>` : ''}
  </g>`;
}

/**
 * A fan of swatches pivoting from one point, like a shade book spread open.
 * items: [{ramp,label,sub}]. Each swatch gets class "sw" and a data-a angle so a
 * reel can re-fan it.
 */
export function swatchFan({ items, w = 150, h = 620, spread = 64, cx = 0, cy = 0, pivot = 260, clip, ink, n }) {
  const k = items.length;
  return items
    .map((it, i) => {
      const a = k === 1 ? 0 : -spread / 2 + (spread * i) / (k - 1);
      // The pivot sits above the clips, so the clips spread along an arc
      // instead of stacking on one point.
      return `<g class="sw" data-a="${a.toFixed(2)}" style="transform-origin:${cx}px ${cy - pivot}px;transform:rotate(${a.toFixed(2)}deg)">
        <g transform="translate(${cx - w / 2} ${cy})">${swatch({ w, h, clip, ink, n, ...it, seed: 11 + i * 7 })}</g></g>`;
    })
    .join('');
}

/**
 * A foil: the folded aluminium packet a highlight is processed in. Brushed
 * metal from stacked gradients, two fold creases, and the lock of hair it holds
 * showing below the fold.
 */
export function foil({ w = 300, h = 420, tone = 'gold', seed = 5, ramp = HAIR.blonde, foldAt = 0.62, tail = 170 }) {
  const f = uid('fo'), sh = uid('fs');
  const metal =
    tone === 'gold'
      ? [[0, '#8C6428'], [0.18, '#E9C98A'], [0.36, '#B58A43'], [0.55, '#F7E3B4'], [0.74, '#A77B36'], [1, '#E0BD7A']]
      : [[0, '#7F8187'], [0.18, '#E9EAEE'], [0.36, '#A4A6AC'], [0.55, '#FAFAFC'], [0.74, '#94969C'], [1, '#D8D9DE']];
  const fold = h * foldAt;
  return `<g>
    <defs>${gradient(f, metal, { x1: 0, y1: 0, x2: 1, y2: 0.35 })}
      ${gradient(sh, [[0, '#fff', 0], [0.45, '#fff', 0.55], [0.55, '#fff', 0], [1, '#fff', 0]], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>
    <path d="M8,14 H${w + 10} V${fold + 14} L${w * 0.94 + 10},${fold + 32} H${w * 0.06 + 8} L8,${fold + 14} Z" fill="#000" opacity=".28"/>
    <g transform="translate(${w * 0.18} ${fold - 20})">${strands({ w: w * 0.64, h: h - fold + tail, seed, n: 60, ramp, sway: 0.05, waves: 0.7, taper: 0.55, width: [1.4, 3], sheen: 0.4 })}</g>
    <path d="M0,0 H${w} V${fold} L${w * 0.94},${fold + 18} H${w * 0.06} L0,${fold} Z" fill="url(#${f})"/>
    <path d="M0,0 H${w} V${fold} L${w * 0.94},${fold + 18} H${w * 0.06} L0,${fold} Z" fill="url(#${sh})"/>
    ${[0.2, 0.4, 0.6].filter((k) => k * h < fold - 10).map((k) => `<path d="M0,${h * k} H${w}" stroke="#000" stroke-opacity=".2" stroke-width="3"/><path d="M0,${h * k + 3} H${w}" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>`).join('')}
    <path d="M${w * 0.5},4 V${fold - 6}" stroke="#000" stroke-opacity=".08" stroke-width="2"/>
  </g>`;
}

/**
 * A gloss drop — one droplet of toner with a specular highlight. The shape is
 * a teardrop point-up, which is how it reads as liquid rather than a balloon.
 */
export function drop({ w = 300, c1 = '#C3B3DE', c2 = '#4A3D6B', glint = '#fff' }) {
  const h = w * 1.34, rg = uid('dr'), hl = uid('dh');
  return `<g>
    <defs>
      <radialGradient id="${rg}" cx=".38" cy=".62" r=".75"><stop offset="0" stop-color="${c1}"/><stop offset=".7" stop-color="${c2}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
      <radialGradient id="${hl}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${glint}" stop-opacity=".95"/><stop offset="1" stop-color="${glint}" stop-opacity="0"/></radialGradient>
    </defs>
    <path d="M${w / 2},0 C${w * 0.62},${h * 0.2} ${w},${h * 0.44} ${w},${h * 0.66} A${w / 2},${w / 2} 0 1 1 0,${h * 0.66} C0,${h * 0.44} ${w * 0.38},${h * 0.2} ${w / 2},0 Z" fill="url(#${rg})"/>
    <ellipse cx="${w * 0.3}" cy="${h * 0.6}" rx="${w * 0.09}" ry="${w * 0.17}" fill="url(#${hl})" transform="rotate(18 ${w * 0.3} ${h * 0.6})"/>
    <ellipse cx="${w * 0.68}" cy="${h * 0.86}" rx="${w * 0.06}" ry="${w * 0.03}" fill="${glint}" opacity=".35"/>
  </g>`;
}

/** Scattered sparkle stars — four-point glints for a gloss/shine moment. */
export function glints({ w, h, seed = 9, n = 12, color = '#FBE7B8', size = [10, 34] }) {
  const r = rng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, s = size[0] + r() * (size[1] - size[0]);
    out += `<path class="twk" d="M${x},${y - s} Q${x + s * 0.14},${y - s * 0.14} ${x + s},${y} Q${x + s * 0.14},${y + s * 0.14} ${x},${y + s} Q${x - s * 0.14},${y + s * 0.14} ${x - s},${y} Q${x - s * 0.14},${y - s * 0.14} ${x},${y - s} Z" fill="${color}" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
  }
  return out;
}
