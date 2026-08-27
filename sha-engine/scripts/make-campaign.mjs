#!/usr/bin/env node
/**
 * SUNDAYS — the campaign. Second design, and a complete rebuild.
 *
 * ---------------------------------------------------------------------------
 * Why the first attempt was thrown away
 *
 * Nine assets, and every one was the same object: a dark photograph of hair,
 * a gradient scrim, and Fraunces in the bottom-left corner. Tasteful, and
 * invisible. At the size a post is actually seen — a thumbnail on a phone,
 * mid-scroll, next to a hundred other salon before-and-afters — muted brown
 * gradients read as nothing at all. Restraint is not the same as design.
 *
 * This system inverts every decision:
 *
 *   was                          now
 *   ---                          ---
 *   dark, low contrast           bright flat colour fields
 *   photo as wallpaper           photo as a jewel, or absent entirely
 *   type in a corner             type at 200–420px, bleeding off the frame
 *   one composition, nine times  five distinct layouts
 *   gold as a hairline accent    gold as a full-bleed ground
 *
 * The motif is the obvious one nobody used: **Sunday is the sun day.** A disc,
 * a warm ground, and the word SUN pulled out of SUNDAYS in a second colour. It
 * is bright, it is legible at 100px wide, and it means something.
 *
 * Palette is the brand's, opened up. `#B07C33` is a hairline gold — correct for
 * a rule, muddy across 1080px — so SUN is that hue lifted into a marigold that
 * survives a full-bleed field. Ink, cream and violet are unchanged.
 *
 * Invariant 2 is untouched: the photographs are Sha's own real client work. It
 * bans AI photographs of hair, not photographs — and a campaign about *time*
 * does not need a picture of hair on every asset to be about hair.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = process.argv[2] || join(ROOT, 'content', 'campaign');
const PHOTOS = join(ROOT, 'content', 'photos');

const INK = '#12100E';
const CREAM = '#F6F1E9';
const VIOLET = '#5B4B7D';
const SUN = '#E8A33D';   // the brand gold, lifted so it survives a full field
const GOLD = '#B07C33';  // original — rules and hairlines only

const FONTS = readFileSync(join(ROOT, 'assets', 'fonts', 'brand-fonts.css'), 'utf8');

/** Paper grain. Keeps a flat colour field from looking like a screenshot. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

function chromiumPath() {
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'];
  return candidates.find((p) => p && existsSync(p)) || undefined;
}

function base(W, H) {
  return `
    ${FONTS}
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:${W}px;height:${H}px;overflow:hidden;position:relative;
         font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;
         text-rendering:geometricPrecision}
    .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.10;
           mix-blend-mode:multiply;pointer-events:none;z-index:9}
    .disc{position:absolute;border-radius:50%}
    h1{font-family:'Fraunces',serif;font-weight:400;line-height:.84;
       letter-spacing:-.045em;font-variation-settings:'opsz' 144}
    .kicker{font-size:23px;letter-spacing:.34em;text-transform:uppercase;font-weight:700}
    .lede{font-size:31px;line-height:1.42;font-weight:400}
    .foot{position:absolute;left:0;right:0;bottom:0;display:flex;
          justify-content:space-between;align-items:center;padding:34px 72px;
          font-size:22px;font-weight:700;letter-spacing:.02em;z-index:6}
  `;
}

function html(card) {
  const W = 1080;
  const H = card.story ? 1920 : 1350;
  const S = base(W, H);

  /* ================= sunburst — the announcement ================= */
  if (card.kind === 'sunburst') {
    // Stacked, not one line. SUNDAYS on a single line overruns 1080px at any
    // size worth using and the final S was clipping — and stacking is the
    // better idea anyway, because it puts SUN on its own line where the whole
    // conceit is visible at a glance.
    const big = card.story ? 316 : 292;
    return `<html><head><meta charset="utf-8"><style>${S}
      body{background:${SUN}}
      /* An off-centre disc, bled off the top-right. The word sits over it, so
         the two read as one object rather than a shape with text near it. */
      .disc{width:${card.story ? 1180 : 980}px;height:${card.story ? 1180 : 980}px;
            background:${CREAM};right:-230px;top:${card.story ? 190 : 60}px;opacity:.96}
      .ring{position:absolute;border:3px solid ${INK};border-radius:50%;
            width:${card.story ? 1280 : 1080}px;height:${card.story ? 1280 : 1080}px;
            right:-280px;top:${card.story ? 140 : 10}px;opacity:.16}
      .wrap{position:absolute;inset:0;padding:${card.story ? '240px 72px 470px' : '84px 72px 120px'};
            display:flex;flex-direction:column;z-index:5}
      .grow{flex:1}
      h1{font-size:${big}px;color:${INK}}
      h1 .cut{color:${CREAM};-webkit-text-stroke:3px ${INK}}
      .rulebar{height:10px;background:${INK};width:210px;margin-bottom:32px}
      .lede{color:${INK};max-width:20ch;margin-top:34px;font-weight:500}
      .hours{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;
             font-size:78px;color:${VIOLET};margin-top:20px;letter-spacing:-.02em}
      .foot{color:${INK};border-top:3px solid ${INK};margin:0 72px;left:0;right:0;
            width:calc(100% - 144px);padding-left:0;padding-right:0}
    </style></head><body>
      <div class="ring"></div><div class="disc"></div>
      <div class="wrap">
        <div class="rulebar"></div>
        <p class="kicker" style="color:${INK}">${card.kicker}</p>
        <div class="grow"></div>
        <h1><span class="cut">SUN</span><br>DAYS</h1>
        <p class="hours">${card.hours}</p>
        <p class="lede">${card.lede}</p>
        <div class="grow"></div>
      </div>
      <div class="foot"><span>${card.footL}</span><span>${card.footR}</span></div>
      <div class="grain"></div>
    </body></html>`;
  }

  /* ================= hours — 10–2 at colossal scale ================= */
  if (card.kind === 'hours') {
    return `<html><head><meta charset="utf-8"><style>${S}
      body{background:${VIOLET}}
      .disc{width:760px;height:760px;background:${SUN};left:-260px;bottom:-250px;opacity:.92}
      .wrap{position:absolute;inset:0;padding:${card.story ? '240px 72px 470px' : '84px 72px 130px'};
            display:flex;flex-direction:column;z-index:5}
      .grow{flex:1}
      h1{font-size:${card.story ? 340 : 372}px;color:${CREAM};letter-spacing:-.06em;line-height:.8}
      .kicker{color:${SUN}}
      .lede{color:rgba(246,241,233,.9);max-width:19ch;margin-top:38px;font-weight:500}
      .rulebar{height:10px;background:${SUN};width:210px;margin-bottom:32px}
      .foot{color:${CREAM};border-top:3px solid rgba(246,241,233,.35);margin:0 72px;
            width:calc(100% - 144px);padding-left:0;padding-right:0}
    </style></head><body>
      <div class="disc"></div>
      <div class="wrap">
        <div class="rulebar"></div>
        <p class="kicker">${card.kicker}</p>
        <div class="grow"></div>
        <h1>${card.big}</h1>
        <p class="lede">${card.lede}</p>
        <div class="grow"></div>
      </div>
      <div class="foot"><span>${card.footL}</span><span>${card.footR}</span></div>
      <div class="grain"></div>
    </body></html>`;
  }

  /* ================= bignum — a date, enormous, with a photo jewel ========= */
  if (card.kind === 'bignum') {
    const dark = card.tone === 'violet';
    const bg = dark ? VIOLET : SUN;
    const fg = dark ? CREAM : INK;
    const acc = dark ? SUN : VIOLET;
    return `<html><head><meta charset="utf-8"><style>${S}
      body{background:${bg}}
      /* The photograph appears once, small, inside a disc — a jewel rather than
         a backdrop. It has to earn its place at this size, so it is cropped to
         nothing but colour and movement. */
      /* Fully inside the frame. Half a disc hanging off the edge reads as a
         crop accident rather than a decision. */
      .photo{position:absolute;width:${card.story ? 430 : 384}px;height:${card.story ? 430 : 384}px;
             border-radius:50%;right:66px;top:${card.story ? 330 : 150}px;overflow:hidden;
             border:7px solid ${fg};z-index:4}
      .photo i{position:absolute;inset:0;display:block;background-image:url('${card.photo}');
               background-size:${card.zoom}% auto;background-position:${card.focus};
               filter:saturate(1.2) contrast(1.08)}
      .wrap{position:absolute;inset:0;padding:${card.story ? '240px 72px 470px' : '84px 72px 130px'};
            display:flex;flex-direction:column;z-index:5}
      .grow{flex:1}
      .tag{display:inline-block;background:${fg};color:${bg};font-size:23px;font-weight:800;
           letter-spacing:.3em;text-transform:uppercase;padding:16px 26px;align-self:flex-start}
      h1{font-size:${card.story ? 400 : 380}px;color:${fg};line-height:.78;letter-spacing:-.06em}
      .month{font-size:56px;letter-spacing:.24em;text-transform:uppercase;font-weight:800;
             color:${acc};margin-top:20px}
      .lede{color:${dark ? 'rgba(246,241,233,.9)' : 'rgba(18,16,14,.82)'};
            max-width:24ch;margin-top:30px;font-weight:500}
      .foot{color:${fg};border-top:3px solid ${fg};margin:0 72px;opacity:.9;
            width:calc(100% - 144px);padding-left:0;padding-right:0}
    </style></head><body>
      <div class="photo"><i></i></div>
      <div class="wrap">
        <span class="tag">${card.tag}</span>
        <div class="grow"></div>
        <h1>${card.big}</h1>
        <p class="month">${card.month}</p>
        <p class="lede">${card.lede}</p>
        <div class="grow"></div>
      </div>
      <div class="foot"><span>${card.footL}</span><span>${card.footR}</span></div>
      <div class="grain"></div>
    </body></html>`;
  }

  /* ================= ledger — the four hours, cream and loud ============== */
  if (card.kind === 'ledger') {
    const rows = card.items
      .map((i) => `<div class="row"><span>${i.label}</span><span class="t">${i.value}</span></div>`)
      .join('');
    return `<html><head><meta charset="utf-8"><style>${S}
      body{background:${CREAM}}
      .disc{width:640px;height:640px;background:${SUN};right:-210px;top:-190px;opacity:.9}
      .wrap{position:absolute;inset:0;padding:84px 72px 128px;display:flex;
            flex-direction:column;z-index:5}
      .rulebar{height:10px;background:${INK};width:210px;margin-bottom:30px}
      .kicker{color:${INK}}
      /* line-height 1, not .78 — at 300px a tight leading pushes the glyph out
         of its box and it collides with the word beneath it. */
      .num{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;font-size:300px;
           line-height:1;color:${VIOLET};letter-spacing:-.06em;margin-top:6px}
      .numlabel{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;font-size:132px;
                line-height:.9;color:${INK};letter-spacing:-.04em;margin-top:-18px}
      .rows{margin-top:44px;border-top:3px solid ${INK}}
      .row{display:flex;justify-content:space-between;align-items:baseline;padding:20px 0;
           border-bottom:1px solid rgba(18,16,14,.22);font-size:29px;color:${INK};font-weight:500}
      .t{color:${VIOLET};font-weight:800;font-size:24px;letter-spacing:.1em;text-transform:uppercase}
      .grow{flex:1}
      .close{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;font-size:52px;
             line-height:1.1;color:${INK};max-width:20ch;margin-top:34px}
      .foot{color:${INK};border-top:3px solid ${INK};margin:0 72px;
            width:calc(100% - 144px);padding-left:0;padding-right:0}
    </style></head><body>
      <div class="disc"></div>
      <div class="wrap">
        <div class="rulebar"></div>
        <p class="kicker">${card.kicker}</p>
        <p class="num">${card.big}</p>
        <p class="numlabel">${card.bigLabel}</p>
        <div class="rows">${rows}</div>
        <div class="grow"></div>
        <p class="close">${card.close}</p>
      </div>
      <div class="foot"><span>${card.footL}</span><span>${card.footR}</span></div>
      <div class="grain"></div>
    </body></html>`;
  }

  /* ================= listbold — what fits ================= */
  const items = card.items.map((t) => `<li><span>${t}</span></li>`).join('');
  return `<html><head><meta charset="utf-8"><style>${S}
    body{background:${INK}}
    .disc{width:700px;height:700px;background:${VIOLET};left:-250px;bottom:-260px;opacity:.85}
    .wrap{position:absolute;inset:0;padding:84px 72px 128px;display:flex;
          flex-direction:column;z-index:5}
    .rulebar{height:10px;background:${SUN};width:210px;margin-bottom:30px}
    .kicker{color:${SUN}}
    h1{font-size:104px;color:${CREAM};margin-top:20px;max-width:12ch;line-height:.92}
    ol{list-style:none;counter-reset:i;margin-top:44px}
    li{counter-increment:i;display:flex;gap:26px;padding:19px 0;align-items:baseline;
       border-bottom:1px solid rgba(246,241,233,.2);font-size:28px;line-height:1.32;
       color:rgba(246,241,233,.94);font-weight:500}
    li:first-child{border-top:3px solid ${SUN}}
    li::before{content:'0' counter(i);font-family:'Inter',sans-serif;font-size:24px;color:${SUN};
               min-width:56px;font-weight:800;font-variant-numeric:tabular-nums}
    .grow{flex:1}
    .close{font-size:27px;line-height:1.45;color:${SUN};max-width:80%;margin-top:30px;font-weight:600}
    .foot{color:${CREAM};border-top:3px solid rgba(246,241,233,.3);margin:0 72px;
          width:calc(100% - 144px);padding-left:0;padding-right:0}
  </style></head><body>
    <div class="disc"></div>
    <div class="wrap">
      <div class="rulebar"></div>
      <p class="kicker">${card.kicker}</p>
      <h1>${card.headline}</h1>
      <ol>${items}</ol>
      <div class="grow"></div>
      <p class="close">${card.close}</p>
    </div>
    <div class="foot"><span>${card.footL}</span><span>${card.footR}</span></div>
    <div class="grain"></div>
  </body></html>`;
}

export const CAMPAIGN = [
  {
    file: 'sun-01-reveal.png',
    kind: 'sunburst',
    kicker: 'Hair by Sha · Camberwell',
    hours: '10 til 2. Every week.',
    lede: 'The chair is open on a Sunday now. It was not before.',
    footL: 'Book at the link in bio',
    footR: 'From 30 August',
  },
  {
    file: 'sun-02-hours.png',
    kind: 'hours',
    kicker: 'The whole window',
    big: '10–2',
    lede: 'Four hours. Which is the only four in your week that nobody else has a claim on.',
    footL: 'Sundays · Hair by Sha',
    footR: 'Camberwell',
  },
  {
    file: 'sun-03-ledger.png',
    kind: 'ledger',
    kicker: 'What a Sunday holds',
    big: '4',
    bigLabel: 'HOURS',
    items: [
      { label: 'Blonde transformation + K18', value: '4 hrs' },
      { label: 'Lived-in balayage', value: '3 hr 30' },
      { label: 'Half foil and a toner', value: '2 hr 30' },
      { label: 'Or five blow waves', value: '45 min ea' },
    ],
    close: 'So most Sundays hold one person. Occasionally two. Never more.',
    footL: 'Sundays 10–2',
    footR: 'Hair by Sha',
  },
  {
    file: 'sun-04-this-sunday.png',
    kind: 'bignum',
    tone: 'sun',
    photo: 'site/site-11-IMG_0767.jpg',
    focus: '74% 34%',
    zoom: 210,
    tag: 'This Sunday',
    big: '30',
    month: 'August',
    lede: 'Four hours, one chair. If you have been putting off something big, this is the Sunday with nothing in front of it.',
    footL: '10am – 2pm',
    footR: 'Book at the link in bio',
  },
  {
    file: 'sun-05-next-sunday.png',
    kind: 'bignum',
    tone: 'violet',
    photo: 'site/site-15-hero-brunette.jpg',
    focus: '50% 40%',
    zoom: 190,
    tag: 'Sunday after',
    big: '06',
    month: 'September',
    lede: 'Same four hours. Same one chair. Book it now and it is off your list before spring properly starts.',
    footL: '10am – 2pm',
    footR: 'Book at the link in bio',
  },
  {
    file: 'sun-06-fits.png',
    kind: 'listbold',
    kicker: 'Pick one, it is yours for the morning',
    headline: 'What fits in a Sunday.',
    items: [
      'Blonde transformation with K18 — the full four hours',
      'Lived-in balayage, toner and blow wave — three and a half',
      'Half foil, toner and treatment — two and a half',
      'Root colour and refresh — an hour and three quarters',
      'A blow wave, to simply feel finished — forty five minutes',
    ],
    close: 'Times, not prices. What a Sunday costs you is the four hours, and there are only four.',
    footL: 'Sundays 10–2',
    footR: 'Hair by Sha',
  },
  /* ---------------- stories ---------------- */
  {
    file: 'sun-s1-story-reveal.png',
    kind: 'sunburst',
    story: true,
    kicker: 'Hair by Sha · Camberwell',
    hours: '10 til 2. Every week.',
    lede: 'The chair is open on a Sunday now. Tap the link.',
    footL: 'From 30 August',
    footR: 'Camberwell',
  },
  {
    file: 'sun-s2-story-onechair.png',
    kind: 'bignum',
    story: true,
    tone: 'sun',
    photo: 'site/site-11-IMG_0767.jpg',
    focus: '74% 34%',
    zoom: 210,
    tag: 'One chair',
    big: '30',
    month: 'August',
    lede: 'Four hours holds one big colour. That is the whole day. Countdown sticker on this one.',
    footL: '10am – 2pm',
    footR: 'Tap to book',
  },
  {
    file: 'sun-s3-story-ask.png',
    kind: 'hours',
    story: true,
    kicker: 'Put the poll on this one',
    big: '10–2',
    lede: 'Would you come on a Sunday? Answer every yes with a booking link.',
    footL: 'Sundays',
    footR: 'Hair by Sha',
  },
];

export async function render(outDir = OUT, cards = CAMPAIGN) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const scratch = join(PHOTOS, '.render.html');
  for (const card of cards) {
    const H = card.story ? 1920 : 1350;
    const page = await browser.newPage({ viewport: { width: 1080, height: H }, deviceScaleFactor: 1 });
    writeFileSync(scratch, html(card));
    await page.goto(`file://${scratch}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    if (card.photo) {
      await page.evaluate(
        (src) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = src; }),
        card.photo,
      );
    }
    const buf = await page.screenshot({ type: 'png' });
    writeFileSync(join(outDir, card.file), buf);
    console.log(`${card.file}  ${Math.round(buf.length / 1000)}kB`);
    await page.close();
  }
  await browser.close();
}

if (import.meta.url === `file://${process.argv[1]}`) await render();
