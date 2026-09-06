#!/usr/bin/env node
/**
 * Week 5 — photography-led, video-first.
 *
 * ---------------------------------------------------------------------------
 * Why this looks nothing like week 4.
 *
 * Four weeks of published numbers now say the same thing, and the last week
 * settled it:
 *
 *   typographic card, posted as a still   0.56%  1.12%  1.68%   (F, F, D)
 *   photography,      posted as a REEL    4.42%  3.31%          (C, C)
 *   account average (mostly video)        6.19%
 *
 * Three different visual systems have now been tested as flat stills — the ink
 * cards, the ticket stock — and all three failed in the same way. The design was
 * not the variable. The medium was. So week 5 stops making cards that happen to
 * be posted, and starts making frames that belong to a video.
 *
 * ---------------------------------------------------------------------------
 * What that means technically.
 *
 * REELS render at 1080x1920, full-bleed. No letterbox, no coloured panel, no
 * dead margin — the photograph runs edge to edge and the type sits in it. The
 * text block is composed between y=980 and y=1500 because Instagram's own UI
 * eats roughly the bottom 350px (caption, audio, buttons) and the right ~180px
 * (like/comment/share rail). Type outside that band is type nobody reads.
 *
 * CAROUSELS render at 1080x1350. A carousel earns its slot because each swipe
 * is a fresh engagement on the same post, which is the cheapest reach available
 * on an account this size.
 *
 * Scrims ramp hard rather than evenly — an even gradient greys the photograph
 * across its whole height and makes it look like stock. 44% to 55% is where the
 * ramp lives; above that the image is untouched.
 *
 * Chromium refuses file:// subresources from the opaque origin that
 * setContent() creates, so every page is written to a scratch file beside the
 * photos and loaded with goto(). Without that the photo silently renders as a
 * black rectangle with type on it.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PHOTOS = join(ROOT, 'content', 'photos', 'site');
const OUT = join(ROOT, 'content', 'cards');

const INK = '#12100E';
const CREAM = '#F6F1E9';
const GOLD = '#C08B3E';   // lifted from #B07C33 — the hairline gold dies over a photograph
const FONTS = readFileSync(join(ROOT, 'assets', 'fonts', 'brand-fonts.css'), 'utf8');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function chromiumPath() {
  return [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p)) || undefined;
}

/* Photo library. `focus` and `zoom` are the crop — a 4:5 photo cropped to 9:16
   loses a third of its width, so each one is aimed by hand. */
const P = {
  salon:    { f: 'site-01-salon-interior-final.jpg', focus: '50% 46%', zoom: 112 },
  atwork:   { f: 'site-02-sha-at-work-2.jpg',        focus: '54% 40%', zoom: 118 },
  buttery:  { f: 'site-03-IMG_0430.jpg',             focus: '50% 34%', zoom: 116 },
  foiling:  { f: 'site-05-IMG_0456.jpg',             focus: '52% 38%', zoom: 120 },
  bob:      { f: 'site-06-IMG_0135.jpg',             focus: '50% 32%', zoom: 114 },
  sleek:    { f: 'site-07-IMG_0260.jpg',             focus: '50% 36%', zoom: 112 },
  highlit:  { f: 'site-09-sleek-blonde-highlights.jpg', focus: '50% 34%', zoom: 116 },
  straight: { f: 'site-10-IMG_2720.jpg',             focus: '50% 33%', zoom: 114 },
  bronde:   { f: 'site-12-IMG_0768.jpg',             focus: '50% 35%', zoom: 116 },
  wavy:     { f: 'site-13-IMG_0764.jpg',             focus: '50% 34%', zoom: 114 },
  brunette: { f: 'site-14-IMG_0766.jpg',             focus: '50% 36%', zoom: 114 },
  hero:     { f: 'site-15-hero-brunette.jpg',        focus: '50% 38%', zoom: 112 },
};

function css(W, H) {
  return `${FONTS}
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${W}px;height:${H}px;overflow:hidden}
    body{position:relative;background:${INK};font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}
    .photo{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat}
    .scrim{position:absolute;inset:0}
    .fr{font-family:'Fraunces',serif;font-weight:400;font-variation-settings:'opsz' 144;
        letter-spacing:-.032em;line-height:.94}
    .eyebrow{font-size:21px;letter-spacing:.28em;text-transform:uppercase;font-weight:700;color:${GOLD}}
    .rule{height:4px;width:104px;background:${GOLD}}
    /* Inter for numerals — Fraunces' display 3 reads as a 5 at thumbnail size */
    .num{font-family:'Inter',sans-serif;font-variation-settings:normal;font-weight:700;
         letter-spacing:-.04em;font-variant-numeric:tabular-nums}`;
}

/* ---------------- REEL COVER · 1080x1920 ---------------- */
function reelHtml(c) {
  const p = P[c.photo];
  const sup = c.support ? `<p class="sup">${esc(c.support)}</p>` : '';
  return `<html><head><meta charset="utf-8"><style>${css(1080, 1920)}
    .photo{background-image:url('${p.f}');background-position:${p.focus};background-size:${p.zoom}% auto}
    /* Hard ramp. An even gradient greys the whole photograph. */
    .scrim{background:linear-gradient(180deg,
      rgba(18,16,14,.42) 0%, rgba(18,16,14,.10) 20%, rgba(18,16,14,.06) 40%,
      rgba(18,16,14,.62) 62%, rgba(18,16,14,.94) 82%, rgba(18,16,14,.99) 100%)}
    /* The band Instagram's UI leaves alone: below the top status, above the
       caption bar, clear of the right-hand button rail. */
    .plate{position:absolute;left:74px;right:250px;bottom:420px;
           display:flex;flex-direction:column;gap:26px}
    .top{position:absolute;left:74px;top:96px;display:flex;gap:18px;align-items:center}
    h1{font-size:${c.size || 108}px;color:${CREAM};text-shadow:0 2px 40px rgba(0,0,0,.5)}
    .sup{font-size:31px;line-height:1.42;color:rgba(246,241,233,.9);max-width:20ch;font-weight:500}
    .tag{position:absolute;left:74px;bottom:330px;font-size:23px;font-weight:700;
         letter-spacing:.2em;text-transform:uppercase;color:${GOLD}}
  </style></head><body>
    <div class="photo"></div><div class="scrim"></div>
    <div class="top"><span class="rule"></span><span class="eyebrow">${esc(c.eyebrow)}</span></div>
    <div class="plate">
      <h1 class="fr">${c.title}</h1>
      ${sup}
    </div>
    <div class="tag">${esc(c.tag)}</div>
  </body></html>`;
}

/* ---------------- CAROUSEL SLIDE · 1080x1350 ---------------- */
function slideHtml(s) {
  const p = s.photo ? P[s.photo] : null;

  // Cover: photograph carries it, type bottom-anchored.
  if (s.kind === 'cover') {
    return `<html><head><meta charset="utf-8"><style>${css(1080, 1350)}
      .photo{background-image:url('${p.f}');background-position:${p.focus};background-size:${p.zoom}% auto}
      .scrim{background:linear-gradient(180deg,
        rgba(18,16,14,.40) 0%, rgba(18,16,14,.06) 26%, rgba(18,16,14,.30) 52%,
        rgba(18,16,14,.88) 78%, rgba(18,16,14,.98) 100%)}
      .top{position:absolute;left:66px;top:68px;display:flex;gap:18px;align-items:center}
      .plate{position:absolute;left:66px;right:66px;bottom:74px;display:flex;flex-direction:column;gap:24px}
      h1{font-size:${s.size || 96}px;color:${CREAM};text-shadow:0 2px 36px rgba(0,0,0,.45)}
      .sup{font-size:29px;line-height:1.4;color:rgba(246,241,233,.88);max-width:26ch;font-weight:500}
      .swipe{position:absolute;right:66px;bottom:76px;font-size:22px;font-weight:700;
             letter-spacing:.18em;text-transform:uppercase;color:${GOLD}}
    </style></head><body>
      <div class="photo"></div><div class="scrim"></div>
      <div class="top"><span class="rule"></span><span class="eyebrow">${esc(s.eyebrow)}</span></div>
      <div class="plate"><h1 class="fr">${s.title}</h1>${s.support ? `<p class="sup">${esc(s.support)}</p>` : ''}</div>
      <div class="swipe">Swipe &rarr;</div>
    </body></html>`;
  }

  // Content: ink ground, a strip of the photograph at the top so the set still
  // reads as one object. Text on a flat ground beats text on a busy scrim.
  if (s.kind === 'content') {
    const bullets = (s.bullets || [])
      .map((b) => `<li><span class="bl">${esc(b.k)}</span><span class="bv">${esc(b.v)}</span></li>`)
      .join('');
    return `<html><head><meta charset="utf-8"><style>${css(1080, 1350)}
      body{background:${INK}}
      .strip{position:absolute;left:0;right:0;top:0;height:330px;background-image:url('${p.f}');
             background-position:${p.focus};background-size:${p.zoom + 20}% auto}
      .stripscrim{position:absolute;left:0;right:0;top:0;height:330px;
        background:linear-gradient(180deg, rgba(18,16,14,.30) 0%, rgba(18,16,14,.55) 60%, rgba(18,16,14,1) 100%)}
      /* Centred, not top-anchored. A short slide top-anchored leaves a third of
         the card empty, which is the thing that reads as unfinished. */
      .wrap{position:absolute;left:66px;right:66px;top:372px;bottom:64px;display:flex;
            flex-direction:column;justify-content:center}
      .n{font-size:22px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:${GOLD}}
      h2{font-size:${s.size || 74}px;color:${CREAM};margin-top:18px;max-width:15ch}
      .body{font-size:34px;line-height:1.46;color:rgba(246,241,233,.86);margin-top:28px;max-width:26ch}
      ul{list-style:none;margin-top:34px;display:flex;flex-direction:column;gap:0}
      li{display:flex;gap:22px;padding:22px 0;border-bottom:2px solid rgba(246,241,233,.16);align-items:baseline}
      .bl{font-size:27px;font-weight:800;color:${GOLD};letter-spacing:.05em;white-space:nowrap;min-width:5.2ch}
      .bv{font-size:29px;line-height:1.34;color:${CREAM};font-weight:500}
      .slidefoot{position:absolute;left:66px;right:66px;bottom:56px;display:flex;
                 justify-content:space-between;font-size:20px;font-weight:700;
                 letter-spacing:.14em;text-transform:uppercase;color:rgba(246,241,233,.42);
                 border-top:2px solid rgba(246,241,233,.16);padding-top:22px}
    </style></head><body>
      <div class="strip"></div><div class="stripscrim"></div>
      <div class="wrap">
        <p class="n">${esc(s.n)}</p>
        <h2 class="fr">${s.title}</h2>
        ${s.body ? `<p class="body">${esc(s.body)}</p>` : ''}
        ${bullets ? `<ul>${bullets}</ul>` : ''}
      </div>
      <div class="slidefoot">
        <span>Hair by Sha · Camberwell</span><span>Swipe &rarr;</span>
      </div>
    </body></html>`;
  }

  // Close: the ask. Cream ground so it stops the swipe.
  return `<html><head><meta charset="utf-8"><style>${css(1080, 1350)}
    body{background:${CREAM}}
    .wrap{position:absolute;inset:0;padding:76px 66px 70px;display:flex;flex-direction:column}
    .grow{flex:1}
    h2{font-size:${s.size || 92}px;color:${INK};max-width:14ch}
    .body{font-size:32px;line-height:1.45;color:rgba(18,16,14,.72);margin-top:30px;max-width:25ch}
    .cta{margin-top:38px;background:${INK};color:${CREAM};font-size:27px;font-weight:800;
         letter-spacing:.14em;text-transform:uppercase;padding:28px 34px;text-align:center}
    .foot{display:flex;justify-content:space-between;font-size:22px;font-weight:700;color:${INK};
          border-top:4px solid ${INK};padding-top:24px;margin-top:34px}
  </style></head><body>
    <div class="wrap">
      <span class="rule"></span>
      <div class="grow"></div>
      <h2 class="fr">${s.title}</h2>
      ${s.body ? `<p class="body">${esc(s.body)}</p>` : ''}
      <div class="cta">${esc(s.cta)}</div>
      <div class="grow"></div>
      <div class="foot"><span>Hair by Sha</span><span>Camberwell</span></div>
    </div>
  </body></html>`;
}

/* ---------------- SINGLE · 1080x1350 ---------------- */
function singleHtml(c) {
  const p = P[c.photo];
  return `<html><head><meta charset="utf-8"><style>${css(1080, 1350)}
    .photo{background-image:url('${p.f}');background-position:${p.focus};background-size:${p.zoom}% auto}
    .scrim{background:linear-gradient(180deg,
      rgba(18,16,14,.44) 0%, rgba(18,16,14,.08) 24%, rgba(18,16,14,.26) 46%,
      rgba(18,16,14,.86) 74%, rgba(18,16,14,.98) 100%)}
    .top{position:absolute;left:66px;top:68px;display:flex;gap:18px;align-items:center}
    .plate{position:absolute;left:66px;right:66px;bottom:70px;display:flex;flex-direction:column;gap:22px}
    h1{font-size:${c.size || 92}px;color:${CREAM};text-shadow:0 2px 36px rgba(0,0,0,.45)}
    .sup{font-size:30px;line-height:1.4;color:rgba(246,241,233,.9);max-width:25ch;font-weight:500}
    .cta{align-self:flex-start;background:${GOLD};color:${INK};font-size:25px;font-weight:800;
         letter-spacing:.13em;text-transform:uppercase;padding:22px 30px;margin-top:6px}
  </style></head><body>
    <div class="photo"></div><div class="scrim"></div>
    <div class="top"><span class="rule"></span><span class="eyebrow">${esc(c.eyebrow)}</span></div>
    <div class="plate">
      <h1 class="fr">${c.title}</h1>
      ${c.support ? `<p class="sup">${esc(c.support)}</p>` : ''}
      <span class="cta">${esc(c.cta)}</span>
    </div>
  </body></html>`;
}

/* ======================= THE WEEK ======================= */

const REELS = [
  {
    file: 'w5-r1-brassy.png', photo: 'buttery', eyebrow: 'Colour, explained', tag: 'Educational · 30s',
    title: 'Spring is<br>what turns<br>your blonde<br>brassy.', size: 112,
    support: 'It is not your shampoo. It is the UV coming back.',
  },
  {
    file: 'w5-r2-wednesday.png', photo: 'salon', eyebrow: 'Mid-week', tag: 'Wednesday & Thursday',
    title: 'A Wednesday<br>sounds worse<br>than it is.', size: 114,
    support: 'Nobody waiting. No rush. The calmest four hours of the week.',
  },
  {
    file: 'w5-r3-foursunday.png', photo: 'straight', eyebrow: 'Sundays 10 til 2', tag: 'One appointment',
    title: 'Four hours.<br>One Sunday.<br>One chair.', size: 118,
    support: 'Start to finish, and nobody else in the room.',
  },
  {
    // Was a "three questions" cover, which duplicated carousel C2. An honest-limits
    // reel is the stronger and non-overlapping angle: it builds trust, sets
    // expectations before the chair, and it is the kind of thing people send on.
    file: 'w5-r4-platinum.png', photo: 'bob', eyebrow: 'The honest answer', tag: 'Educational · 40s',
    title: 'Why I will<br>not take you<br>platinum<br>today.', size: 112,
    support: 'Not a no. A longer plan, and hair that survives it.',
  },
];

const CAROUSELS = [
  {
    id: 'w5-c1', slides: [
      { kind: 'cover', photo: 'highlit', eyebrow: 'Which one is yours', size: 90,
        title: 'Balayage, foils<br>or babylights?', support: 'They are not the same thing, and the wrong one costs you a year.' },
      { kind: 'content', photo: 'highlit', n: 'One', title: 'Balayage', size: 80,
        body: 'Painted on by hand, softer at the root. It grows out with no line, so you come back every ten to fourteen weeks instead of every four.',
        bullets: [{ k: 'From', v: '$340 · 3 hr 30' }, { k: 'Back in', v: '10–14 weeks' }] },
      { kind: 'content', photo: 'foiling', n: 'Two', title: 'Foils', size: 80,
        body: 'Brighter and more even than balayage, because the foil holds the heat. It lifts further, and it does leave a regrowth line.',
        bullets: [{ k: 'From', v: '$240 partial · $320 full' }, { k: 'Back in', v: '6–8 weeks' }] },
      { kind: 'content', photo: 'bob', n: 'Three', title: 'Babylights', size: 80,
        body: 'Very fine foils, woven close to the root. The most natural of the three and the slowest to do, which is why they sit at the top of the foil price.',
        bullets: [{ k: 'Best for', v: 'Grown-out blonde, soft grey blending' }] },
      { kind: 'close', size: 84, title: 'Not sure which one you want?', cta: 'DM me a photo of your hair',
        body: 'Send me a picture of where it is now and where you want it. I will tell you which of the three gets you there and roughly what it costs.' },
    ],
  },
  {
    id: 'w5-c2', slides: [
      { kind: 'cover', photo: 'atwork', eyebrow: 'The consultation', size: 92,
        title: 'Three questions<br>before I mix<br>anything.', support: 'Skip these and the colour is right today and wrong in six weeks.' },
      { kind: 'content', photo: 'atwork', n: 'Question one', title: 'What has been on it?', size: 76,
        body: 'Box dye, a home toner, a bad correction, henna. Old colour decides how far your hair can lift safely, and it does not always show.' },
      { kind: 'content', photo: 'wavy', n: 'Question two', title: 'How often can you really come back?', size: 68,
        body: 'This is the honest one. If you can get here twice a year, a root-heavy foil is the wrong choice no matter how much you like the picture.' },
      { kind: 'content', photo: 'bronde', n: 'Question three', title: 'What do you do with it every morning?', size: 66,
        body: 'Air dried and tied up is a different colour to blow dried and worn out. I would rather build the one you will actually wear.' },
      { kind: 'close', size: 88, title: 'Consultations are free, and separate.', cta: 'DM me to book a consult',
        body: 'You do not have to book colour on the same day. Come in, we talk it through, you get a plan and a price before anything is mixed.' },
    ],
  },
  {
    id: 'w5-c3', slides: [
      { kind: 'cover', photo: 'sleek', eyebrow: 'Spring into summer', size: 88,
        title: 'Make this<br>colour last<br>until Christmas.', support: 'Four things, and none of them are a product you have to buy from me.' },
      { kind: 'content', photo: 'sleek', n: 'One', title: 'Turn the water down', size: 82,
        body: 'Hot water opens the cuticle and the toner leaves with it. Lukewarm on the rinse is the single cheapest thing on this list.' },
      { kind: 'content', photo: 'straight', n: 'Two', title: 'Wash it less than you think', size: 74,
        body: 'Every wash takes a little colour. Two to three times a week holds tone far longer than daily, and your scalp settles down after a fortnight.' },
      { kind: 'content', photo: 'brunette', n: 'Three', title: 'UV is the one nobody plans for', size: 70,
        body: 'Melbourne UV climbs from September. It lifts blonde warm and fades brunette flat. A hat on a long day outside does more than any product.' },
      { kind: 'content', photo: 'hero', n: 'Four', title: 'Book the gloss before it goes', size: 76,
        body: 'A toner refresh at six weeks costs $45 and takes 45 minutes. Waiting until it has fully gone turns it into a much longer appointment.' },
      { kind: 'close', size: 86, title: 'Christmas is fifteen weeks away.', cta: 'DM me to lock in your dates',
        body: 'If you want to be sorted for December, the colour that gets you there is booked in September. December books out first.' },
    ],
  },
];

const SINGLES = [
  {
    file: 'w5-s1-midweek.png', photo: 'foiling', eyebrow: 'This week', size: 84,
    title: 'Wednesday and Thursday are the quiet ones.',
    support: 'Which makes them the best days to sit in this chair for four hours. No waiting, no rush, all of my attention.',
    cta: 'DM me a day that suits',
  },
  {
    file: 'w5-s2-sunday.png', photo: 'wavy', eyebrow: 'Sunday 13 September', size: 92,
    title: 'One Sunday chair. 10 til 2.',
    support: 'Four hours holds one big colour. When it is taken, the next one is a week away.',
    cta: 'DM me the word Sunday',
  },
];

/* ---------------- render ---------------- */
mkdirSync(OUT, { recursive: true });
const scratch = join(PHOTOS, '.w5-render.html');
const browser = await chromium.launch({ executablePath: chromiumPath() });

async function shoot(html, file, W, H) {
  writeFileSync(scratch, html);
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(`file://${scratch}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(140);
  writeFileSync(join(OUT, file), await page.screenshot({ type: 'png' }));
  console.log('  ' + file);
  await page.close();
}

console.log('Reel covers — 1080x1920');
for (const c of REELS) await shoot(reelHtml(c), c.file, 1080, 1920);

console.log('Carousels — 1080x1350');
for (const c of CAROUSELS) {
  for (let i = 0; i < c.slides.length; i++) {
    await shoot(slideHtml(c.slides[i]), `${c.id}-${i + 1}.png`, 1080, 1350);
  }
}

console.log('Singles — 1080x1350');
for (const c of SINGLES) await shoot(singleHtml(c), c.file, 1080, 1350);

await browser.close();
rmSync(scratch, { force: true });
console.log(`\nDone — ${REELS.length} reel covers, ${CAROUSELS.reduce((n, c) => n + c.slides.length, 0)} carousel slides, ${SINGLES.length} singles.`);
