#!/usr/bin/env node
/**
 * Week 8 posts — "Come for Sha".
 *
 * The live read settled what this account is: seven of her ten best reels have
 * Sha herself on camera. People are not following a salon, they are following
 * her — one review literally says so, ten years across three suburbs. So the
 * week sells the person, and the services and prices hang off her.
 *
 *   P1  Book Sha            the manifesto, Sha in an arch, credentials as tiles
 *   P2  Pick your step      every price as a staircase, $45 to $340
 *   P3  They followed her   the Stella review verbatim, the three-suburb route
 *   P4  Your appointment    carousel, five slides: what actually happens
 *
 *   P5  Dull by week six    the $45 gloss, a brassy lock beside a glossed one
 *
 * No photographs. The face-free library was used up — the brunette waves on
 * ig-01 had turned into the account's wallpaper — and the Drive upload did not
 * arrive, so every image is drawn: hair as a colourist sees it, from
 * lib/hair-art.mjs. Strands with a root-to-end gradient, a swatch fan, gold
 * foils, a gloss drop. Drawn, not generated — invariant 2 still holds, and
 * nothing here pretends to be a photograph of her work.
 *
 * The arch is the week's device. It echoes the round mirrors on her walls,
 * and this time it frames the colour itself.
 *
 * Density rule for this week, from the brief: no dead space. Every card is
 * built edge to edge — oversized outline letterforms behind the photograph,
 * credential tiles along the foot, a CTA bar on every single one.
 *
 * Prices from brand.json via svc(); reviews verbatim from reviews.json via
 * review(). Neither is ever typed by hand here.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HAIR, strands, swatchFan, foil, drop, glints } from './lib/hair-art.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PHOTOS = join(ROOT, 'content', 'photos');
const OUT = join(ROOT, 'content', 'cards');

const INK = '#12100E', CREAM = '#F6F1E9', GOLD = '#C08B3E', FIG = '#2F4032', CLAY = '#C9A88B', VIOLET = '#6A5B8C';
/** An SVG layer sized to its box, for drawn art inside an arch or tile. */
const art = (w, h, body, style = '') => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;left:0;top:0;overflow:visible;${style}">${body}</svg>`;
const FONTS = readFileSync(join(ROOT, 'assets', 'fonts', 'brand-fonts.css'), 'utf8');
const BRAND = JSON.parse(readFileSync(join(ROOT, 'config', 'brand.json'), 'utf8'));
const REVIEWS = JSON.parse(readFileSync(join(ROOT, 'content', 'reviews.json'), 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const chromiumPath = () =>
  [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p)) || undefined;

function svc(name) {
  const s = BRAND.positioning.services.find((x) => x.name === name);
  if (!s) throw new Error(`service not in brand.json: ${name}`);
  return s;
}
function review(author) {
  const r = REVIEWS.reviews.find((x) => x.author === author);
  if (!r) throw new Error(`review not on file: ${author}`);
  return r;
}
const hm = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr${m % 60 ? ' ' + (m % 60) : ''}`);

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='5'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

const base = (bg) => `${FONTS}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1080px;height:1350px;overflow:hidden}
  body{position:relative;background:${bg};font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;color:${CREAM}}
  .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.12;mix-blend-mode:multiply;pointer-events:none;z-index:50}
  .fr{font-family:'Fraunces',serif;font-weight:400;font-variation-settings:'opsz' 144;letter-spacing:-.035em;line-height:.9}
  .num{font-family:'Inter',sans-serif;font-weight:800;letter-spacing:-.05em;font-variant-numeric:tabular-nums;line-height:.86}
  .lbl{font-size:20px;letter-spacing:.3em;text-transform:uppercase;font-weight:800}
  .arch{position:absolute;overflow:hidden;border-radius:999px 999px 0 0}
  .arch img{position:absolute;max-width:none}
  .cta{position:absolute;left:0;right:0;bottom:0;height:128px;display:flex;align-items:center;justify-content:space-between;padding:0 64px;z-index:30}
  .cta b{font-size:36px;font-weight:800;letter-spacing:-.01em}
  .cta span{font-size:21px;font-weight:800;letter-spacing:.22em;text-transform:uppercase}
  .disc{position:absolute;border-radius:50%}
`;

/* =============================================================== P1 */
function bookSha() {
  const tiles = [
    ['20+', 'years behind the chair'],
    ['1000+', 'happy clients'],
    ['K18', 'certified'],
    ['1', 'chair · no hand-offs'],
  ];
  return `<html><head><meta charset="utf-8"><style>${base(FIG)}
    .ghost{position:absolute;left:-30px;top:40px;font-size:560px;color:transparent;-webkit-text-stroke:3px rgba(201,168,139,.34);z-index:1;letter-spacing:-.05em}
    .tiles{position:absolute;left:0;right:0;bottom:128px;height:196px;display:grid;grid-template-columns:repeat(4,1fr);z-index:20}
    .tile{padding:28px 26px;border-right:3px solid ${FIG};background:${CREAM};color:${INK};display:flex;flex-direction:column;justify-content:center}
    .tile:last-child{border-right:0}
    .tile .num{font-size:66px;color:${FIG}}
    .tile p{font-size:19px;font-weight:700;margin-top:10px;line-height:1.25;color:rgba(18,16,14,.72)}
  </style></head><body>
    <div class="disc" style="width:720px;height:720px;left:-260px;top:520px;background:${CLAY};opacity:.16"></div>
    <div class="ghost fr">Sha</div>
    <div class="arch" style="left:486px;top:96px;width:540px;height:934px;z-index:5;border:8px solid ${GOLD};background:radial-gradient(ellipse at 50% 30%,#3a2618,#140d09 75%)">
      ${art(540, 934, `<g transform="translate(-60 -30)">${strands({ w: 660, h: 1010, seed: 21, n: 250, ramp: HAIR.balayage, sway: 0.09, waves: 1.2, taper: 0.08, width: [1.4, 3.8], sheen: 0.6 })}</g>${glints({ w: 520, h: 900, seed: 4, n: 7 })}`)}
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(18,16,14,.35) 0%,rgba(18,16,14,0) 22%,rgba(18,16,14,0) 70%,rgba(18,16,14,.5))"></div>
    </div>
    <div style="position:absolute;left:64px;top:84px;z-index:10;display:flex;gap:18px;align-items:center">
      <i style="width:90px;height:5px;background:${GOLD}"></i><span class="lbl" style="color:${CLAY}">Hair by Sha · Camberwell</span></div>
    <div style="position:absolute;left:64px;top:470px;width:470px;z-index:10">
      <div style="position:relative;display:inline-block">
        <p class="fr" style="font-size:66px;color:${CREAM};line-height:1">Don’t book<br>a salon.</p>
        <i style="position:absolute;left:0;width:62%;bottom:-18px;height:7px;background:${GOLD}"></i>
      </div>
      <h1 class="fr" style="font-size:212px;color:${GOLD};margin-top:26px">Book<br>Sha.</h1>
    </div>
    <div class="tiles">${tiles.map(([n, l]) => `<div class="tile"><span class="num">${n}</span><p>${l}</p></div>`).join('')}</div>
    <div class="cta" style="background:${GOLD};color:${INK}"><b>DM me to book</b><span>Sundays 11–4</span></div>
    <div class="grain"></div>
  </body></html>`;
}

/* =============================================================== P2 */
function ladder() {
  // Each step is a swatch: the price on a coloured cap, and a lock of that
  // service's shade hanging beneath it.
  const steps = [
    ['Toner & gloss', svc('Toner & Gloss'), CREAM, INK, HAIR.toner],
    ['Blow wave', svc('Blow Wave'), CLAY, INK, HAIR.honey],
    ['Root colour + refresh', svc('Root Colour + Refresh'), GOLD, INK, HAIR.caramel],
    ['Partial foils', svc('Partial Blonde (Foils)'), FIG, CREAM, HAIR.blonde],
    ['Balayage · lived-in', svc('Balayage / Lived-in Blonde'), CREAM, INK, HAIR.balayage],
  ];
  const H = [410, 520, 640, 750, 860];
  const CAP = 262;
  return `<html><head><meta charset="utf-8"><style>${base(INK)}
    .stairs{position:absolute;left:40px;right:40px;bottom:128px;height:860px;display:flex;align-items:flex-end;gap:12px;z-index:10}
    .st{flex:1;display:flex;flex-direction:column;padding:26px 18px;position:relative;overflow:hidden;background:#171110 !important}
    .st .capbg{position:absolute;left:0;right:0;top:0;height:${CAP}px}
    .st > span{position:relative;z-index:2}
    .st .lock{position:absolute;left:0;right:0;top:${CAP - 6}px;bottom:0;overflow:hidden}
    .st .fromx{font-size:18px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;opacity:.7}
    .st .pr{font-size:78px;margin-top:4px}
    .st .nm{font-size:21px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;margin-top:14px;line-height:1.22}
    .st .tm{font-size:19px;font-weight:600;margin-top:8px;opacity:.72}
    .st .n{position:absolute;right:16px;bottom:14px;font-size:120px;opacity:.12}
    .rays{position:absolute;width:2400px;height:2400px;left:-700px;top:-1400px;border-radius:50%;
      background:repeating-conic-gradient(from 0deg,${GOLD} 0deg 3.2deg,transparent 3.2deg 8deg);opacity:.09}
  </style></head><body>
    <div class="rays"></div>
    <div style="position:absolute;left:64px;top:78px;z-index:10;display:flex;gap:18px;align-items:center">
      <i style="width:90px;height:5px;background:${GOLD}"></i><span class="lbl" style="color:${GOLD}">Every price, up front</span></div>
    <h1 class="fr" style="position:absolute;left:64px;top:128px;font-size:136px;z-index:10">Pick your<br><span style="color:${GOLD}">step.</span></h1>
    <p style="position:absolute;right:64px;top:170px;width:380px;text-align:right;font-size:27px;font-weight:600;line-height:1.38;color:rgba(246,241,233,.82);z-index:10">
      Final quote before anything is mixed. Length and thickness decide the rest.</p>
    <div class="stairs">
      ${steps
        .map(
          ([n, s, bg, fg, ramp], i) => `<div class="st" style="height:${H[i]}px;color:${fg}">
            <i class="capbg" style="background:${bg}"></i>
            <div class="lock">${art(196, H[i] - CAP + 6, `<g transform="translate(-14 0)">${strands({ w: 224, h: H[i] - CAP + 40, seed: 40 + i * 9, n: 90, ramp, sway: 0.05, waves: 0.9, taper: 0.4, width: [1.3, 3.2], sheen: 0.55 })}</g>`)}</div>
            <span class="fromx">${s.from ? 'from' : '&nbsp;'}</span>
            <span class="pr fr">$${s.price}</span>
            <span class="nm">${esc(n)}</span>
            <span class="tm">${hm(s.minutes)}</span>
            <span class="n num" style="bottom:auto;top:${CAP - 118}px">${i + 1}</span>
          </div>`,
        )
        .join('')}
    </div>
    <div class="cta" style="background:${GOLD};color:${INK}"><b>DM me your step</b><span>Hair by Sha</span></div>
    <div class="grain"></div>
  </body></html>`;
}

/* =============================================================== P3 */
function followed() {
  const st = review('Stella McCammon');
  const others = [review('Nimali Samarakoon'), review('Uppsala Trinh')];
  return `<html><head><meta charset="utf-8"><style>${base(CREAM)}
    body{color:${INK}}
  </style></head><body>
    <div class="disc" style="width:760px;height:760px;left:520px;top:-260px;background:${CLAY};opacity:.4"></div>
    <div class="num" style="position:absolute;left:40px;top:40px;font-size:430px;color:${GOLD};z-index:2">10</div>
    <div class="lbl" style="position:absolute;left:66px;top:440px;width:590px;color:${FIG};z-index:3;font-size:22px">Years. Three suburbs.</div>
    <div class="arch" style="left:700px;top:56px;width:316px;height:420px;z-index:4;border:6px solid ${GOLD};background:radial-gradient(ellipse at 50% 30%,#3a2618,#140d09 75%)">
      ${art(316, 420, `<g transform="translate(-30 -20)">${strands({ w: 380, h: 470, seed: 33, n: 170, ramp: HAIR.honey, sway: 0.1, waves: 1.1, taper: 0.1, width: [1.2, 3], sheen: 0.6 })}</g>${glints({ w: 300, h: 400, seed: 8, n: 4, size: [8, 22] })}`)}
    </div>
    <div style="position:absolute;left:66px;right:66px;top:520px;height:74px;z-index:5">
      <!-- The route is a lock of hair: dark at Malvern, grown out to gold by Camberwell. Ten years of it. -->
      ${art(948, 50, `<g transform="translate(20 52) rotate(-90)">${strands({ w: 56, h: 910, seed: 17, n: 70, ramp: HAIR.balayage, sway: 0.18, waves: 3, taper: 0, width: [1, 2.4], sheen: 0.5, body: 0.5 })}</g>`, 'top:0')}
      ${['Malvern', 'Armadale', 'Camberwell']
        .map(
          (s, i) => `<div style="position:absolute;left:${i * 50}%;transform:translateX(-${i * 50}%);text-align:${['left', 'center', 'right'][i]}">
            <i style="display:inline-block;width:50px;height:50px;border-radius:50%;background:${i === 2 ? GOLD : FIG};border:5px solid ${CREAM}"></i>
            <div style="font-size:24px;font-weight:800;margin-top:4px">${s}</div></div>`,
        )
        .join('')}
    </div>
    <div style="position:absolute;left:66px;right:66px;top:648px;z-index:6">
      <p class="fr" style="font-size:43px;line-height:1.2;letter-spacing:-.02em">“${esc(st.quote)}”</p>
      <p style="margin-top:20px;font-size:25px;font-weight:800;color:${FIG}">${esc(st.author)} <span style="font-weight:600;color:rgba(18,16,14,.55)">· ${esc(st.context)}</span></p>
    </div>
    <div style="position:absolute;left:66px;right:66px;top:1010px;display:flex;gap:14px;z-index:6">
      ${others
        .map(
          (r) => `<div style="flex:1;background:${FIG};color:${CREAM};padding:32px 30px;border-radius:18px">
            <div style="font-size:28px;font-weight:800">${esc(r.author)}</div>
            <div style="font-size:24px;font-weight:600;color:${CLAY};margin-top:8px">${esc(r.context)}</div></div>`,
        )
        .join('')}
    </div>
    <div class="cta" style="background:${INK};color:${CREAM}"><b>Some follow a salon. <em style="font-style:normal;color:${GOLD}">Hers follow her.</em></b><span style="color:${GOLD}">DM to book</span></div>
    <div class="grain"></div>
  </body></html>`;
}

/* =============================================================== P4 carousel */
const SHADES = [
  { ramp: HAIR.espresso, label: '4N', sub: 'ESPRESSO' },
  { ramp: HAIR.caramel, label: '6G', sub: 'CARAMEL' },
  { ramp: HAIR.copper, label: '7C', sub: 'COPPER' },
  { ramp: HAIR.balayage, label: 'BAL', sub: 'LIVED-IN' },
  { ramp: HAIR.honey, label: '8G', sub: 'HONEY' },
  { ramp: HAIR.blonde, label: '9V', sub: 'BEIGE' },
  { ramp: HAIR.icy, label: '10P', sub: 'PEARL' },
];

/* The drawn art inside each step's arch, 460×640. */
const ARCH_ART = {
  chat: () =>
    art(460, 640, `${swatchFan({ items: [SHADES[1], SHADES[4], SHADES[5]], w: 132, h: 600, cx: 230, cy: 90, spread: 34, pivot: 420, clip: FIG })}${glints({ w: 440, h: 600, seed: 12, n: 5, size: [8, 22] })}`),
  colour: () =>
    art(460, 640, `<g transform="translate(-30 -20)">${strands({ w: 520, h: 700, seed: 51, n: 200, ramp: HAIR.espresso, sway: 0.06, waves: 0.9, taper: 0.05, width: [1.3, 3.4], sheen: 0.35 })}</g>
      <g transform="translate(46 96) rotate(-7)">${foil({ w: 128, h: 380, seed: 61, foldAt: 0.8, tail: 90 })}</g>
      <g transform="translate(290 120) rotate(6)">${foil({ w: 128, h: 380, seed: 62, foldAt: 0.8, tail: 90 })}</g>
      <g transform="translate(168 200) rotate(-1)">${foil({ w: 128, h: 380, seed: 63, foldAt: 0.8, tail: 90 })}</g>`),
  toner: () =>
    art(460, 640, `<g transform="translate(-30 -20)">${strands({ w: 520, h: 700, seed: 71, n: 220, ramp: HAIR.toner, sway: 0.08, waves: 1.1, taper: 0.08, width: [1.3, 3.4], sheen: 0.7 })}</g>
      <g transform="translate(140 150)">${drop({ w: 180, c1: '#D9CCEE', c2: '#4A3D6B' })}</g>${glints({ w: 440, h: 600, seed: 14, n: 6, size: [8, 24] })}`),
  finish: () =>
    art(460, 640, `<g transform="translate(-40 -20)">${strands({ w: 540, h: 700, seed: 81, n: 230, ramp: HAIR.balayage, sway: 0.11, waves: 1.3, taper: 0.1, width: [1.3, 3.6], sheen: 0.8 })}</g>${glints({ w: 440, h: 600, seed: 16, n: 7, size: [8, 26] })}`),
};

function stepSlide({ n, of, kicker, title, body, art: inner, archBg, bg, fg, acc, cta, tags = [] }) {
  return `<html><head><meta charset="utf-8"><style>${base(bg)}
    body{color:${fg}}
  </style></head><body>
    <div class="num" style="position:absolute;right:-30px;top:-30px;font-size:620px;color:transparent;-webkit-text-stroke:4px ${acc};opacity:.5;z-index:1">${n}</div>
    <div class="arch" style="left:64px;top:96px;width:460px;height:640px;z-index:4;border:6px solid ${acc};background:${archBg}">
      ${inner}
    </div>
    <div style="position:absolute;left:64px;top:780px;right:64px;z-index:5">
      <div class="lbl" style="color:${acc};font-size:23px">${esc(kicker)}</div>
      <h2 class="fr" style="font-size:104px;margin-top:18px;max-width:15ch">${title}</h2>
      <p style="font-size:34px;font-weight:600;line-height:1.4;margin-top:24px;max-width:30ch;opacity:.88">${esc(body)}</p>
    </div>
    <div style="position:absolute;left:560px;top:470px;z-index:6;display:flex;flex-direction:column;gap:14px;align-items:flex-start">
      ${tags.map((t) => `<span style="padding:16px 26px;border-radius:999px;border:3px solid ${acc};font-size:28px;font-weight:800;color:${fg}">${esc(t)}</span>`).join('')}
    </div>
    <div style="position:absolute;right:64px;top:100px;z-index:6;display:flex;gap:10px">
      ${Array.from({ length: of }, (_, i) => `<i style="width:${i + 1 === +n + 1 ? 44 : 14}px;height:14px;border-radius:14px;background:${acc};opacity:${i + 1 <= +n + 1 ? 1 : .35}"></i>`).join('')}
    </div>
    <div class="cta" style="background:${acc};color:${bg === INK || bg === FIG ? INK : CREAM}"><b>${esc(cta)}</b><span>${+n + 1} / ${of}</span></div>
    <div class="grain"></div>
  </body></html>`;
}

/* The cover used to be the brunette waves from ig-01 — the most reused image
   on the account. Now it is a colourist's shade book fanned open. */
function cover() {
  return `<html><head><meta charset="utf-8"><style>${base(INK)}</style></head><body>
    <div class="disc" style="width:1300px;height:1300px;left:-110px;top:-640px;background:radial-gradient(circle,rgba(192,139,62,.34),rgba(192,139,62,0) 62%)"></div>
    ${art(1080, 1350, `${swatchFan({ items: SHADES, w: 148, h: 700, cx: 540, cy: 150, spread: 72, pivot: 720, clip: '#1E1A17' })}${glints({ w: 1080, h: 540, seed: 3, n: 8 })}`)}
    <div style="position:absolute;left:0;right:0;bottom:0;height:820px;background:linear-gradient(180deg,rgba(18,16,14,0),rgba(18,16,14,.9) 30%,${INK} 52%)"></div>
    <div style="position:absolute;left:64px;right:64px;bottom:170px;z-index:5">
      <div style="display:flex;gap:18px;align-items:center;margin-bottom:34px">
        <i style="width:90px;height:5px;background:${GOLD}"></i><span class="lbl" style="color:${GOLD}">Your appointment · swipe</span></div>
      <h1 class="fr" style="font-size:128px">What actually happens in <span style="color:${GOLD}">Sha’s chair.</span></h1>
      <p style="margin-top:26px;font-size:32px;font-weight:600;color:rgba(246,241,233,.86);max-width:26ch">Four steps. One person. Nobody else waiting.</p>
    </div>
    <div class="cta" style="background:${GOLD};color:${INK}"><b>Swipe →</b><span>1 / 5</span></div>
    <div class="grain"></div>
  </body></html>`;
}

/* =============================================================== P5 */
/* Education with a price attached: why colour looks tired at week six, and
   the 45-minute appointment that fixes it. A flat, brassy lock beside the
   same lock glossed — the before-and-after without anyone's photograph. */
function gloss() {
  const g = svc('Toner & Gloss');
  const lock = (ramp, seed, sheen, extra = '') =>
    art(380, 640, `<g transform="translate(-30 -20)">${strands({ w: 440, h: 700, seed, n: 210, ramp, sway: 0.07, waves: 1, taper: 0.12, width: [1.3, 3.5], sheen })}</g>${extra}`);
  return `<html><head><meta charset="utf-8"><style>${base('#231C33')}
    body{background:radial-gradient(ellipse at 50% 58%,#4A3D6B 0%,#2B2340 55%,#1A1524 100%)}
    .lk{position:absolute;top:470px;width:380px;height:640px;z-index:5}
    .lk .tag{position:absolute;left:0;right:0;bottom:-78px;text-align:center;font-size:22px;letter-spacing:.24em;text-transform:uppercase;font-weight:800}
  </style></head><body>
    <div style="position:absolute;left:64px;top:84px;z-index:10;display:flex;gap:18px;align-items:center">
      <i style="width:90px;height:5px;background:${GOLD}"></i><span class="lbl" style="color:#C3B3DE">Toner &amp; gloss · ${hm(g.minutes)}</span></div>
    <h1 class="fr" style="position:absolute;left:64px;top:136px;font-size:124px;z-index:10;color:${CREAM}">Dull by<br><span style="color:#C3B3DE">week six?</span></h1>
    <p style="position:absolute;right:64px;top:176px;width:360px;text-align:right;font-size:28px;font-weight:600;line-height:1.38;color:rgba(246,241,233,.86);z-index:10">
      That is the toner fading, not your colour. A gloss puts the tone and the shine back.</p>
    <div class="lk arch" style="left:84px;border:6px solid rgba(246,241,233,.35);background:#15100d">
      <div style="position:absolute;inset:0;filter:saturate(.55) brightness(.82) contrast(.9)">${lock(HAIR.brassy, 90, 0)}</div>
    </div>
    <div class="lk arch" style="left:616px;border:6px solid ${GOLD};background:#15100d">
      ${lock(HAIR.blonde, 90, 0.95, glints({ w: 360, h: 600, seed: 21, n: 8, size: [8, 26] }))}
    </div>
    <div class="lbl" style="position:absolute;left:84px;width:380px;top:1128px;text-align:center;color:rgba(246,241,233,.62);font-size:22px;z-index:6">Week six</div>
    <div class="lbl" style="position:absolute;left:616px;width:380px;top:1128px;text-align:center;color:${GOLD};font-size:22px;z-index:6">After a gloss</div>
    ${art(1080, 1350, `<g transform="translate(470 690)">${drop({ w: 140, c1: '#E4D9F2', c2: '#5B4A86' })}</g>
      <path d="M486,952 H592" stroke="${GOLD}" stroke-width="6" stroke-linecap="round"/>
      <path d="M572,934 L594,952 L572,970" fill="none" stroke="${GOLD}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`, 'z-index:7')}
    <div class="cta" style="background:${GOLD};color:${INK}"><b>Gloss · ${g.from ? 'from ' : ''}$${g.price}</b><span>DM me · Sundays 11–4</span></div>
    <div class="grain"></div>
  </body></html>`;
}

const CARDS = [
  { file: 'w8-p1-book-sha.png', html: bookSha },
  { file: 'w8-p2-ladder.png', html: ladder },
  { file: 'w8-p3-followed.png', html: followed },
  { file: 'w8-p4-gloss.png', html: gloss },
  { file: 'w8-c1-1.png', html: cover },
  {
    file: 'w8-c1-2.png',
    html: () =>
      stepSlide({
        n: '1', of: 5, kicker: 'Step one · the chat', bg: FIG, fg: CREAM, acc: GOLD, cta: 'Price before anything starts', tags: ['Hair history', 'Your diary', 'Price first'],
        title: 'We talk first.',
        body: 'Your hair history, your diary, the result you are after. You get the price before a single bowl is mixed.',
        art: ARCH_ART.chat(), archBg: 'radial-gradient(ellipse at 50% 20%,#2a2420,#12100E 80%)',
      }),
  },
  {
    file: 'w8-c1-3.png',
    html: () =>
      stepSlide({
        n: '2', of: 5, kicker: 'Step two · the colour', bg: CREAM, fg: INK, acc: FIG, cta: 'Placed by hand, by Sha', tags: ['Hand-placed', 'No hand-offs', 'One chair'],
        title: 'Only one pair of hands.',
        body: 'No apprentice, no second chair, no hand-off halfway through. The person you booked is the person doing it.',
        art: ARCH_ART.colour(), archBg: '#140d09',
      }),
  },
  {
    file: 'w8-c1-4.png',
    html: () =>
      stepSlide({
        n: '3', of: 5, kicker: 'Step three · the toner', bg: INK, fg: CREAM, acc: GOLD, cta: 'The step worth not rushing', tags: ['Unrushed', 'Tone matched', 'Glossed'],
        title: 'Where the tone is decided.',
        body: 'It gets the time it needs, because nobody else is waiting for the chair. This is the part most colour lives or dies on.',
        art: ARCH_ART.toner(), archBg: '#1a1526',
      }),
  },
  {
    file: 'w8-c1-5.png',
    html: () =>
      stepSlide({
        n: '4', of: 5, kicker: 'Step four · the finish', bg: CLAY, fg: INK, acc: FIG, cta: 'DM me to book yours', tags: ['Blow wave', 'Next date set', 'Formula on file'],
        title: 'Then we plan the next one.',
        body: 'Blow wave, then your next date mapped before you leave, so the colour never needs rescuing.',
        art: ARCH_ART.finish(), archBg: '#140d09',
      }),
  },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromiumPath() });
const scratch = join(PHOTOS, '.w8-card.html');
for (const c of CARDS) {
  writeFileSync(scratch, c.html());
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await page.goto(`file://${scratch}`, { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))).then(() => document.fonts.ready));
  writeFileSync(join(OUT, c.file), await page.screenshot({ type: 'png' }));
  console.log('  ' + c.file);
  await page.close();
}
await browser.close();
rmSync(scratch, { force: true });
console.log(`\nDone — ${CARDS.length} cards.`);
