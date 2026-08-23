#!/usr/bin/env node
/**
 * Renders the week's post images.
 *
 * ---------------------------------------------------------------------------
 * Why this file was rewritten on 23 Aug 2026
 *
 * The first two weeks rendered typographic cards — ink and cream, Fraunces
 * display type, no photograph. Two of them were published. They scored **1 like
 * each: 0.56%, grade F**, against an account average of 7.27%.
 *
 * The live read that week put the reason beyond argument:
 *
 *     VIDEO  n=22   avg engagement 8.11%
 *     IMAGE  n=3    avg engagement 1.11%
 *
 * Video outperforms stills 7.3x here, and the three worst-performing items on
 * the whole account are the only three stills on it. CLAUDE.md said this from
 * the beginning — "stills have never out-performed a reel on this account" —
 * and the cards were built anyway.
 *
 * The lever available to a still is that it shows the work. Every layout below
 * is built on a photograph of Sha's actual colour, from her own gallery, with
 * type set into it rather than instead of it. Same conclusion the ads reached a
 * week earlier; this brings the organic posts into line with it.
 *
 * Invariant 2 is untouched and this is the point of it: it bans AI photographs
 * of hair, not photographs.
 *
 * ---------------------------------------------------------------------------
 * Layouts
 *
 *   hero-price   full-bleed photo, ink scrim, a price carried in gold
 *   bundle       photo over a cream plate itemising what a package includes
 *   steps        photo over a cream plate carrying a numbered, saveable list
 *   statement    full-bleed photo, one line of type, almost nothing else
 *
 * `statement` is deliberately the least designed thing here. It is a controlled
 * test of the actual question: do stills fail on this account, or do *text
 * cards* fail? If the near-bare photograph beats the three busier ones, the
 * answer is text density and the next fortnight gets much simpler.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = process.argv[2] || join(ROOT, 'content', 'cards');
const PHOTOS = join(ROOT, 'content', 'photos');
const W = 1080;
const H = 1350; // 4:5 — tallest ratio Instagram shows in-feed uncropped

const INK = '#12100E';
const GOLD = '#B07C33';
const VIOLET = '#6A5B8C';
const CREAM = '#F6F1E9';

const FONTS = readFileSync(join(ROOT, 'assets', 'fonts', 'brand-fonts.css'), 'utf8');

/** Film grain, inline SVG turbulence. Puts type and photograph in one material. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.42'/%3E%3C/svg%3E\")";

function chromiumPath() {
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'];
  return candidates.find((p) => p && existsSync(p)) || undefined;
}

function shell(card) {
  const { photo, focus = '50% 40%', zoom = 100 } = card;
  return `
    ${FONTS}
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:${W}px;height:${H}px;overflow:hidden;position:relative;background:${INK};
         font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;
         text-rendering:geometricPrecision}
    .shot{position:absolute;inset:0;background-image:url('${photo}');
          background-size:${zoom}% auto;background-position:${focus};
          background-repeat:no-repeat;filter:saturate(1.12) contrast(1.05) brightness(.99)}
    .warm{position:absolute;inset:0;background:${GOLD};opacity:.13;mix-blend-mode:soft-light}
    .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.15;
           mix-blend-mode:overlay;pointer-events:none}
    .eyebrow{font-size:20px;letter-spacing:.26em;text-transform:uppercase;font-weight:600;color:${GOLD}}
    h1{font-family:'Fraunces',serif;font-weight:400;line-height:1.03;letter-spacing:-.026em;
       font-variation-settings:'opsz' 144}
    .rule{height:1px;background:${GOLD};opacity:.5}
  `;
}

function html(card) {
  const base = shell(card);

  /* ---------- hero-price ---------- */
  if (card.kind === 'hero-price') {
    return `<html><head><meta charset="utf-8"><style>${base}
      /* Holds near-clear to 44% so the gloss reads, then drops fast. A gentle
         gradient muddies the hair AND leaves type on moving texture. */
      .scrim{position:absolute;inset:0;background:linear-gradient(to bottom,
        rgba(18,16,14,.32) 0%, rgba(18,16,14,.05) 26%, rgba(18,16,14,.26) 44%,
        rgba(18,16,14,.80) 55%, rgba(18,16,14,.95) 66%, ${INK} 88%)}
      .copy{position:absolute;left:76px;right:76px;bottom:84px;color:${CREAM}}
      h1{font-size:76px;margin:18px 0 0;max-width:15ch}
      .price{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;font-size:96px;
             color:${GOLD};margin-top:22px;line-height:1;letter-spacing:-.03em}
      .support{font-size:26px;line-height:1.5;color:rgba(246,241,233,.78);margin-top:16px;max-width:31ch}
      .foot{display:flex;justify-content:space-between;font-size:21px;font-weight:500;
            color:rgba(246,241,233,.62);margin-top:30px}
    </style></head><body>
      <div class="shot"></div><div class="warm"></div><div class="scrim"></div><div class="grain"></div>
      <div class="copy">
        <p class="eyebrow">${card.eyebrow}</p>
        <h1>${card.headline}</h1>
        <p class="price">${card.price}</p>
        <p class="support">${card.support}</p>
        <div class="rule" style="margin-top:26px"></div>
        <div class="foot"><span>${card.footL}</span><span>${card.footR}</span></div>
      </div>
    </body></html>`;
  }

  /* ---------- bundle ---------- */
  if (card.kind === 'bundle') {
    const rows = card.items
      .map(
        (i) =>
          `<div class="row"><span>${i.label}</span><span class="${i.strike ? 'was' : 'inc'}">${i.value}</span></div>`,
      )
      .join('');
    return `<html><head><meta charset="utf-8"><style>${base}
      .frame{position:absolute;left:0;right:0;top:0;height:46%;overflow:hidden}
      .seam{position:absolute;left:0;right:0;top:46%;height:3px;background:${GOLD};z-index:2}
      .plate{position:absolute;left:0;right:0;bottom:0;height:54%;background:${CREAM};color:${INK};
             padding:44px 72px 48px;display:flex;flex-direction:column}
      h1{font-size:50px;margin-top:12px;max-width:20ch}
      .rows{margin-top:24px;border-top:1px solid rgba(18,16,14,.16)}
      .row{display:flex;justify-content:space-between;align-items:baseline;padding:15px 0;
           border-bottom:1px solid rgba(18,16,14,.16);font-size:25px;color:rgba(18,16,14,.82)}
      .inc{color:${GOLD};font-weight:600;font-size:21px;letter-spacing:.1em;text-transform:uppercase}
      .was{color:rgba(18,16,14,.42);text-decoration:line-through;font-weight:500}
      .grow{flex:1}
      .total{display:flex;justify-content:space-between;align-items:baseline;margin-top:22px}
      .total .lab{font-size:21px;letter-spacing:.18em;text-transform:uppercase;font-weight:600;color:${GOLD}}
      .total .num{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;
                  font-size:88px;line-height:1;letter-spacing:-.03em}
      .note{font-size:22px;color:rgba(18,16,14,.55);margin-top:8px}
      .foot{display:flex;justify-content:space-between;font-size:21px;font-weight:600;
            color:${INK};margin-top:22px}
    </style></head><body>
      <div class="frame"><div class="shot"></div><div class="warm"></div><div class="grain"></div></div>
      <div class="seam"></div>
      <div class="plate">
        <p class="eyebrow">${card.eyebrow}</p>
        <h1>${card.headline}</h1>
        <div class="rows">${rows}</div>
        <div class="grow"></div>
        <div class="total"><span class="lab">Together</span><span class="num">${card.total}</span></div>
        <p class="note">${card.note}</p>
        <div class="foot"><span>${card.footL}</span><span>${card.footR}</span></div>
      </div>
    </body></html>`;
  }

  /* ---------- steps ---------- */
  if (card.kind === 'steps') {
    const items = card.items
      .map((t) => `<li><span>${t}</span></li>`)
      .join('');
    return `<html><head><meta charset="utf-8"><style>${base}
      .frame{position:absolute;left:0;right:0;top:0;height:38%;overflow:hidden}
      .seam{position:absolute;left:0;right:0;top:38%;height:3px;background:${GOLD};z-index:2}
      .plate{position:absolute;left:0;right:0;bottom:0;height:62%;background:${CREAM};color:${INK};
             padding:44px 72px 46px;display:flex;flex-direction:column}
      h1{font-size:52px;margin-top:12px;max-width:20ch}
      ol{list-style:none;counter-reset:i;margin-top:24px}
      li{counter-increment:i;display:flex;gap:24px;padding:17px 0;align-items:baseline;
         border-bottom:1px solid rgba(18,16,14,.14);font-size:26px;line-height:1.35;
         color:rgba(18,16,14,.84)}
      li:first-child{border-top:1px solid rgba(18,16,14,.14)}
      /* Inter for the numerals: Fraunces' display 3 has a flat top that reads
         as a 5 at thumbnail size. */
      li::before{content:'0' counter(i);font-family:'Inter',sans-serif;font-size:22px;color:${GOLD};
                 min-width:52px;font-weight:600;letter-spacing:.06em;font-variant-numeric:tabular-nums}
      .grow{flex:1}
      .close{border-left:2px solid ${GOLD};padding-left:22px;font-size:24px;line-height:1.45;
             color:rgba(18,16,14,.68);max-width:80%}
      .foot{display:flex;justify-content:space-between;font-size:21px;font-weight:600;
            color:${INK};margin-top:22px}
    </style></head><body>
      <div class="frame"><div class="shot"></div><div class="warm"></div><div class="grain"></div></div>
      <div class="seam"></div>
      <div class="plate">
        <p class="eyebrow">${card.eyebrow}</p>
        <h1>${card.headline}</h1>
        <ol>${items}</ol>
        <div class="grow"></div>
        <p class="close">${card.close}</p>
        <div class="foot"><span>${card.footL}</span><span>${card.footR}</span></div>
      </div>
    </body></html>`;
  }

  /* ---------- statement ---------- */
  return `<html><head><meta charset="utf-8"><style>${base}
    .scrim{position:absolute;inset:0;background:linear-gradient(to bottom,
      rgba(18,16,14,.42) 0%, rgba(18,16,14,.10) 30%, rgba(18,16,14,.18) 52%,
      rgba(18,16,14,.72) 74%, rgba(18,16,14,.92) 100%)}
    .top{position:absolute;top:70px;left:72px;right:72px}
    .copy{position:absolute;left:72px;right:72px;bottom:76px;color:${CREAM}}
    h1{font-size:82px;max-width:13ch;text-shadow:0 2px 30px rgba(18,16,14,.45)}
    .support{font-size:27px;line-height:1.5;color:rgba(246,241,233,.82);margin-top:22px;max-width:28ch}
    .foot{display:flex;justify-content:space-between;font-size:21px;font-weight:500;
          color:rgba(246,241,233,.6);margin-top:28px}
  </style></head><body>
    <div class="shot"></div><div class="warm"></div><div class="scrim"></div><div class="grain"></div>
    <div class="top"><p class="eyebrow">${card.eyebrow}</p></div>
    <div class="copy">
      <h1>${card.headline}</h1>
      <p class="support">${card.support}</p>
      <div class="rule" style="margin-top:26px"></div>
      <div class="foot"><span>${card.footL}</span><span>${card.footR}</span></div>
    </div>
  </body></html>`;
}

export const CARDS = [
  {
    file: 'w3-blowwave.png',
    kind: 'hero-price',
    photo: 'site/site-07-IMG_0260.jpg',
    focus: '50% 34%',
    zoom: 118,
    eyebrow: 'Blow wave · Camberwell',
    headline: 'Forty five minutes<br>and the week<br>looks handled.',
    price: 'from $55',
    support: 'Booked into the gaps a colour cannot fill — Wednesday, Thursday and Friday.',
    footL: 'Hair by Sha',
    footR: '45 min',
  },
  {
    file: 'w3-package.png',
    kind: 'bundle',
    photo: 'site/site-02-sha-at-work-2.jpg',
    // Pushed hard right and down. The obvious crop centred the ELEVEN poster
    // on the wall, so the card led with a stock beauty model instead of Sha's
    // hands — exactly the "looks like an ad" read this rewrite exists to kill.
    // Source is only 900x1200, so this is a ~2.4x upscale and slightly soft at
    // full size; it holds at feed size and the right subject beats the sharper
    // wrong one.
    focus: '94% 52%',
    zoom: 200,
    eyebrow: 'Limited time',
    headline: 'Half foil, toner,<br>treatment, blow dry.',
    items: [
      { label: 'Half foil', value: 'Included' },
      { label: 'Toner', value: '$45', strike: true },
      { label: 'Deep treatment', value: '$30', strike: true },
      { label: 'Blow dry', value: '$35', strike: true },
    ],
    total: '$250',
    note: 'Booked separately it comes to about $350.',
    footL: 'Wed · Thu · Fri',
    footR: 'Hair by Sha',
  },
  {
    file: 'w3-lasting.png',
    kind: 'steps',
    photo: 'site/site-13-IMG_0764.jpg',
    focus: '50% 30%',
    zoom: 116,
    eyebrow: 'Make it last',
    headline: 'Five days from<br>one blow wave.',
    items: [
      'Let each section cool before you brush it out',
      'Shower cap on. Water is the enemy, not time',
      'Silk pillowcase, or a loose plait at night',
      'Dry shampoo on day two, before it looks oily',
      'Stop touching it — that is the oil, not the style',
    ],
    close: 'Save this. Three to five days is normal; five to seven is what these get you.',
    footL: 'Hair by Sha',
    footR: 'Camberwell',
  },
  {
    file: 'w3-brunette.png',
    kind: 'statement',
    photo: 'site/site-14-IMG_0766.jpg',
    focus: '50% 42%',
    zoom: 112,
    eyebrow: 'Colour specialist · 20 years',
    headline: 'Not everyone<br>should go blonde.',
    support: 'Sometimes the answer is depth and shine, not lift. I will tell you which.',
    footL: 'Hair by Sha',
    footR: 'Camberwell',
  },
];

export async function render(outDir = OUT, cards = CARDS) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  // Written into the photos directory so the images are same-origin siblings.
  // setContent() runs on about:blank and Chromium refuses file:// subresources
  // from an opaque origin — the photo silently fails and renders as a black
  // rectangle with type on it.
  const scratch = join(PHOTOS, '.render.html');
  const written = [];
  for (const card of cards) {
    writeFileSync(scratch, html(card));
    await page.goto(`file://${scratch}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(
      (src) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = src; }),
      card.photo,
    );
    const buf = await page.screenshot({ type: 'png' });
    const dest = join(outDir, card.file);
    writeFileSync(dest, buf);
    written.push(dest);
    console.log(`${card.file}  ${Math.round(buf.length / 1000)}kB`);
  }
  await browser.close();
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) await render();
