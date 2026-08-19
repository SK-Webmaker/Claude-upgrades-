#!/usr/bin/env node
/**
 * Renders Facebook ad creative. Deliberately not make-cards.mjs.
 *
 * An ad is not a post. The organic cards are text-dense on purpose — they are
 * built to be read, saved and forwarded by people who already follow her. An ad
 * is shown to strangers mid-scroll, and Meta's delivery penalises heavy text
 * overlay: the hard 20% rule is gone, but lighter creative still gets cheaper
 * delivery. So these layouts carry roughly a third of the words.
 *
 * 1080×1350 (4:5) — the tallest ratio Meta serves uncropped in feed, and the
 * one that occupies the most phone screen.
 *
 * Safe areas: the top ~14% and bottom ~20% can be overlaid by Meta's own UI
 * depending on placement, so nothing load-bearing goes there. That constraint
 * is doing double duty here — it forces the restraint the delivery algorithm
 * rewards anyway.
 *
 * Still typographic, still rendered by Chromium. No AI photographs of hair —
 * see CLAUDE.md invariant 2. Image models mangle real words, and an ad with a
 * malformed dollar figure is worse than no ad. It also means these read as
 * designed rather than generated, which is the whole brief.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = process.argv[2] || join(ROOT, 'content', 'ads');
const W = 1080;
const H = 1350;

const INK = '#12100E';
const GOLD = '#B07C33';
const VIOLET = '#6A5B8C';
const CREAM = '#F6F1E9';

const FONTS = readFileSync(join(ROOT, 'assets', 'fonts', 'brand-fonts.css'), 'utf8');

function chromiumPath() {
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'];
  return candidates.find((p) => p && existsSync(p)) || undefined;
}

function html({ kind, eyebrow, headline, support, stamp, footer }) {
  const shared = `
    ${FONTS}
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:${W}px;height:${H}px;overflow:hidden;font-family:'Inter',sans-serif;
         -webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
    /* Margins tuned for FEED, which is where these run. In feed the caption,
       headline and CTA button sit below the image rather than over it, so the
       full-blown Stories safe area (14% top / 20% bottom) just donates the
       best real estate on the card to empty space. These are generous enough
       to survive light cropping without hollowing out the composition. If a
       Stories or Reels placement is ever added, that needs its own 9:16
       render with the real safe area, not this one stretched. */
    .wrap{width:100%;height:100%;padding:150px 88px 160px;display:flex;
          flex-direction:column;position:relative;z-index:1}
    .eyebrow{font-size:22px;letter-spacing:.26em;text-transform:uppercase;font-weight:600}
    h1{font-family:'Fraunces',serif;font-weight:400;line-height:1.04;letter-spacing:-.022em;
       font-variation-settings:'opsz' 144}
    .grow{flex:1}
    .support{font-size:32px;line-height:1.5;font-weight:400}
    .stamp{display:inline-block;font-size:22px;letter-spacing:.18em;text-transform:uppercase;
           font-weight:600;padding:18px 30px;border-radius:3px}
    .foot{font-size:24px;letter-spacing:.02em;font-weight:500;
          display:flex;justify-content:space-between;align-items:baseline;gap:20px}
  `;

  if (kind === 'proof') {
    // Dark, price-led. The number is the whole ad; everything else supports it.
    return `<html><head><meta charset="utf-8"><style>${shared}
      body{background:${INK};color:${CREAM}}
      .eyebrow{color:${GOLD}}
      h1{font-size:86px;max-width:92%}
      .num{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;font-size:200px;
           font-weight:300;color:${GOLD};line-height:.9;letter-spacing:-.045em}
      .support{color:rgba(246,241,233,.72);max-width:84%}
      .stamp{color:${INK};background:${CREAM}}
      .foot{color:rgba(246,241,233,.5)}
      .glow{position:absolute;width:900px;height:900px;right:-340px;top:-260px;border-radius:50%;
            background:radial-gradient(circle,rgba(176,124,51,.30),transparent 68%);z-index:0}
    </style></head><body>
      <div class="glow"></div>
      <div class="wrap">
        <p class="eyebrow">${eyebrow}</p>
        <div style="height:44px"></div>
        <h1>${headline}</h1>
        <div style="height:40px"></div>
        <p class="num">${stamp}</p>
        <div style="height:44px"></div>
        <p class="support">${support}</p>
        <div class="grow"></div>
        <div class="foot"><span>${footer}</span><span>Camberwell</span></div>
      </div>
    </body></html>`;
  }

  // 'invite' — light, question-led, built for a phone call rather than a click.
  return `<html><head><meta charset="utf-8"><style>${shared}
    body{background:${CREAM};color:${INK}}
    .eyebrow{color:${GOLD}}
    h1{font-size:82px;max-width:94%}
    .answer{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;font-size:56px;
            line-height:1.16;letter-spacing:-.02em;color:${VIOLET};max-width:88%}
    .support{color:rgba(18,16,14,.66);max-width:82%}
    .stamp{color:${CREAM};background:${INK}}
    .foot{color:rgba(18,16,14,.46)}
    .glow{position:absolute;width:820px;height:820px;left:-330px;bottom:-300px;border-radius:50%;
          background:radial-gradient(circle,rgba(106,91,140,.20),transparent 68%);z-index:0}
  </style></head><body>
    <div class="glow"></div>
    <div class="wrap">
      <p class="eyebrow">${eyebrow}</p>
      <div style="height:44px"></div>
      <h1>${headline}</h1>
      <div style="height:38px"></div>
      <p class="answer">${support}</p>
      <div class="grow"></div>
      <p><span class="stamp">${stamp}</span></p>
      <div style="height:36px"></div>
      <div class="foot"><span>${footer}</span><span>Camberwell</span></div>
    </div>
  </body></html>`;
}

export const ADS = [
  {
    file: 'ad-01-price.png',
    kind: 'proof',
    eyebrow: 'Colour specialist · 20 years',
    headline: 'You’ll know the<br>price before you<br>sit down.',
    stamp: 'from $340',
    support: 'Lived-in blonde. Three and a half hours, quoted up front, nothing added at the counter.',
    footer: 'Thursday & Friday',
  },
  {
    file: 'ad-02-call.png',
    kind: 'invite',
    eyebrow: 'K18 certified · colour only',
    headline: 'Not sure what<br>your hair actually<br>needs?',
    support: 'Ring me and I’ll tell you straight — including when the answer is a $45 toner.',
    stamp: 'Thursday & Friday',
    footer: '0452 611 799',
  },
];

export async function render(outDir = OUT, ads = ADS) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const written = [];
  for (const ad of ads) {
    await page.setContent(html(ad), { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
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
