#!/usr/bin/env node
/**
 * Week 7 — the 48-hour rule.
 *
 * ---------------------------------------------------------------------------
 * What the numbers said
 *
 * Read live 15 Sep 2026: 186 followers (+7, the best week the account has had),
 * 58 posts, average engagement 5.42%.
 *
 * The design question is settled. Her own photography with the studio palette,
 * posted as video, runs 2.7-4x the ticket cards:
 *
 *   w5-r1-brassy   (photo, studio palette)   4.30%
 *   w5-c1-services (photo, studio palette)   4.30%
 *   w5-r2-wednesday(photo, studio palette)   3.76%
 *   w4-toner       (ticket card)             1.08%
 *   w4-what-fits   (ticket card)             1.61%
 *
 * But the two best posts on the account are HERS, not the system's:
 *   7.53%  "Event season is creeping up"   14 likes
 *   6.45%  "the blow dry that actually lasts"  12 likes
 *
 * Both are short, warm, one emoji, and aspirational. The system has been
 * writing expert paragraphs; she writes a line. Captions this week are cut to
 * roughly a third of their usual length because of that.
 *
 * ---------------------------------------------------------------------------
 * The idea
 *
 * Spring Racing Carnival runs 29 Aug to 29 Nov and Caulfield is four kilometres
 * from her chair. Underwood Stakes, Caulfield Cup on 17 Oct, Cox Plate on
 * 24 Oct, Melbourne Cup on 3 Nov — all Saturdays, all local, all needing hair.
 *
 * Colour needs about 48 hours to settle: the cuticle closes, the toner locks,
 * and the first wash stops stripping it. So a Saturday event means colour on
 * WEDNESDAY OR THURSDAY, not Friday.
 *
 * That single true fact is the whole campaign. It fills the two days that need
 * filling, with the high-value colour work rather than a blow wave, using a
 * reason that is genuinely in the client's interest — and it needs no discount,
 * so invariant 7 holds without effort.
 *
 *   Wednesday / Thursday  →  colour settles
 *   Saturday              →  blow wave, 45 minutes, morning of
 *   Sunday                →  the four-hour colour with no rush
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'content', 'cards');
const PHOTOS = join(ROOT, 'content', 'photos', 'blog');

/* studio palette, unchanged — it is the one that is working */
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

const P = {
  waves:    { f: 'blog-03-IMG_8353.jpg', focus: '50% 30%', zoom: 118 },
  ashy:     { f: 'blog-02-IMG_0432.jpg', focus: '48% 32%', zoom: 116 },
  copper:   { f: 'blog-04-IMG_0433.jpg', focus: '50% 30%', zoom: 116 },
  straight: { f: 'blog-01-IMG_0435.jpg', focus: '50% 30%', zoom: 116 },
};

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

/* ---------- the 48-hour rule: a three-step timeline ---------- */
function ruleHtml(c) {
  const W = 1080, H = 1350;
  const steps = c.steps
    .map(
      (s, i) => `<div class="step${s.hi ? ' hi' : ''}">
        <span class="when num">${esc(s.when)}</span>
        <span class="bar"></span>
        <span class="what">${esc(s.what)}</span>
      </div>`,
    )
    .join('');
  return `<html><head><meta charset="utf-8"><style>${base(W, H, FIG)}
    h1{font-size:104px;color:${CREAM};max-width:13ch}
    .sub{font-size:30px;line-height:1.42;color:rgba(246,241,233,.8);margin-top:26px;max-width:26ch;font-weight:500}
    .steps{margin-top:auto;display:flex;flex-direction:column;gap:0}
    .step{display:flex;align-items:center;gap:26px;padding:28px 0;
          border-bottom:2px solid rgba(246,241,233,.18)}
    .step:last-child{border-bottom:0}
    .when{font-size:38px;color:${CLAY};white-space:nowrap;min-width:5.6ch}
    .bar{flex:0 0 58px;height:4px;background:rgba(246,241,233,.3)}
    .what{font-size:33px;color:${CREAM};font-weight:600;line-height:1.28}
    .step.hi .when,.step.hi .what{color:${GOLD}}
    .step.hi .bar{background:${GOLD}}
    .foot{border-top:4px solid rgba(246,241,233,.45);color:${CREAM};opacity:.85}
  </style></head><body>
    ${disc(CLAY, 560, 700, -160, 0.88)}
    <div class="wrap">
      <div class="top"><span class="rule" style="background:${CLAY}"></span>
        <span class="eyebrow" style="color:${CLAY}">${esc(c.eyebrow)}</span></div>
      <h1 class="fr" style="margin-top:64px">${c.title}</h1>
      <p class="sub">${esc(c.sub)}</p>
      <div class="steps">${steps}</div>
      <div class="foot"><span>Hair by Sha</span><span>Camberwell</span></div>
    </div>
    <div class="grain"></div>
  </body></html>`;
}

/* ---------- aspiration / statement on a flat field ---------- */
function heroHtml(c) {
  const W = 1080, H = 1350;
  return `<html><head><meta charset="utf-8"><style>${base(W, H, c.bg)}
    h1{font-size:${c.size || 118}px;color:${c.fg};max-width:13ch}
    .sup{font-size:33px;line-height:1.42;color:${c.supColor};margin-top:34px;max-width:24ch;font-weight:500}
    .cta{align-self:flex-start;background:${c.ctaBg};color:${c.ctaFg};font-size:25px;font-weight:800;
         letter-spacing:.14em;text-transform:uppercase;padding:24px 32px;margin-top:34px}
    .foot{border-top:4px solid ${c.fg};color:${c.fg};opacity:.85}
  </style></head><body>
    ${c.shapes || ''}
    <div class="wrap">
      <div class="top"><span class="rule" style="background:${c.accent}"></span>
        <span class="eyebrow" style="color:${c.accent}">${esc(c.eyebrow)}</span></div>
      <div class="grow"></div>
      <h1 class="fr">${c.title}</h1>
      ${c.support ? `<p class="sup">${esc(c.support)}</p>` : ''}
      ${c.cta ? `<span class="cta">${esc(c.cta)}</span>` : ''}
      <div class="grow"></div>
      <div class="foot"><span>Hair by Sha</span><span>Camberwell</span></div>
    </div>
    <div class="grain"></div>
  </body></html>`;
}

/* ---------- photograph + statement ---------- */
function photoHtml(c) {
  const W = 1080, H = 1350;
  const p = P[c.photo];
  return `<html><head><meta charset="utf-8"><style>${base(W, H, INK)}
    .photo{position:absolute;inset:0;background-image:url('${p.f}');background-size:${p.zoom}% auto;
           background-position:${p.focus};background-repeat:no-repeat}
    .tint{position:absolute;inset:0;background:rgba(47,64,50,.14);mix-blend-mode:multiply}
    .scrim{position:absolute;inset:0;background:linear-gradient(180deg,
      rgba(18,16,14,.34) 0%, rgba(18,16,14,.02) 22%, rgba(18,16,14,.10) 44%,
      rgba(18,16,14,.82) 74%, rgba(18,16,14,.97) 100%)}
    h1{font-size:${c.size || 96}px;color:${CREAM};max-width:14ch;text-shadow:0 2px 40px rgba(0,0,0,.5)}
    .sup{font-size:31px;line-height:1.42;color:rgba(246,241,233,.9);margin-top:28px;max-width:24ch;font-weight:500}
    .cta{align-self:flex-start;background:${GOLD};color:${INK};font-size:25px;font-weight:800;
         letter-spacing:.13em;text-transform:uppercase;padding:22px 30px;margin-top:30px}
    .wrap{justify-content:flex-end}
  </style></head><body>
    <div class="photo"></div><div class="tint"></div><div class="scrim"></div>
    <div class="wrap">
      <div class="top" style="position:absolute;left:70px;top:76px">
        <span class="rule" style="background:${GOLD}"></span>
        <span class="eyebrow" style="color:${GOLD}">${esc(c.eyebrow)}</span></div>
      <h1 class="fr">${c.title}</h1>
      ${c.support ? `<p class="sup">${esc(c.support)}</p>` : ''}
      ${c.cta ? `<span class="cta">${esc(c.cta)}</span>` : ''}
    </div>
  </body></html>`;
}

/* ---------- carousel slide ---------- */
function slideHtml(s) {
  const W = 1080, H = 1350;
  const dark = s.tone !== 'light';
  const bg = dark ? INK : CLAY;
  const fg = dark ? CREAM : INK;
  const acc = dark ? GOLD : FIG;
  return `<html><head><meta charset="utf-8"><style>${base(W, H, bg)}
    .kick{font-size:24px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:${acc}}
    h1{font-size:${s.size || 92}px;color:${fg};margin-top:22px;max-width:13ch}
    .sup{font-size:32px;line-height:1.44;color:${dark ? 'rgba(246,241,233,.78)' : 'rgba(18,16,14,.76)'};
         margin-top:30px;max-width:25ch;font-weight:500}
    .wrap{justify-content:center}
    .foot{position:absolute;left:70px;right:70px;bottom:60px;display:flex;justify-content:space-between;
          border-top:3px solid ${dark ? 'rgba(246,241,233,.26)' : 'rgba(18,16,14,.3)'};
          color:${fg};opacity:.6;font-size:19px;font-weight:700;padding-top:22px;
          letter-spacing:.14em;text-transform:uppercase}
  </style></head><body>
    ${dark ? disc(FIG, 780, -260, 880, 0.5) : disc(FIG, 620, 720, 900, 0.16)}
    <div class="wrap">
      <p class="kick">${esc(s.kick)}</p>
      <h1 class="fr">${s.title}</h1>
      <p class="sup">${esc(s.support)}</p>
    </div>
    <div class="foot"><span>Hair by Sha · Camberwell</span><span>${esc(s.pos)}</span></div>
    <div class="grain"></div>
  </body></html>`;
}

/* ======================= the week ======================= */

const CARDS = [
  {
    file: 'w7-p1-48hour.png', layout: 'rule', eyebrow: 'Race week',
    title: 'Colour needs 48 hours.', size: 104,
    sub: 'It is not ready the day you get it done. The cuticle is still closing and the toner is still settling.',
    steps: [
      { when: 'Wed', what: 'Colour. The quiet chair, no clock.', hi: true },
      { when: 'Thu', what: 'It settles. Do not wash it.', hi: true },
      { when: 'Sat', what: 'Blow wave, 45 minutes, then go.' },
    ],
  },
  {
    file: 'w7-p2-racing.png', layout: 'photo', photo: 'waves', eyebrow: 'Spring racing',
    title: 'Caulfield is four kilometres away.', size: 88,
    support: 'Race season runs to November. Every one of those days is a Saturday.',
    cta: 'DM me your race day',
  },
  {
    file: 'w7-p3-wednesday.png', layout: 'hero', bg: FIG, fg: CREAM, accent: CLAY,
    supColor: 'rgba(246,241,233,.8)', ctaBg: CLAY, ctaFg: INK,
    eyebrow: 'Midweek', size: 116,
    title: 'Wednesday is the new Friday.',
    support: 'If it is for Saturday, Friday is too late. Book it midweek and let it settle.',
    cta: 'DM me for Wed or Thu',
    shapes: disc(CLAY, 580, 690, -170, 0.9) + disc(GOLD, 420, -140, 1080, 0.22),
  },
  {
    file: 'w7-p4-saturday.png', layout: 'photo', photo: 'ashy', eyebrow: 'Saturday mornings',
    title: 'Forty five minutes, and the day is handled.', size: 82,
    support: 'A blow wave is the only thing that fits on the morning of. Book it early.',
    cta: 'DM me a Saturday time',
  },
  {
    file: 'w7-p5-sunday.png', layout: 'hero', bg: INK, fg: CREAM, accent: GOLD,
    supColor: 'rgba(246,241,233,.78)', ctaBg: GOLD, ctaFg: INK,
    eyebrow: 'Sunday · 10 til 2', size: 112,
    title: 'Four hours, and nobody waiting.',
    support: 'One chair, one colour, no rush. The week ahead sorted before it starts.',
    cta: 'DM me the word Sunday',
    shapes: disc(FIG, 700, 620, -220, 0.85) + disc(CLAY, 420, -130, 1090, 0.25),
  },
  {
    file: 'w7-p6-aspiration.png', layout: 'hero', bg: CLAY, fg: INK, accent: FIG,
    supColor: 'rgba(18,16,14,.72)', ctaBg: FIG, ctaFg: CREAM,
    eyebrow: 'Before the season', size: 106,
    title: 'Get it right once, then coast to Christmas.',
    support: 'One proper colour in September carries you through the whole run of events.',
    cta: 'DM me to plan it',
    shapes: disc(FIG, 600, 660, -180, 0.9),
  },
];

const CAROUSEL = [
  { file: 'w7-c1-1.png', tone: 'light', kick: 'Race week · Swipe', size: 88,
    title: 'Why Friday is the wrong day.',
    support: 'Four things nobody tells you about colour before an event.', pos: '1 / 5' },
  { file: 'w7-c1-2.png', kick: 'One', size: 86,
    title: 'Colour is still moving for 48 hours.',
    support: 'The cuticle closes slowly and the toner keeps settling. Friday colour on a Saturday head has not finished yet.', pos: '2 / 5' },
  { file: 'w7-c1-3.png', kick: 'Two', size: 92,
    title: 'Do not wash it in between.',
    support: 'That first wash is what strips a fresh toner. Two days dry is the whole trick, and it costs nothing.', pos: '3 / 5' },
  { file: 'w7-c1-4.png', kick: 'Three', size: 82,
    title: 'Book the blow wave separately.',
    support: 'Forty five minutes on the morning of, on hair that has already settled. That is what photographs well.', pos: '4 / 5' },
  { file: 'w7-c1-5.png', tone: 'light', kick: 'Four', size: 84,
    title: 'Midweek is the calmest chair I have.',
    support: 'Wednesday and Thursday, no queue, no clock. It is the better appointment and it happens to be the right timing.', pos: '5 / 5' },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromiumPath() });
const scratch = join(PHOTOS, '.w7-render.html');

async function shoot(html, file, usesPhoto) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  if (usesPhoto) {
    // setContent() runs on an opaque origin and Chromium blocks file://
    // subresources from it — the photo renders as a black rectangle.
    writeFileSync(scratch, html);
    await page.goto(`file://${scratch}`, { waitUntil: 'load' });
  } else {
    await page.setContent(html, { waitUntil: 'load' });
  }
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(join(OUT, file), await page.screenshot({ type: 'png' }));
  console.log('  ' + file);
  await page.close();
}

console.log('Singles');
for (const c of CARDS) {
  const html = c.layout === 'rule' ? ruleHtml(c) : c.layout === 'photo' ? photoHtml(c) : heroHtml(c);
  await shoot(html, c.file, c.layout === 'photo');
}
console.log('Carousel — race week');
for (const s of CAROUSEL) await shoot(slideHtml(s), s.file, false);

await browser.close();
console.log(`\nDone — ${CARDS.length} singles, ${CAROUSEL.length} carousel slides.`);
