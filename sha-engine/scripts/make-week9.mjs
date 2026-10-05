#!/usr/bin/env node
/**
 * Week 9 posts — "Race week". Caulfield Cup is Saturday 17 October, and the
 * weekend is what needs filling (Sat 9–5, Sun 11–4 — Kairo's hours).
 *
 *   P1  Salon client bingo     the sendable one: nine squares she has seen
 *   P2  The race-day form guide services as runners, Saturday as the meeting
 *   P3  Sunday reset            a ticket stub for the morning after the races
 *   C1  Which blonde are you?   six slides: pick a shade, get its upkeep and price
 *
 * Brief from the operator: really eye-catching, educational, very
 * entertaining. So every card is a game or a joke the reader is in on —
 * bingo, a form guide, a quiz — with the education carried inside it.
 *
 * Drawn hair only (lib/hair-art.mjs); no photographs, no AI imagery.
 * Prices from brand.json via svc(); hours are Kairo's.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HAIR, strands, swatchFan, swatch, drop, glints } from './lib/hair-art.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PHOTOS = join(ROOT, 'content', 'photos');
const OUT = join(ROOT, 'content', 'cards');

const INK = '#12100E', CREAM = '#F6F1E9', GOLD = '#C08B3E', FIG = '#2F4032', CLAY = '#C9A88B', VIOLET = '#6A5B8C', HOT = '#A4532F';
const FONTS = readFileSync(join(ROOT, 'assets', 'fonts', 'brand-fonts.css'), 'utf8');
const BRAND = JSON.parse(readFileSync(join(ROOT, 'config', 'brand.json'), 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const chromiumPath = () =>
  [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p)) || undefined;

function svc(name) {
  const s = BRAND.positioning.services.find((x) => x.name === name);
  if (!s) throw new Error(`service not in brand.json: ${name}`);
  return s;
}
const price = (s) => `${s.from ? 'from ' : ''}$${s.price}`;
const hm = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr${m % 60 ? ' ' + (m % 60) : ''}`);
const art = (w, h, body, style = '') =>
  `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;left:0;top:0;overflow:visible;${style}">${body}</svg>`;

/** Kairo's weekend hours — the days this week is written to fill. */
const WEEKEND = 'Sat 9am–5pm · Sun 11am–4pm';

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='5'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

const base = (bg, fg = CREAM) => `${FONTS}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1080px;height:1350px;overflow:hidden}
  body{position:relative;background:${bg};font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;color:${fg}}
  .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.12;mix-blend-mode:multiply;pointer-events:none;z-index:50}
  .fr{font-family:'Fraunces',serif;font-weight:400;font-variation-settings:'opsz' 144;letter-spacing:-.035em;line-height:.9}
  .num{font-family:'Inter',sans-serif;font-weight:800;letter-spacing:-.05em;font-variant-numeric:tabular-nums;line-height:.86}
  .lbl{font-size:20px;letter-spacing:.3em;text-transform:uppercase;font-weight:800}
  .cta{position:absolute;left:0;right:0;bottom:0;height:128px;display:flex;align-items:center;justify-content:space-between;padding:0 64px;z-index:30}
  .cta b{font-size:36px;font-weight:800;letter-spacing:-.01em}
  .cta span{font-size:21px;font-weight:800;letter-spacing:.22em;text-transform:uppercase}
  .eye{position:absolute;left:64px;top:76px;display:flex;gap:18px;align-items:center;z-index:10}
  .eye i{width:90px;height:5px}
`;

/* =============================================================== P1 bingo */
function bingo() {
  // Nine squares she has genuinely seen, each one a lesson in disguise. The
  // centre is free, and the free square is the booking.
  const sq = [
    ['“Just a trim”', '(means 10cm)'],
    ['Showed me a photo', 'with a filter on it'],
    ['Washed it the night', 'after colour'],
    ['Purple shampoo.', 'Every. Single. Day.'],
    null,
    ['“It was box dye,', 'but only once”'],
    ['Straightener', 'on the top setting'],
    ['Last trim?', '“2024, maybe”'],
    ['Slept on it', 'soaking wet'],
  ];
  const marked = new Set([0, 3, 7]); // a played card reads as a game, not a list
  const cell = 258, gap = 16, gx = (1080 - (cell * 3 + gap * 2)) / 2, gy = 396;
  const dab = (i) => {
    const r = [-12, 9, -5][[0, 3, 7].indexOf(i)] || 0;
    return `<div style="position:absolute;left:50%;top:50%;width:206px;height:206px;margin:-103px 0 0 -103px;border-radius:50%;
      background:radial-gradient(circle at 42% 38%,rgba(106,91,140,.55),rgba(106,91,140,.42) 60%,rgba(106,91,140,.18) 72%,transparent 74%);transform:rotate(${r}deg) scale(${1 + (i % 2) * 0.05})"></div>`;
  };
  return `<html><head><meta charset="utf-8"><style>${base(VIOLET)}
    body{background:radial-gradient(ellipse at 50% 40%,#7A6A9E,#4E4170 70%,#3A3056)}
    .sq{position:absolute;width:${cell}px;height:${cell}px;background:${CREAM};color:${INK};border-radius:22px;overflow:hidden;
        display:flex;flex-direction:column;justify-content:center;padding:0 26px;box-shadow:0 10px 0 rgba(18,16,14,.25)}
    .sq b{font-size:30px;font-weight:800;letter-spacing:-.02em;line-height:1.1;position:relative;z-index:2}
    .sq span{font-size:23px;font-weight:600;margin-top:8px;color:rgba(18,16,14,.66);line-height:1.2;position:relative;z-index:2}
    .sq .n{position:absolute;right:16px;top:12px;font-size:22px;font-weight:800;color:rgba(18,16,14,.28)}
  </style></head><body>
    ${art(1080, 1350, `<g transform="translate(700 20)">${glints({ w: 360, h: 200, seed: 91, n: 6, size: [10, 26] })}</g>`)}
    <div class="eye"><i style="background:${GOLD}"></i><span class="lbl" style="color:#E4D9F2">Hair by Sha · play along</span></div>
    <h1 class="fr" style="position:absolute;left:64px;top:128px;font-size:116px;z-index:5">Salon client</h1>
    <div class="num" style="position:absolute;left:58px;top:236px;font-size:156px;color:${GOLD};letter-spacing:.02em;z-index:5">BINGO</div>
    <p style="position:absolute;right:64px;top:254px;width:340px;text-align:right;font-size:27px;font-weight:600;line-height:1.36;color:rgba(246,241,233,.9);z-index:5">
      Count your squares. No judgement — I have seen all nine.</p>
    ${sq
      .map((s, i) => {
        const x = gx + (i % 3) * (cell + gap), y = gy + Math.floor(i / 3) * (cell + gap);
        if (!s)
          return `<div class="sq" style="left:${x}px;top:${y}px;background:${GOLD};color:${INK};align-items:center;text-align:center;padding:0 18px">
            ${art(cell, cell, `<g transform="translate(${cell / 2 - 46} 14) scale(.6)">${swatch({ w: 152, h: 300, ramp: HAIR.honey, label: 'FREE', clip: INK, n: 60, seed: 7 })}</g>`)}
            <b style="margin-top:150px;font-size:28px">You booked</b><b style="font-size:28px">with Sha</b></div>`;
        return `<div class="sq" style="left:${x}px;top:${y}px">${marked.has(i) ? dab(i) : ''}<i class="n">${i < 4 ? i + 1 : i}</i><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div>`;
      })
      .join('')}
    <div class="cta" style="background:${GOLD};color:${INK}"><b>How many did you get?</b><span>Send it to a friend</span></div>
    <div class="grain"></div>
  </body></html>`;
}

/* ========================================================== P2 form guide */
/* Jockey silks drawn in CSS: each runner gets its own pattern and colours. */
const silk = (k) =>
  [
    `background:repeating-linear-gradient(90deg,${GOLD} 0 14px,${INK} 14px 28px)`,
    `background:${VIOLET};box-shadow:inset 0 0 0 12px ${CREAM}`,
    `background:conic-gradient(${FIG} 0 25%,${CREAM} 0 50%,${FIG} 0 75%,${CREAM} 0)`,
    `background:repeating-linear-gradient(0deg,${HOT} 0 13px,${CREAM} 13px 26px)`,
    `background:radial-gradient(circle,${GOLD} 0 30%,${INK} 31%)`,
  ][k % 5];

function formGuide() {
  const runners = [
    ['Blow Wave', svc('Blow Wave'), 'The favourite. Lasts three to five days, so it is still there on Sunday.'],
    ['Cut & Blow Wave', svc('Cut & Blow Wave'), 'Fresh ends hold the bounce. Dry ends drop it by lunch.'],
    ['Toner & Gloss', svc('Toner & Gloss'), 'Shine that shows up in every photo from the members’ lawn.'],
    ['Blow Dry', svc('Blow Dry'), 'Sleek and straight. Best partnered with a fascinator.'],
    ['K18 Treatment', svc('K18 Treatment'), 'Add-on. Repairs the bonds before the hot tools go in.'],
  ];
  return `<html><head><meta charset="utf-8"><style>${base('#EFE6D6', INK)}
    body{background:#EFE6D6}
    .hd{position:absolute;left:0;right:0;top:0;height:92px;background:${FIG};color:${CREAM};display:flex;align-items:center;justify-content:space-between;padding:0 64px}
    .row{position:absolute;left:64px;right:64px;height:146px;border-top:3px solid ${INK};display:grid;grid-template-columns:96px 1fr 210px;align-items:center;gap:26px}
    .silk{width:84px;height:84px;border-radius:50%;border:4px solid ${INK}}
    .nm{font-size:40px;font-weight:800;letter-spacing:-.02em}
    .fm{font-size:23px;font-weight:600;color:rgba(18,16,14,.72);margin-top:6px;line-height:1.3}
    .pr{text-align:right}
    .pr .p{font-size:58px;color:${INK}}
    .pr .t{font-size:20px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${HOT};margin-top:6px}
    .no{position:absolute;left:-2px;top:-3px;background:${INK};color:${CREAM};font-size:18px;font-weight:800;padding:6px 10px}
  </style></head><body>
    <div class="hd"><span class="lbl" style="font-size:21px">The form guide</span><span class="lbl" style="font-size:21px;color:${GOLD}">Caulfield Cup · Sat 17 Oct</span></div>
    <div class="num" style="position:absolute;right:30px;top:96px;font-size:300px;color:transparent;-webkit-text-stroke:3px rgba(18,16,14,.14)">R1</div>
    <h1 class="fr" style="position:absolute;left:64px;top:136px;font-size:122px;line-height:.92">Race-day<br><span style="color:${HOT}">runners.</span></h1>
    <p style="position:absolute;left:64px;top:388px;width:640px;font-size:27px;font-weight:600;line-height:1.38;color:rgba(18,16,14,.78)">
      Every hairstyle on the card, with its form, its time in the chair and its price. Pick your runner.</p>
    ${runners
      .map(
        ([n, s, form], i) => `<div class="row" style="top:${490 + i * 146}px">
          <i class="no">${i + 1}</i>
          <div class="silk" style="${silk(i)}"></div>
          <div><div class="nm">${esc(n)}</div><div class="fm">${esc(form)}</div></div>
          <div class="pr"><div class="p fr">${esc(price(s))}</div><div class="t">${hm(s.minutes)}</div></div>
        </div>`,
      )
      .join('')}
    <div style="position:absolute;left:64px;right:64px;top:1220px;border-top:3px solid ${INK}"></div>
    <div class="cta" style="background:${INK};color:${CREAM};height:118px"><b>DM me your runner</b><span style="color:${GOLD}">${WEEKEND}</span></div>
    <div class="grain"></div>
  </body></html>`;
}

/* ============================================================ P3 Sunday */
function sunday() {
  const k18 = svc('K18 Treatment'), wave = svc('Blow Wave');
  return `<html><head><meta charset="utf-8"><style>${base(INK)}
    body{background:radial-gradient(ellipse at 30% 20%,#2F2624,${INK} 70%)}
    .tix{position:absolute;left:64px;right:64px;top:310px;height:860px;background:${CREAM};color:${INK};border-radius:26px;overflow:hidden;
         -webkit-mask:radial-gradient(circle 34px at 0 62%,transparent 98%,#000) left/51% 100% no-repeat,radial-gradient(circle 34px at 100% 62%,transparent 98%,#000) right/51% 100% no-repeat}
    .perf{position:absolute;left:52px;right:52px;top:62%;border-top:5px dashed rgba(18,16,14,.3)}
    .stub b{font-size:38px;font-weight:800}
  </style></head><body>
    ${art(1080, 300, `<g transform="translate(760 150)">${glints({ w: 280, h: 130, seed: 31, n: 5, size: [10, 24] })}</g>`)}
    <div class="eye"><i style="background:${GOLD}"></i><span class="lbl" style="color:${GOLD}">The morning after the races</span></div>
    <h1 class="fr" style="position:absolute;left:64px;top:128px;font-size:132px;z-index:5">Sunday <span style="color:${GOLD}">reset.</span></h1>
    <div class="tix">
      <div style="position:absolute;right:0;top:0;width:430px;height:62%;background:#140d09;border-radius:0 0 0 220px;overflow:hidden">
        ${art(430, 484, `<g transform="translate(-30 -20)">${strands({ w: 500, h: 540, seed: 141, n: 200, ramp: HAIR.honey, sway: 0.1, waves: 1.3, taper: 0.06, width: [1.3, 3.6], sheen: 0.85 })}</g>${glints({ w: 400, h: 460, seed: 142, n: 6, size: [8, 22] })}`)}
      </div>
      <div style="position:absolute;left:52px;top:46px;width:470px">
        <div class="lbl" style="color:${HOT};font-size:20px">Admit one · Sun 18 Oct</div>
        <p class="fr" style="font-size:58px;line-height:1.02;margin-top:22px">Pins, spray, wind and a very long day.</p>
        <p style="font-size:27px;font-weight:600;line-height:1.4;margin-top:22px;color:rgba(18,16,14,.75)">K18 repairs what the hot tools and hairspray took. A blow wave starts the week fresh.</p>
      </div>
      <i class="perf"></i>
      <div class="stub" style="position:absolute;left:52px;right:52px;top:calc(62% + 44px);display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px">
        <div><div class="lbl" style="font-size:17px;color:rgba(18,16,14,.5)">K18 treatment</div><b class="fr" style="font-size:66px;display:block;margin-top:10px">${price(k18)}</b></div>
        <div><div class="lbl" style="font-size:17px;color:rgba(18,16,14,.5)">Blow wave</div><b class="fr" style="font-size:66px;display:block;margin-top:10px">${price(wave)}</b></div>
        <div><div class="lbl" style="font-size:17px;color:rgba(18,16,14,.5)">Gates open</div><b class="num" style="font-size:52px;display:block;margin-top:14px">11–4</b></div>
      </div>
      <div style="position:absolute;left:52px;right:52px;bottom:40px;padding-top:22px;border-top:3px solid rgba(18,16,14,.12);font-size:25px;font-weight:700;color:rgba(18,16,14,.72)">Both together: about an hour. Then a calm week ahead.</div>
    </div>
    <div class="cta" style="background:${GOLD};color:${INK}"><b>DM me for Sunday</b><span>Sun 11am–4pm</span></div>
    <div class="grain"></div>
  </body></html>`;
}

/* ===================================================== C1 which blonde */
const SHADES = [
  {
    n: '01', name: 'Honey', ramp: HAIR.honey, bg: '#3A2616', acc: GOLD,
    best: 'You want light that grows out softly, with no line at the root.',
    upkeep: 'Every 10–14 weeks', service: 'Balayage / Lived-in Blonde', inc: 'Toner and blow wave included',
  },
  {
    n: '02', name: 'Beige', ramp: HAIR.blonde, bg: FIG, acc: '#E2C088',
    best: 'You want brightness on top and around your face, not all over.',
    upkeep: 'Every 6–8 weeks', service: 'Partial Blonde (Foils)', inc: `Add K18 to protect it — $${BRAND.positioning.services.find((x) => x.name === 'K18 Treatment').price}`,
  },
  {
    n: '03', name: 'Pearl', ramp: HAIR.icy, bg: '#3A3056', acc: '#E4D9F2',
    best: 'You want the brightest, coolest blonde there is, and you will gloss between.',
    upkeep: 'Every 6–8 weeks + gloss', service: 'Full Blonde', inc: 'Toner and blow wave included',
  },
  {
    n: '04', name: 'Caramel', ramp: HAIR.caramel, bg: '#5A3A22', acc: '#E3B878',
    best: 'You want warmth and richness, and your greys covered properly.',
    upkeep: 'Every 4–6 weeks', service: 'Root Colour + Refresh', inc: 'Blow wave included',
  },
];
const OF = SHADES.length + 2;
const dots = (k, acc) =>
  `<div style="position:absolute;left:64px;top:1170px;z-index:6;display:flex;gap:10px">${Array.from({ length: OF }, (_, i) => `<i style="width:${i === k ? 44 : 14}px;height:14px;border-radius:14px;background:${acc};opacity:${i <= k ? 1 : 0.35}"></i>`).join('')}</div>`;

function blondeCover() {
  return `<html><head><meta charset="utf-8"><style>${base(INK)}</style></head><body>
    <div style="position:absolute;width:1300px;height:1300px;left:-110px;top:-640px;border-radius:50%;background:radial-gradient(circle,rgba(226,192,136,.4),rgba(226,192,136,0) 62%)"></div>
    ${art(1080, 1350, `${swatchFan({ items: [...SHADES].reverse().map((s) => ({ ramp: s.ramp, label: s.n, sub: s.name.toUpperCase() })), w: 196, h: 700, cx: 540, cy: 170, spread: 54, pivot: 640, clip: '#1E1A17' })}${glints({ w: 1080, h: 560, seed: 5, n: 9 })}`)}
    <div style="position:absolute;left:0;right:0;bottom:0;height:760px;background:linear-gradient(180deg,rgba(18,16,14,0),rgba(18,16,14,.9) 30%,${INK} 52%)"></div>
    <div style="position:absolute;left:64px;right:64px;bottom:170px;z-index:5">
      <div style="display:flex;gap:18px;align-items:center;margin-bottom:30px"><i style="width:90px;height:5px;background:${GOLD}"></i><span class="lbl" style="color:${GOLD}">A quiz · swipe</span></div>
      <h1 class="fr" style="font-size:150px">Which blonde<br>are <span style="color:${GOLD}">you?</span></h1>
      <p style="margin-top:26px;font-size:32px;font-weight:600;color:rgba(246,241,233,.86);max-width:28ch">Pick a number. Each one comes with its upkeep and its price.</p>
    </div>
    <div class="cta" style="background:${GOLD};color:${INK}"><b>Swipe →</b><span>1 / ${OF}</span></div>
    <div class="grain"></div>
  </body></html>`;
}

function blondeSlide(s, k) {
  const sv = svc(s.service);
  return `<html><head><meta charset="utf-8"><style>${base(s.bg)}
    .k{font-size:19px;letter-spacing:.26em;text-transform:uppercase;font-weight:800;color:${s.acc};opacity:.9}
    .v{font-size:31px;font-weight:600;line-height:1.36;margin-top:10px;color:rgba(246,241,233,.92)}
  </style></head><body>
    <div style="position:absolute;right:0;top:0;width:470px;height:1222px;overflow:hidden;background:#140d09">
      ${art(470, 1222, `<g transform="translate(-40 150)">${strands({ w: 560, h: 1110, seed: 200 + k * 17, n: 260, ramp: s.ramp, sway: 0.08, waves: 1.2, taper: 0.1, width: [1.4, 3.8], sheen: 0.8 })}</g>
        <rect x="-10" y="0" width="490" height="190" fill="#1E1A17"/><rect x="40" y="40" width="390" height="5" rx="2" fill="${CREAM}" opacity=".2"/>
        <text x="235" y="138" text-anchor="middle" font-family="Inter" font-weight="800" font-size="92" fill="${CREAM}" letter-spacing="-3">${s.n}</text>
        ${glints({ w: 440, h: 1000, seed: 300 + k, n: 7, size: [10, 28] })}`)}
    </div>
    ${dots(k + 1, s.acc)}
    <div style="position:absolute;left:64px;top:84px;width:470px">
      <div class="lbl" style="color:${s.acc}">Number ${s.n}</div>
      <h2 class="fr" style="font-size:${s.name.length > 5 ? 138 : 172}px;margin-top:30px;color:${CREAM}">${esc(s.name)}</h2>
      <div style="margin-top:80px"><div class="k">Best if</div><div class="v">${esc(s.best)}</div></div>
      <div style="margin-top:50px"><div class="k">Upkeep</div><div class="v">${esc(s.upkeep)}</div></div>
      <div style="margin-top:50px"><div class="k">Book</div><div class="v">${esc(s.service.replace(' / Lived-in Blonde', ' · lived-in'))} · ${hm(sv.minutes)}</div></div>
      <div class="fr" style="margin-top:44px;font-size:150px;color:${s.acc}">${sv.from ? '<span style="font-family:Inter;font-weight:800;font-size:26px;letter-spacing:.2em;display:block;margin-bottom:8px">FROM</span>' : ''}$${sv.price}</div>
      <div style="margin-top:40px;display:inline-block;padding:16px 26px;border-radius:999px;border:3px solid ${s.acc};font-size:26px;font-weight:800;color:${CREAM}">${esc(s.inc)}</div>
    </div>
    <div class="cta" style="background:${s.acc};color:${INK}"><b>Comment “${s.n}” if it’s you</b><span>${k + 2} / ${OF}</span></div>
    <div class="grain"></div>
  </body></html>`;
}

function blondeEnd() {
  return `<html><head><meta charset="utf-8"><style>${base(CREAM, INK)}</style></head><body>
    <div style="position:absolute;width:900px;height:900px;left:420px;top:-300px;border-radius:50%;background:${CLAY};opacity:.35"></div>
    ${dots(OF - 1, FIG)}
    ${art(1080, 1350, `<g transform="translate(640 130)">${swatchFan({ items: [...SHADES].reverse().map((s) => ({ ramp: s.ramp, label: s.n, sub: s.name.toUpperCase() })), w: 100, h: 500, cx: 220, cy: 60, spread: 40, pivot: 420, clip: FIG })}</g>`)}
    <div style="position:absolute;left:64px;top:84px;width:530px">
      <div class="lbl" style="color:${FIG}">Your answer</div>
      <h2 class="fr" style="font-size:118px;margin-top:28px">Not sure which one?</h2>
      <p style="font-size:33px;font-weight:600;line-height:1.42;margin-top:30px;color:rgba(18,16,14,.8)">That is what the consultation is for. I look at your hair, your skin and your diary, and tell you which number suits all three.</p>
    </div>
    <div style="position:absolute;left:64px;right:64px;top:820px;display:grid;grid-template-columns:1fr 1fr;gap:18px">
      <div style="background:${FIG};color:${CREAM};border-radius:22px;padding:34px 34px">
        <div class="lbl" style="color:${GOLD};font-size:18px">Saturday</div><div class="num" style="font-size:84px;margin-top:16px">9–5</div></div>
      <div style="background:${INK};color:${CREAM};border-radius:22px;padding:34px 34px">
        <div class="lbl" style="color:${GOLD};font-size:18px">Sunday</div><div class="num" style="font-size:84px;margin-top:16px">11–4</div></div>
    </div>
    <div class="cta" style="background:${FIG};color:${CREAM}"><b>Comment your number</b><span style="color:${GOLD}">DM to book</span></div>
    <div class="grain"></div>
  </body></html>`;
}

const CARDS = [
  { file: 'w9-p1-bingo.png', html: bingo },
  { file: 'w9-p2-form-guide.png', html: formGuide },
  { file: 'w9-p3-sunday.png', html: sunday },
  { file: 'w9-c1-1.png', html: blondeCover },
  ...SHADES.map((s, k) => ({ file: `w9-c1-${k + 2}.png`, html: () => blondeSlide(s, k) })),
  { file: `w9-c1-${OF}.png`, html: blondeEnd },
];

const ONLY = process.argv[2];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromiumPath() });
const scratch = join(PHOTOS, '.w9-card.html');
for (const c of CARDS.filter((c) => !ONLY || c.file.includes(ONLY))) {
  writeFileSync(scratch, c.html());
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await page.goto(`file://${scratch}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(join(OUT, c.file), await page.screenshot({ type: 'png' }));
  console.log('  ' + c.file);
  await page.close();
}
await browser.close();
rmSync(scratch, { force: true });
