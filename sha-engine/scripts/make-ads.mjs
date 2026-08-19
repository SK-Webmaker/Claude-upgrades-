#!/usr/bin/env node
/**
 * Renders Facebook ad creative.
 *
 * Round 1 of these ads was a typographic card — the same system as the organic
 * posts, in the same palette, with the same layout language. It was rejected,
 * correctly: it read as a restatement of the feed rather than as advertising.
 * A card works in-feed for people who already follow her, where the brand is
 * already established. To a stranger mid-scroll it is a slide with words on it.
 *
 * So these are built on her actual work. `content/photos/` holds real client
 * photography from her own site, upscaled 2× through Picsart so a 4:5 crop out
 * of a 9:16 original stays sharp. Before/after and transformation imagery is
 * the highest-converting creative in this category, and nothing typographic
 * substitutes for showing the colour.
 *
 * Invariant 2 is intact and this is the point of it: the rule bans AI
 * photographs of hair, not photographs. Every pixel of hair here is work Sha
 * actually did.
 *
 * Two layouts, deliberately unlike each other and unlike the cards:
 *
 *   hero    full-bleed photo, ink scrim rising from the base, type set into it
 *   spread  editorial split — photo above, cream type plate below
 *
 * Both carry a warm grade toward the brand palette, a fine gold rule, and a
 * light film grain. The grain is the detail that stops a flat digital overlay
 * looking like a template: it puts the type and the photograph in the same
 * material world instead of one floating over the other.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = process.argv[2] || join(ROOT, 'content', 'ads');
const PHOTOS = join(ROOT, 'content', 'photos');
const W = 1080;
const H = 1350;

const INK = '#12100E';
const GOLD = '#B07C33';
const CREAM = '#F6F1E9';

const FONTS = readFileSync(join(ROOT, 'assets', 'fonts', 'brand-fonts.css'), 'utf8');

/** Film grain as an inline SVG turbulence — no network, no asset to ship. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.42'/%3E%3C/svg%3E\")";

function chromiumPath() {
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'];
  return candidates.find((p) => p && existsSync(p)) || undefined;
}

/**
 * Relative, not file:// absolute.
 *
 * setContent() runs the page on about:blank, and Chromium refuses file://
 * subresource reads from an opaque origin — the photo silently does not load
 * and you get a black rectangle with type on it. The page is written into the
 * photos directory and opened with goto() instead, so the images are
 * same-origin siblings and simply resolve.
 */
function photoUrl(file) {
  return file;
}

function html(ad) {
  const { kind, photo, focus = '50% 40%', zoom = 100 } = ad;

  const base = `
    ${FONTS}
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:${W}px;height:${H}px;overflow:hidden;position:relative;
         font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;
         text-rendering:geometricPrecision;background:${INK}}
    .shot{position:absolute;inset:0;background-image:url('${photoUrl(photo)}');
          background-size:${zoom}% auto;background-position:${focus};
          background-repeat:no-repeat;
          /* Warm the salon's cool fluorescent light toward her palette. */
          filter:saturate(1.12) contrast(1.05) brightness(.99);}
    /* Gold wash on soft-light — ties the photograph to the brand without
       tinting it so hard the colour work stops being readable. */
    .warm{position:absolute;inset:0;background:${GOLD};opacity:.14;
          mix-blend-mode:soft-light}
    .grain{position:absolute;inset:0;background-image:${GRAIN};
           opacity:.16;mix-blend-mode:overlay;pointer-events:none}
    .eyebrow{font-size:20px;letter-spacing:.28em;text-transform:uppercase;
             font-weight:600;color:${GOLD}}
    h1{font-family:'Fraunces',serif;font-weight:400;line-height:1.02;
       letter-spacing:-.028em;font-variation-settings:'opsz' 144}
    .rule{height:1px;background:${GOLD};opacity:.55}
  `;

  if (kind === 'hero') {
    return `<html><head><meta charset="utf-8"><style>${base}
      /* The scrim starts transparent well down the frame so the waves stay
         visible, then goes almost solid so the type never fights the photo. */
      /* Ramps hard rather than evenly. A gentle gradient is the obvious choice
         and it fails both jobs at once: the hair is muddied AND the type still
         sits on moving texture. Holding it near-clear to 44% keeps the colour
         work bright, then dropping fast gives the copy a solid ground to sit
         on — legibility is not negotiable in an ad nobody asked to see. */
      .scrim{position:absolute;inset:0;background:linear-gradient(
        to bottom,
        rgba(18,16,14,.34) 0%,
        rgba(18,16,14,.05) 26%,
        rgba(18,16,14,.26) 44%,
        rgba(18,16,14,.80) 55%,
        rgba(18,16,14,.95) 66%,
        ${INK} 88%)}
      .copy{position:absolute;left:76px;right:76px;bottom:88px;color:${CREAM}}
      h1{font-size:78px;margin:20px 0 0;max-width:15ch}
      .price{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;
             font-size:44px;color:${GOLD};margin-top:26px;letter-spacing:-.01em}
      .support{font-size:26px;line-height:1.5;color:rgba(246,241,233,.78);
               margin-top:18px;max-width:30ch}
      .foot{display:flex;justify-content:space-between;align-items:baseline;
            font-size:21px;letter-spacing:.04em;font-weight:500;
            color:rgba(246,241,233,.66);margin-top:34px}
    </style></head><body>
      <div class="shot"></div><div class="warm"></div>
      <div class="scrim"></div><div class="grain"></div>
      <div class="copy">
        <p class="eyebrow">${ad.eyebrow}</p>
        <h1>${ad.headline}</h1>
        <p class="price">${ad.price}</p>
        <p class="support">${ad.support}</p>
        <div class="rule" style="margin-top:30px"></div>
        <div class="foot"><span>${ad.footL}</span><span>${ad.footR}</span></div>
      </div>
    </body></html>`;
  }

  // 'spread' — photo above, cream plate below. Reads as a magazine page.
  return `<html><head><meta charset="utf-8"><style>${base}
    .frame{position:absolute;left:0;right:0;top:0;height:62%;overflow:hidden}
    .frame .shot{filter:saturate(1.1) contrast(1.04)}
    .plate{position:absolute;left:0;right:0;bottom:0;height:38%;
           background:${CREAM};color:${INK};padding:52px 76px 56px;
           display:flex;flex-direction:column}
    h1{font-size:58px;max-width:19ch}
    .support{font-size:25px;line-height:1.5;color:rgba(18,16,14,.66);
             margin-top:18px;max-width:34ch}
    .grow{flex:1}
    .foot{display:flex;justify-content:space-between;align-items:baseline;
          font-size:22px;letter-spacing:.03em;font-weight:600;color:${INK}}
    .foot .muted{color:rgba(18,16,14,.5);font-weight:500}
    /* Gold seam on the join, so the two halves read as one designed object. */
    .seam{position:absolute;left:0;right:0;bottom:38%;height:3px;background:${GOLD}}
  </style></head><body>
    <div class="frame">
      <div class="shot"></div><div class="warm"></div><div class="grain"></div>
    </div>
    <div class="seam"></div>
    <div class="plate">
      <p class="eyebrow">${ad.eyebrow}</p>
      <h1 style="margin-top:16px">${ad.headline}</h1>
      <p class="support">${ad.support}</p>
      <div class="grow"></div>
      <div class="foot"><span>${ad.footL}</span><span class="muted">${ad.footR}</span></div>
    </div>
  </body></html>`;
}

export const ADS = [
  {
    file: 'ad-01-lived-in.png',
    kind: 'hero',
    photo: 'hero-balayage-2x.png',
    focus: '52% 30%',
    zoom: 132,
    eyebrow: 'Lived-in blonde · Camberwell',
    headline: 'Still looks<br>deliberate<br>in December.',
    price: 'from $340',
    support:
      'Hand-painted, so it grows out soft instead of leaving you a line at eight weeks.',
    footL: 'Thursday & Friday',
    footR: 'Hair by Sha',
  },
  {
    file: 'ad-02-straight-answer.png',
    kind: 'spread',
    // Same source photo as ad 1, cropped to a different region — the wave and
    // length rather than the crown. photo-layers is cooler and flatter and the
    // crop read as a wall of hair with no shape; photo-updo is her warmest work
    // but carries a third party's face reflected in the salon mirror, which is
    // not something to put behind ad spend without that person's consent.
    photo: 'hero-balayage-2x.png',
    focus: '48% 62%',
    zoom: 112,
    eyebrow: '20 years · K18 certified · colour only',
    headline: 'Ask me what your hair can actually take.',
    support:
      'I’ll tell you straight — including the weeks when the honest answer is a $45 toner, not a $340 balayage.',
    footL: '0452 611 799',
    footR: 'Thursday & Friday',
  },
];

export async function render(outDir = OUT, ads = ADS) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const written = [];
  const scratch = join(PHOTOS, '.render.html');
  for (const ad of ads) {
    writeFileSync(scratch, html(ad));
    await page.goto(`file://${scratch}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // background-image is not covered by waitUntil:'load' reliably — decode the
    // photo explicitly so the shot is never captured half-painted.
    await page.evaluate(
      (src) =>
        new Promise((res) => {
          const i = new Image();
          i.onload = i.onerror = res;
          i.src = src;
        }),
      ad.photo,
    );
    const buf = await page.screenshot({ type: 'png' });
    const dest = join(outDir, ad.file);
    writeFileSync(dest, buf);
    written.push(dest);
    console.log(`${ad.file}  ${Math.round(buf.length / 1000)}kB`);
  }
  await browser.close();
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) await render();
