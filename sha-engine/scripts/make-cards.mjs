#!/usr/bin/env node
/**
 * Renders finished post images.
 *
 * These are typographic editorial cards, not AI photographs of hair. That is a
 * deliberate choice: an AI-generated "result" shown on a colourist's feed
 * misrepresents work she did not do, and Instagram auto-labels detected AI
 * imagery, which on a local service business costs more trust than the reach
 * is worth. Text-led cards are also what the education and price posts in this
 * niche actually look like when they perform.
 *
 * Typography is rendered by Chromium rather than generated, so the text is
 * exact. Image models reliably mangle real words, and a price card with a
 * malformed dollar figure is worse than no card.
 *
 * Fonts are inlined from assets/fonts/brand-fonts.css as base64 woff2. Chromium
 * cannot reach fonts.googleapis.com from inside the sandbox or from Render's
 * build network, and a silent fallback to Liberation Serif is the difference
 * between a card that looks designed and one that looks like a school handout.
 * Regenerate that file with scripts/fetch-fonts.mjs if the faces ever change.
 *
 * Palette is her own, from config/brand.json look{}.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = process.argv[2] || join(ROOT, 'data', 'cards');
const W = 1080;
const H = 1350; // 4:5 — the tallest ratio Instagram shows in-feed uncropped

const INK = '#12100E';
const GOLD = '#B07C33';
const VIOLET = '#6A5B8C';
const CREAM = '#F6F1E9';

const FONTS = readFileSync(join(ROOT, 'assets', 'fonts', 'brand-fonts.css'), 'utf8');

/**
 * The installed Chromium is revision 1194; playwright 1.62 looks for 1234 and
 * fails with a bare "Error" that names no path. Prefer the symlink the image
 * provides, fall back to whatever playwright resolves on a normal machine.
 */
function chromiumPath() {
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'];
  return candidates.find((p) => p && existsSync(p)) || undefined;
}

/** One card. `kind` picks the layout. */
function html({ kind, eyebrow, headline, sub, detail, footer }) {
  const shared = `
    ${FONTS}
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:${W}px;height:${H}px;overflow:hidden;font-family:'Inter',sans-serif;
         -webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
    .wrap{width:100%;height:100%;padding:88px 84px 76px;display:flex;flex-direction:column;
          position:relative;z-index:1}
    .eyebrow{font-size:21px;letter-spacing:.26em;text-transform:uppercase;font-weight:600}
    /* Two spacers with different weights, not one big one: a single flex:1
       parks the whole block against an edge and leaves a void that reads as a
       mistake rather than as air. */
    .grow{flex:1}
    .grow-sm{flex:.42}
    .foot{font-size:23px;letter-spacing:.03em;display:flex;justify-content:space-between;
          align-items:baseline;gap:24px;font-weight:500}
    .rule{height:1px;width:100%;margin:30px 0 0}
    h1{font-family:'Fraunces',serif;font-weight:400;line-height:1.03;letter-spacing:-.022em;
       font-variation-settings:'opsz' 144}
    .num{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144}
  `;

  if (kind === 'price') {
    return `<html><head><meta charset="utf-8"><style>${shared}
      body{background:${INK};color:${CREAM}}
      .eyebrow{color:${GOLD}}
      h1{font-size:98px}
      .num{font-size:236px;font-weight:300;color:${GOLD};line-height:.86;letter-spacing:-.045em}
      .sub{font-size:29px;line-height:1.52;color:rgba(246,241,233,.7);max-width:74%;font-weight:400}
      .rule{background:rgba(246,241,233,.2)}
      .foot{color:rgba(246,241,233,.5)}
      .glow{position:absolute;width:900px;height:900px;right:-300px;top:-260px;border-radius:50%;
            background:radial-gradient(circle,rgba(176,124,51,.34),transparent 66%);z-index:0}
      /* Price posts get scanned for what is included, not for the number. The
         breakdown is the part that answers the DM before it gets sent. */
      .incl{border-top:1px solid rgba(246,241,233,.2)}
      .row{display:flex;justify-content:space-between;align-items:baseline;gap:24px;
           padding:22px 0;border-bottom:1px solid rgba(246,241,233,.13);font-size:28px}
      .row span:last-child{color:${GOLD};font-size:23px;letter-spacing:.1em;
                           text-transform:uppercase;font-weight:600}
    </style></head><body>
      <div class="glow"></div>
      <div class="wrap">
        <p class="eyebrow">${eyebrow}</p>
        <div class="rule"></div>
        <div class="grow-sm"></div>
        <h1>${headline}</h1>
        <div style="height:26px"></div>
        <p class="num">${detail}</p>
        <div style="height:56px"></div>
        <div class="incl">
          <div class="row"><span>Foils, root to end</span><span>2 hr 30</span></div>
          <div class="row"><span>Toner to finish</span><span>45 min</span></div>
          <div class="row"><span>Blow wave</span><span>Included</span></div>
        </div>
        <div style="height:44px"></div>
        <p class="sub">${sub}</p>
        <div class="grow"></div>
        <div class="foot"><span>${footer}</span><span>@hairbysha_c</span></div>
      </div>
    </body></html>`;
  }

  if (kind === 'myth') {
    // Each line gets its own strike. One span across a two-line heading draws a
    // single rule positioned against the first fragment, which lands in the gap
    // between the lines and crosses out neither of them.
    const struck = headline
      .split('<br>')
      .map((line) => `<span class="strike">${line}</span>`)
      .join('<br>');
    return `<html><head><meta charset="utf-8"><style>${shared}
      body{background:${CREAM};color:${INK}}
      .eyebrow{color:${GOLD}}
      h1{font-size:92px}
      .strike{position:relative;display:inline}
      .strike::after{content:'';position:absolute;left:-8px;right:-8px;top:53%;height:7px;
                     background:${GOLD};transform:rotate(-1.2deg);border-radius:4px}
      .answer{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;font-size:60px;
              line-height:1.14;letter-spacing:-.02em;color:${VIOLET};max-width:88%}
      .sub{font-size:30px;line-height:1.55;color:rgba(18,16,14,.66);max-width:82%}
      .rule{background:rgba(18,16,14,.16)}
      .foot{color:rgba(18,16,14,.46)}
      .tag{display:inline-block;font-size:21px;letter-spacing:.2em;text-transform:uppercase;
           font-weight:600;color:${CREAM};background:${INK};padding:16px 28px;border-radius:3px}
      /* The correction on its own is a scold. The two rows turn it into
         something the reader can act on, which is what gets it saved. */
      .steps{margin-top:44px;border-top:1px solid rgba(18,16,14,.16)}
      .step{display:flex;gap:26px;padding:24px 0;border-bottom:1px solid rgba(18,16,14,.16);
            font-size:28px;line-height:1.4;color:rgba(18,16,14,.82)}
      .step b{font-weight:600;color:${GOLD};min-width:196px;font-size:20px;letter-spacing:.16em;
              text-transform:uppercase;padding-top:8px;white-space:nowrap}
    </style></head><body><div class="wrap">
      <p class="eyebrow">${eyebrow}</p>
      <div class="rule"></div>
      <div class="grow-sm"></div>
      <h1>${struck}</h1>
      <div style="height:46px"></div>
      <p class="answer">It tones the surface. It cannot lift the warmth underneath.</p>
      <div style="height:40px"></div>
      <p class="sub">${sub}</p>
      <div class="steps">
        <div class="step"><b>In the chair</b><span>A toner or gloss, about forty five minutes, every six to eight weeks.</span></div>
        <div class="step"><b>At home</b><span>Purple shampoo once a week to hold it. Not to fix it.</span></div>
      </div>
      <div class="grow"></div>
      <p><span class="tag">${detail}</span></p>
      <div style="height:44px"></div>
      <div class="foot"><span>${footer}</span><span>@hairbysha_c</span></div>
    </div></body></html>`;
  }

  // 'list' — aftercare / education, built to be saved
  const items = detail.split('|');
  return `<html><head><meta charset="utf-8"><style>${shared}
    body{background:${INK};color:${CREAM}}
    .eyebrow{color:${GOLD}}
    h1{font-size:84px}
    ol{list-style:none;counter-reset:i;margin-top:52px}
    li{counter-increment:i;display:flex;gap:30px;padding:28px 0;align-items:baseline;
       border-bottom:1px solid rgba(246,241,233,.13);font-size:30px;line-height:1.36;
       color:rgba(246,241,233,.9)}
    li:first-child{border-top:1px solid rgba(246,241,233,.13)}
    /* Inter, not Fraunces, for the numerals. At display optical size Fraunces'
       3 has a flat top that reads as a 5 at thumbnail size, and a numbered list
       whose third item looks like item five is worse than a plain one. */
    li::before{content:'0' counter(i);font-family:'Inter',sans-serif;font-size:25px;color:${GOLD};
               min-width:58px;font-weight:600;letter-spacing:.06em;
               font-variant-numeric:tabular-nums}
    /* A save prompt, not decoration: saves are weighted six times a like in the
       engine's own scoring, so the card asks for the action it is scored on. */
    .close{border-left:2px solid ${GOLD};padding-left:26px;font-size:27px;line-height:1.45;
           color:rgba(246,241,233,.74);max-width:76%}
    .rule{background:rgba(246,241,233,.2)}
    .foot{color:rgba(246,241,233,.5)}
    .glow{position:absolute;width:840px;height:840px;left:-320px;bottom:-320px;border-radius:50%;
          background:radial-gradient(circle,rgba(106,91,140,.36),transparent 66%);z-index:0}
  </style></head><body>
    <div class="glow"></div>
    <div class="wrap">
      <p class="eyebrow">${eyebrow}</p>
      <div class="rule"></div>
      <div style="height:60px"></div>
      <h1>${headline}</h1>
      <ol>${items.map((t) => `<li><span>${t.trim()}</span></li>`).join('')}</ol>
      <div class="grow"></div>
      <p class="close">${sub}</p>
      <div class="grow-sm"></div>
      <div class="foot"><span>${footer}</span><span>@hairbysha_c</span></div>
    </div>
  </body></html>`;
}

export const CARDS = [
  {
    file: 'w1-price.png',
    kind: 'price',
    eyebrow: 'What it actually costs',
    headline: 'A full head of<br>foils is',
    detail: '$320',
    sub: 'One booking, one price. Nothing added at the counter.',
    footer: 'Hair by Sha · Camberwell',
  },
  {
    file: 'w1-myth.png',
    kind: 'myth',
    eyebrow: 'Correcting a myth',
    headline: 'Purple shampoo<br>fixes brass',
    detail: 'Toner & Gloss · $45',
    sub: 'Brass sits under the surface, not on it. Lifting it takes a toner in the chair and about forty five minutes.',
    footer: 'Hair by Sha · Camberwell',
  },
  {
    file: 'w1-aftercare.png',
    kind: 'list',
    eyebrow: 'Make your colour last',
    headline: 'Four things<br>quietly costing<br>you weeks',
    detail:
      'Washing hotter than lukewarm | Shampooing more than twice a week | Straightening with no heat protectant | Eight weeks between toners',
    sub: 'Save this one. It is the four-week difference between a colour that holds and one that goes brassy.',
    footer: 'Hair by Sha · Camberwell',
  },
];

export async function render(outDir = OUT, cards = CARDS) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const written = [];
  for (const card of cards) {
    await page.setContent(html(card), { waitUntil: 'domcontentloaded' });
    // The faces are data URIs, so there is nothing to wait on the network for —
    // but they still have to be decoded before the shot or the first card
    // renders in a fallback and looks nothing like the other two.
    await page.evaluate(() => document.fonts.ready);
    const buf = await page.screenshot({ type: 'png' });
    const path = join(outDir, card.file);
    writeFileSync(path, buf);
    written.push({ file: card.file, path, bytes: buf.length });
  }
  await browser.close();
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = await render();
  for (const w of out) console.log(`${w.file}  ${(w.bytes / 1024).toFixed(0)}kB`);
}
