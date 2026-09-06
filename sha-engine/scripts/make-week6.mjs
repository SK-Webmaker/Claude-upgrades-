#!/usr/bin/env node
/**
 * Week 6 — the studio palette, no photographs.
 *
 * The operator asked for aesthetic, colour-designed posts in the language of
 * the Sunday campaign rather than another set of cards carrying a picture of
 * finished hair — posts that show what is *wanted* rather than what was *done*.
 *
 * The palette is taken from her own room. Every photograph on her site has the
 * same four things in it: a fiddle-leaf fig, warm timber, cream walls, window
 * light. FIG and CLAY come from that. It is the first palette in this system
 * that belongs to the business rather than to a campaign — the marigold was
 * borrowed from the idea of Sunday, the rust from the idea of a ticket.
 *
 *   FIG   #2F4032  deep muted green, the plants
 *   CLAY  #C9A88B  the floor
 *   GOLD  #C08B3E  brand gold, lifted to survive a full field
 *   CREAM #F6F1E9  brand
 *   INK   #12100E  brand
 *
 * Shape language: arcs and discs. They echo the round mirrors on her walls and
 * the leaves without ever drawing a literal leaf, and they carry over from the
 * Sunday campaign so the feed still reads as one account.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'content', 'cards');

const INK = '#12100E';
const CREAM = '#F6F1E9';
const GOLD = '#C08B3E';
const FIG = '#2F4032';
const CLAY = '#C9A88B';

const FONTS = readFileSync(join(ROOT, 'assets', 'fonts', 'brand-fonts.css'), 'utf8');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const chromiumPath = () =>
  [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p)) || undefined;

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='5'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const disc = (c, size, x, y, op = 1) =>
  `<div style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:${c};
     left:${x}px;top:${y}px;opacity:${op}"></div>`;

/** A half-arc — the shape that carries the system. */
const halfArc = (c, size, x, y, op = 1) =>
  `<div style="position:absolute;width:${size}px;height:${size / 2}px;background:${c};
     border-radius:${size}px ${size}px 0 0;left:${x}px;top:${y}px;opacity:${op}"></div>`;

function base(W, H, bg) {
  return `${FONTS}
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${W}px;height:${H}px;overflow:hidden}
    body{position:relative;background:${bg};font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}
    .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.11;
           mix-blend-mode:multiply;pointer-events:none;z-index:9}
    .fr{font-family:'Fraunces',serif;font-weight:400;font-variation-settings:'opsz' 144;
        letter-spacing:-.034em;line-height:.92}
    .wrap{position:absolute;inset:0;padding:76px 70px 68px;display:flex;flex-direction:column;z-index:5}
    .grow{flex:1}
    .eyebrow{font-size:21px;letter-spacing:.3em;text-transform:uppercase;font-weight:700}
    .rule{height:5px;width:110px}
    .top{display:flex;gap:20px;align-items:center}
    .foot{display:flex;justify-content:space-between;font-size:21px;font-weight:700;
          padding-top:24px;margin-top:30px}
    .num{font-family:'Inter',sans-serif;font-variation-settings:normal;font-weight:700;
         font-variant-numeric:tabular-nums;letter-spacing:-.04em}`;
}

/* ---------- 1 · the aspiration ---------- */
function heroHtml(c) {
  const W = 1080, H = 1350;
  return `<html><head><meta charset="utf-8"><style>${base(W, H, c.bg)}
    h1{font-size:${c.size || 118}px;color:${c.fg};max-width:13ch}
    .sup{font-size:33px;line-height:1.42;color:${c.supColor};margin-top:34px;max-width:24ch;font-weight:500}
    .foot{border-top:4px solid ${c.fg};color:${c.fg};opacity:.85}
  </style></head><body>
    ${c.shapes || ''}
    <div class="wrap">
      <div class="top"><span class="rule" style="background:${c.accent}"></span>
        <span class="eyebrow" style="color:${c.accent}">${esc(c.eyebrow)}</span></div>
      <div class="grow"></div>
      <h1 class="fr">${c.title}</h1>
      ${c.support ? `<p class="sup">${esc(c.support)}</p>` : ''}
      <div class="grow"></div>
      <div class="foot"><span>Hair by Sha</span><span>Camberwell</span></div>
    </div>
    <div class="grain"></div>
  </body></html>`;
}

/* ---------- 2 · the menu ---------- */
function menuHtml(c) {
  const W = 1080, H = 1350;
  const rows = c.rows
    .map(
      (r) => `<div class="row">
        <span class="nm fr">${esc(r.name)}</span>
        <span class="ds">${esc(r.desc)}</span>
      </div>`,
    )
    .join('');
  return `<html><head><meta charset="utf-8"><style>${base(W, H, c.bg)}
    h1{font-size:88px;color:${c.fg};max-width:14ch}
    .rows{margin-top:40px;display:flex;flex-direction:column;flex:1;justify-content:center}
    .row{padding:26px 0;border-bottom:2px solid ${c.line}}
    .row:last-child{border-bottom:0}
    .nm{font-size:52px;color:${c.fg};display:block}
    .ds{font-size:26px;line-height:1.38;color:${c.supColor};display:block;margin-top:10px;max-width:30ch;font-weight:500}
    .foot{border-top:4px solid ${c.fg};color:${c.fg};opacity:.85}
  </style></head><body>
    ${c.shapes || ''}
    <div class="wrap">
      <div class="top"><span class="rule" style="background:${c.accent}"></span>
        <span class="eyebrow" style="color:${c.accent}">${esc(c.eyebrow)}</span></div>
      <h1 class="fr" style="margin-top:26px">${c.title}</h1>
      <div class="rows">${rows}</div>
      <div class="foot"><span>${esc(c.footL)}</span><span>${esc(c.footR)}</span></div>
    </div>
    <div class="grain"></div>
  </body></html>`;
}

/* ---------- 3 · the Sunday field ---------- */
function sundayHtml(c) {
  const W = 1080, H = 1350;
  return `<html><head><meta charset="utf-8"><style>${base(W, H, FIG)}
    h1{font-size:230px;color:${CREAM};line-height:.82}
    h1 .out{-webkit-text-stroke:5px ${CLAY};color:transparent}
    .when{font-size:74px;color:${CLAY};margin-top:34px}
    .sup{font-size:33px;line-height:1.42;color:rgba(246,241,233,.82);margin-top:30px;max-width:24ch;font-weight:500}
    .cta{align-self:flex-start;background:${CLAY};color:${INK};font-size:25px;font-weight:800;
         letter-spacing:.14em;text-transform:uppercase;padding:24px 32px;margin-top:34px}
    .foot{border-top:4px solid rgba(246,241,233,.5);color:${CREAM};opacity:.8}
  </style></head><body>
    ${disc(CLAY, 620, 640, -180, 0.9)}
    ${halfArc(GOLD, 900, -260, 980, 0.18)}
    <div class="wrap">
      <div class="top"><span class="rule" style="background:${CLAY}"></span>
        <span class="eyebrow" style="color:${CLAY}">${esc(c.eyebrow)}</span></div>
      <div class="grow"></div>
      <h1 class="fr"><span class="out">SUN</span><br>DAYS</h1>
      <p class="when num">${esc(c.when)}</p>
      <p class="sup">${esc(c.support)}</p>
      <span class="cta">${esc(c.cta)}</span>
      <div class="grow"></div>
      <div class="foot"><span>Hair by Sha</span><span>Camberwell</span></div>
    </div>
    <div class="grain"></div>
  </body></html>`;
}

/* ---------- 4 · carousel slides for the dos and don'ts ---------- */
function pairHtml(s) {
  const W = 1080, H = 1350;
  const isDont = s.kind === 'dont';
  const bg = isDont ? INK : s.bg || CLAY;
  const fg = isDont ? CREAM : INK;
  const accent = isDont ? '#B4593B' : FIG;
  return `<html><head><meta charset="utf-8"><style>${base(W, H, bg)}
    .kick{font-size:24px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:${accent}}
    h1{font-size:${s.size || 96}px;color:${fg};margin-top:22px;max-width:13ch;
       ${isDont ? `text-decoration:line-through;text-decoration-color:${accent};text-decoration-thickness:7px;` : ''}}
    .sup{font-size:32px;line-height:1.44;color:${isDont ? 'rgba(246,241,233,.74)' : 'rgba(18,16,14,.74)'};
         margin-top:32px;max-width:25ch;font-weight:500}
    .foot{border-top:3px solid ${isDont ? 'rgba(246,241,233,.28)' : 'rgba(18,16,14,.3)'};color:${fg};opacity:.6;font-size:19px}
  </style></head><body>
    ${isDont ? disc(accent, 760, -280, 1000, 0.13) : disc(FIG, 700, 700, 940, 0.16)}
    <div class="wrap">
      <div class="grow"></div>
      <p class="kick">${esc(s.kick)}</p>
      <h1 class="fr">${s.title}</h1>
      <p class="sup">${esc(s.support)}</p>
      <div class="grow"></div>
      <div class="foot"><span>Hair by Sha · Camberwell</span><span>${esc(s.pos)}</span></div>
    </div>
    <div class="grain"></div>
  </body></html>`;
}

/* ======================= the week ======================= */

const SINGLES = [
  {
    file: 'w6-p1-aspiration.png', layout: 'hero', bg: FIG, fg: CREAM, accent: CLAY,
    supColor: 'rgba(246,241,233,.8)', eyebrow: 'Lived-in colour', size: 122,
    title: 'Hair you stop thinking about.',
    support: 'That is the whole brief. Colour that looks deliberate on week one and still looks deliberate on week ten, because it was built to grow out rather than to photograph well once.',
    shapes: disc(CLAY, 560, 700, -140, 0.92) + halfArc(GOLD, 820, -240, 1010, 0.16),
  },
  {
    file: 'w6-p2-menu.png', layout: 'menu', bg: CREAM, fg: INK, accent: FIG,
    supColor: 'rgba(18,16,14,.68)', line: 'rgba(18,16,14,.16)',
    eyebrow: 'The blondes', title: 'Five ways to be blonde.',
    footL: 'From $240', footR: 'DM for yours',
    rows: [
      { name: 'Lived-in', desc: 'Soft, hand-painted, no regrowth line. The one you book if you cannot get back often.' },
      { name: 'Buttery', desc: 'Warm and creamy rather than icy. The kindest on darker natural hair.' },
      { name: 'Icy', desc: 'Cool and bright. The most maintenance of the five, and worth knowing that up front.' },
      { name: 'Babylit', desc: 'Very fine foils close to the root. The most natural, and the slowest to do.' },
      { name: 'Grown-out', desc: 'Deliberately shadowed at the root so it is still beautiful at week twelve.' },
    ],
    // No top-left shape here: a half-arc clipped by the top edge reads as a
    // grey rectangle behind the headline rather than as an arc.
    shapes: disc(CLAY, 480, 760, 980, 0.5),
  },
  {
    file: 'w6-p3-sundays.png', layout: 'sunday',
    eyebrow: 'Now open', when: '10 — 2, every Sunday',
    support: 'Four hours, one chair, nobody else in the room. It holds one big colour and nothing else.',
    cta: 'DM me the word Sunday',
  },
  {
    file: 'w6-p4-value.png', layout: 'hero', bg: CLAY, fg: INK, accent: FIG,
    supColor: 'rgba(18,16,14,.72)', eyebrow: 'What you are paying for', size: 112,
    title: 'Twenty years of knowing when to stop.',
    support: 'Anyone can put lightener on hair. The part you are paying for is the person watching it, deciding it has gone far enough, and being willing to say so.',
    shapes: disc(FIG, 620, 640, -170, 0.9) + halfArc(GOLD, 760, -220, 1060, 0.22),
  },
  {
    file: 'w6-p5-sundayclaim.png', layout: 'hero', bg: INK, fg: CREAM, accent: GOLD,
    supColor: 'rgba(246,241,233,.78)', eyebrow: 'Sunday 20 September', size: 116,
    title: 'One chair. Ten til two.',
    support: 'Four hours holds one big colour. When it is taken the next one is a week away, so it goes to whoever asks first.',
    shapes: disc(FIG, 700, 620, -220, 0.85) + halfArc(CLAY, 700, -180, 1080, 0.2),
  },
];

const PAIRS = [
  { file: 'w6-c1-1.png', kind: 'do', bg: CLAY, kick: 'Colour care · Swipe', size: 92,
    title: 'Four things quietly wrecking your colour.',
    support: 'None of them cost anything to fix, and none of them are a product you have to buy from me.', pos: '1 / 5' },
  { file: 'w6-c1-2.png', kind: 'dont', kick: "Don't · One", size: 90,
    title: 'Washing it the day you get home.',
    support: 'The cuticle is still open. Everything you just paid for goes down the drain. Give it 48 hours.', pos: '2 / 5' },
  { file: 'w6-c1-3.png', kind: 'dont', kick: "Don't · Two", size: 104,
    title: 'Rinsing in hot water.',
    support: 'Heat opens the cuticle every single wash and the tone leaves with it. Lukewarm is the cheapest fix on this list.', pos: '3 / 5' },
  { file: 'w6-c1-4.png', kind: 'dont', kick: "Don't · Three", size: 90,
    title: 'Purple shampoo every wash.',
    support: 'It is a toner, not a shampoo. Daily use turns blonde grey and flat. Once a week, two minutes, no longer.', pos: '4 / 5' },
  { file: 'w6-c1-5.png', kind: 'do', bg: CREAM, kick: 'And the fourth', size: 96,
    title: 'Straightening on the highest heat.',
    support: '185 degrees is enough on coloured hair. Above that you are cooking the colour out of it. Book the gloss before it goes — $45, 45 minutes.', pos: '5 / 5' },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromiumPath() });

async function shoot(html, file) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(join(OUT, file), await page.screenshot({ type: 'png' }));
  console.log('  ' + file);
  await page.close();
}

console.log('Singles');
for (const c of SINGLES) {
  const html = c.layout === 'menu' ? menuHtml(c) : c.layout === 'sunday' ? sundayHtml(c) : heroHtml(c);
  await shoot(html, c.file);
}
console.log('Carousel — dos and don\'ts');
for (const s of PAIRS) await shoot(pairHtml(s), s.file);

await browser.close();
console.log(`\nDone — ${SINGLES.length} singles, ${PAIRS.length} carousel slides.`);
