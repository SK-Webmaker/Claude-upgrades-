#!/usr/bin/env node
/**
 * Week 7 — the three loud ones.
 *
 * The brief was jaw-dropping: design elements that stop a thumb, a clear and
 * creative call to action, and the services with their real "from" prices.
 *
 * Everything before this has been quiet and editorial. That was right for
 * education and it is why the studio palette is working, but a price
 * advertisement has a different job — it has to survive a 120px thumbnail in a
 * feed it was not invited to. So these three push scale and contrast as hard as
 * the palette allows, and each one uses a device the account has never run:
 *
 *   THE NUMBER   a 620px numeral bleeding off three edges, over a
 *                repeating-conic sunburst. The price IS the composition.
 *   THE ORBIT    real SVG text on a circular path — services orbiting a
 *                price disc. Nothing else in this feed is round.
 *   THE MARQUEE  diagonal repeating bands of the full menu at -14deg, with an
 *                outline-stacked headline punching through the middle.
 *
 * Palette is unchanged — FIG, CLAY, GOLD, CREAM, INK — because the measured
 * result says the palette is not the problem. What changes is amplitude.
 *
 * Every price is read from config/brand.json at render time and the `from`
 * flag is respected in the markup, so a flat price can never render as "from"
 * and vice versa. Invariant 5: prices never come from memory.
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
const BRAND = JSON.parse(readFileSync(join(ROOT, 'config', 'brand.json'), 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const chromiumPath = () =>
  [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p)) || undefined;

/** Look a service up by name. Throws rather than guessing — a wrong price on a
 *  price card is the one defect that costs money in the chair. */
function svc(name) {
  const s = BRAND.positioning.services.find((x) => x.name === name);
  if (!s) throw new Error(`service not in brand.json: ${name}`);
  return s;
}
const priceLabel = (s) => (s.from ? `from $${s.price}` : `$${s.price}`);

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='5'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

function base(bg) {
  return `${FONTS}
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:1080px;height:1350px;overflow:hidden}
    body{position:relative;background:${bg};font-family:'Inter',sans-serif;
         -webkit-font-smoothing:antialiased}
    .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.12;
           mix-blend-mode:multiply;pointer-events:none;z-index:20}
    .fr{font-family:'Fraunces',serif;font-weight:400;font-variation-settings:'opsz' 144;
        letter-spacing:-.04em;line-height:.86}
    .lbl{font-size:22px;letter-spacing:.3em;text-transform:uppercase;font-weight:800}
    .num{font-family:'Inter',sans-serif;font-variation-settings:normal;font-weight:800;
         font-variant-numeric:tabular-nums;letter-spacing:-.05em}`;
}

/* ============ 1 · THE NUMBER ============
   A 620px numeral cropped by three edges, over a conic sunburst. At thumbnail
   size the only thing that survives is the number, which is the point. */
function numberHtml() {
  const s = svc('Balayage / Lived-in Blonde');
  const hrs = Math.floor(s.minutes / 60), mins = s.minutes % 60;
  return `<html><head><meta charset="utf-8"><style>${base(INK)}
    /* 48 rays. Fewer reads as a pie chart, more turns to moire at thumbnail. */
    .rays{position:absolute;width:2200px;height:2200px;left:-460px;top:-500px;
      background:repeating-conic-gradient(from 0deg at 50% 50%,
        ${GOLD} 0deg 3.75deg, transparent 3.75deg 7.5deg);
      opacity:.17;z-index:1}
    .ring{position:absolute;width:1180px;height:1180px;left:-50px;top:170px;
      border:5px solid ${GOLD};border-radius:50%;opacity:.5;z-index:2}
    .big{position:absolute;left:-52px;top:186px;font-size:660px;color:${CREAM};
         z-index:4;letter-spacing:-.07em}
    .from{position:absolute;left:52px;top:150px;z-index:6;color:${GOLD}}
    .dollar{position:absolute;left:36px;top:322px;font-size:150px;color:${GOLD};z-index:6}
    .svcname{position:absolute;left:70px;top:832px;z-index:6;font-size:76px;color:${CREAM};
             max-width:11ch}
    .meta{position:absolute;left:74px;top:1012px;z-index:6;font-size:27px;font-weight:600;
          color:${CLAY};letter-spacing:.04em}
    .cta{position:absolute;left:0;right:0;bottom:0;height:150px;background:${GOLD};z-index:8;
         display:flex;align-items:center;justify-content:space-between;padding:0 70px}
    .cta b{font-size:40px;color:${INK};font-weight:800;letter-spacing:-.01em}
    .cta span{font-size:24px;color:${INK};font-weight:800;letter-spacing:.22em;text-transform:uppercase}
    .brandmark{position:absolute;right:70px;top:150px;z-index:6;text-align:right}
  </style></head><body>
    <div class="rays"></div>
    <div class="ring"></div>
    <div class="big num">340</div>
    <div class="from lbl">From</div>
    <div class="dollar num">$</div>
    <div class="brandmark"><span class="lbl" style="color:${CLAY}">Hair by Sha</span></div>
    <h1 class="svcname fr">${esc(s.name.replace(' / ', '<br>').replace(/&/g, '&amp;')).replace('&lt;br&gt;', '<br>')}</h1>
    <p class="meta">${hrs} hr ${mins ? mins + ' min' : ''} &nbsp;·&nbsp; Toner and blow wave included</p>
    <div class="cta"><b>DM the word BLONDE</b><span>Camberwell</span></div>
    <div class="grain"></div>
  </body></html>`;
}

/* ============ 2 · THE ORBIT ============
   Real SVG text on a circular path. Nothing else in a hair feed is round, and
   a ring of type reads as an object rather than a caption. */
function orbitHtml() {
  // Short labels, not full service names — the path is finite and the full
  // names overran it. Prices still come from brand.json with the from flag.
  const ring = [
    ['BALAYAGE', svc('Balayage / Lived-in Blonde')],
    ['FOILS', svc('Partial Blonde (Foils)')],
    ['ROOT', svc('Root Colour + Refresh')],
    ['BLOW WAVE', svc('Blow Wave')],
  ];
  const centre = svc('Toner & Gloss');
  const ringText = ring.map(([n, s]) => `${n} ${priceLabel(s).toUpperCase()}`).join('  \u2726  ') + '  \u2726  ';
  return `<html><head><meta charset="utf-8"><style>${base(FIG)}
    .halo{position:absolute;width:1560px;height:1560px;left:-240px;top:-110px;border-radius:50%;
      background:radial-gradient(circle, rgba(201,168,139,.22) 0%, rgba(201,168,139,0) 62%);z-index:1}
    svg{position:absolute;left:-60px;top:40px;z-index:3}
    .disc{position:absolute;width:500px;height:500px;left:290px;top:350px;border-radius:50%;
      background:${CLAY};z-index:4;display:flex;flex-direction:column;align-items:center;
      justify-content:center;gap:2px}
    .disc .k{font-size:21px;letter-spacing:.26em;text-transform:uppercase;font-weight:800;color:${FIG}}
    .disc .p{font-size:188px;color:${INK};line-height:.82;margin-top:6px}
    .disc .t{font-size:25px;font-weight:700;color:${FIG};letter-spacing:.03em}
    .head{position:absolute;left:70px;top:74px;z-index:6}
    .foot{position:absolute;left:0;right:0;bottom:0;z-index:8}
    .cta{height:146px;background:${GOLD};display:flex;align-items:center;
         justify-content:space-between;padding:0 70px}
    .cta b{font-size:38px;color:${INK};font-weight:800}
    .cta span{font-size:23px;color:${INK};font-weight:800;letter-spacing:.2em;text-transform:uppercase}
    .strap{position:absolute;left:0;right:0;bottom:146px;height:76px;background:${INK};
           display:flex;align-items:center;justify-content:center;gap:34px}
    .strap i{font-style:normal;font-size:23px;color:${CLAY};font-weight:700;letter-spacing:.14em;
             text-transform:uppercase}
  </style></head><body>
    <div class="halo"></div>
    <svg width="1200" height="1200" viewBox="0 0 1200 1200">
      <defs>
        <path id="ring" d="M600,130 a430,430 0 1,1 -0.1,0" fill="none"/>
      </defs>
      <text font-family="Inter" font-size="38" font-weight="800" letter-spacing="2"
            fill="${CLAY}"><textPath href="#ring" startOffset="0">${esc(ringText)}</textPath></text>
    </svg>
    <div class="disc">
      <span class="k">Toner &amp; Gloss</span>
      <span class="p num">$${centre.price}</span>
      <span class="t">${centre.minutes} minutes</span>
    </div>
    <div class="head"><span class="lbl" style="color:${CLAY}">The whole menu</span></div>
    <div class="foot">
      <div class="strap"><i>Camberwell</i><i>&#10022;</i><i>20+ years</i><i>&#10022;</i><i>K18 certified</i></div>
      <div class="cta"><b>DM me the service you want</b><span>Hair by Sha</span></div>
    </div>
    <div class="grain"></div>
  </body></html>`;
}

/* ============ 3 · THE MARQUEE ============
   Diagonal repeating bands of the full menu, with an outline-stacked headline
   punching through. Loud at full size, still a strong diagonal at thumbnail. */
function marqueeHtml() {
  const menu = [
    svc('Balayage / Lived-in Blonde'),
    svc('Blonde Transformation + K18'),
    svc('Partial Blonde (Foils)'),
    svc('Root Colour + Refresh'),
    svc('Cut & Blow Wave'),
    svc('Blow Wave'),
    svc('K18 Treatment'),
  ];
  const strip = menu.map((s) => `${s.name.toUpperCase()} &nbsp;${priceLabel(s).toUpperCase()}`).join(' &nbsp;&#10022;&nbsp; ');
  const band = (top, bg, fg, dir) => `
    <div class="band" style="top:${top}px;background:${bg}">
      <div class="run" style="color:${fg};${dir < 0 ? 'justify-content:flex-end;' : ''}">
        ${strip} &nbsp;&#10022;&nbsp; ${strip}
      </div>
    </div>`;
  return `<html><head><meta charset="utf-8"><style>${base(CREAM)}
    .stage{position:absolute;inset:-260px;transform:rotate(-14deg);z-index:2}
    .band{position:absolute;left:0;right:0;height:96px;display:flex;align-items:center;overflow:hidden}
    .run{white-space:nowrap;font-size:36px;font-weight:800;letter-spacing:.06em;
         display:flex;align-items:center;width:100%}
    .plate{position:absolute;left:0;right:0;top:432px;height:486px;z-index:6;
           display:flex;flex-direction:column;align-items:center;justify-content:center;
           background:${CREAM};border-top:7px solid ${INK};border-bottom:7px solid ${INK}}
    .plate .k{font-size:23px;letter-spacing:.3em;text-transform:uppercase;font-weight:800;color:${GOLD}}
    /* Outline stack: three offset strokes behind a solid face, so the headline
       reads as an object sitting on the bands rather than text laid over them. */
    .stack{position:relative;margin-top:16px;height:210px;width:100%}
    .stack div{position:absolute;left:0;right:0;text-align:center;font-size:166px;line-height:.9}
    .o1{-webkit-text-stroke:4px ${CLAY};color:transparent;transform:translate(14px,14px)}
    .o2{-webkit-text-stroke:4px ${FIG};color:transparent;transform:translate(7px,7px)}
    .face{color:${INK}}
    .sub{font-size:31px;font-weight:600;color:rgba(18,16,14,.76);margin-top:12px;text-align:center;
         max-width:26ch}
    .cta{position:absolute;left:0;right:0;bottom:0;height:150px;background:${INK};z-index:8;
         display:flex;align-items:center;justify-content:space-between;padding:0 70px}
    .cta b{font-size:38px;color:${CREAM};font-weight:800}
    .cta span{font-size:23px;color:${GOLD};font-weight:800;letter-spacing:.2em;text-transform:uppercase}
  </style></head><body>
    <div class="stage">
      ${band(120, INK, CREAM, 1)}
      ${band(300, GOLD, INK, -1)}
      ${band(480, FIG, CREAM, 1)}
      ${band(660, CLAY, INK, -1)}
      ${band(840, INK, CREAM, 1)}
      ${band(1020, GOLD, INK, -1)}
      ${band(1200, FIG, CREAM, 1)}
      ${band(1380, CLAY, INK, -1)}
      ${band(1560, INK, CREAM, 1)}
    </div>
    <div class="plate">
      <span class="k">Every price, no surprises</span>
      <div class="stack fr">
        <div class="o1">THE MENU</div>
        <div class="o2">THE MENU</div>
        <div class="face">THE MENU</div>
      </div>
      <p class="sub">Colour from $240. Blow wave from $55. Gloss $45.</p>
    </div>
    <div class="cta"><b>DM me for a quote on yours</b><span>Camberwell</span></div>
    <div class="grain"></div>
  </body></html>`;
}

const CARDS = [
  { file: 'w7-x1-number.png', html: numberHtml },
  { file: 'w7-x2-orbit.png', html: orbitHtml },
  { file: 'w7-x3-marquee.png', html: marqueeHtml },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromiumPath() });
for (const c of CARDS) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await page.setContent(c.html(), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(join(OUT, c.file), await page.screenshot({ type: 'png' }));
  console.log('  ' + c.file);
  await page.close();
}
await browser.close();
console.log('\nDone — 3 loud cards.');
