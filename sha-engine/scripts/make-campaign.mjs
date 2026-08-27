#!/usr/bin/env node
/**
 * The Sundays campaign.
 *
 * Sha is opening Sunday 10am–2pm, permanently. Four hours.
 *
 * The whole campaign rests on one true fact: a Blonde Transformation is 240
 * minutes, so four hours is **exactly one big colour, or about five blow
 * waves**. That is not a marketing device, it is the timetable — which means
 * every urgency line here is literally true and none of it needs a discount.
 * Invariant 7 holds without effort: the scarcity is the product.
 *
 * Deliberately no prices anywhere in the set. The brief was value, not price,
 * and the stronger story is time: a Sunday is not cheap, it is finite. Post 6
 * carries durations so a reader can work out what fits, and stops there.
 *
 * ---------------------------------------------------------------------------
 * The campaign mark
 *
 * A shallow gold arc with its two ends dotted and labelled 10 and 2 — the arc
 * of the day, the window itself. It repeats on every asset so six posts, three
 * stories and an email read as one campaign rather than nine separate things.
 * Nobody else in local salon marketing is using a geometric time mark, which is
 * most of why it will stand out.
 *
 * Photography is Sha's own, per the format finding: images averaged 1.11% on
 * this account against 8.11% for video, and the only lever a still has is that
 * it shows real work. Two layouts carry no photograph at all, where the content
 * is a table or a list and typography is the right form rather than a fallback.
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
const GOLD = '#B07C33';
const VIOLET = '#6A5B8C';
const CREAM = '#F6F1E9';

const FONTS = readFileSync(join(ROOT, 'assets', 'fonts', 'brand-fonts.css'), 'utf8');

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.42'/%3E%3C/svg%3E\")";

function chromiumPath() {
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'];
  return candidates.find((p) => p && existsSync(p)) || undefined;
}

/**
 * The mark. `tone` picks gold-on-dark or gold-on-cream.
 * Drawn rather than typed so it stays crisp at any size and needs no asset.
 */
function arc({ w = 330, colour = GOLD, label = 'rgba(246,241,233,.72)' } = {}) {
  const h = Math.round(w * 0.42);
  return `<svg width="${w}" height="${h}" viewBox="0 0 330 138" fill="none" style="display:block">
    <path d="M14 116 A 168 168 0 0 1 316 116" stroke="${colour}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <circle cx="14" cy="116" r="6" fill="${colour}"/>
    <circle cx="316" cy="116" r="6" fill="${colour}"/>
    <circle cx="165" cy="48" r="3.5" fill="${colour}" opacity="0.55"/>
    <text x="14" y="136" fill="${label}" font-family="Inter, sans-serif" font-size="19" font-weight="600" letter-spacing="1.6" text-anchor="middle">10</text>
    <text x="316" y="136" fill="${label}" font-family="Inter, sans-serif" font-size="19" font-weight="600" letter-spacing="1.6" text-anchor="middle">2</text>
  </svg>`;
}

function shell(card, W, H) {
  const { photo, focus = '50% 40%', zoom = 100 } = card;
  const shot = photo
    ? `.shot{position:absolute;inset:0;background-image:url('${photo}');
        background-size:${zoom}% auto;background-position:${focus};background-repeat:no-repeat;
        filter:saturate(1.12) contrast(1.05) brightness(.99)}`
    : '';
  return `
    ${FONTS}
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:${W}px;height:${H}px;overflow:hidden;position:relative;background:${INK};
         font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;
         text-rendering:geometricPrecision}
    ${shot}
    .warm{position:absolute;inset:0;background:${GOLD};opacity:.13;mix-blend-mode:soft-light}
    .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.15;
           mix-blend-mode:overlay;pointer-events:none}
    .eyebrow{font-size:20px;letter-spacing:.3em;text-transform:uppercase;font-weight:600;color:${GOLD}}
    h1{font-family:'Fraunces',serif;font-weight:400;line-height:1.0;letter-spacing:-.03em;
       font-variation-settings:'opsz' 144}
    .rule{height:1px;background:${GOLD};opacity:.5}
  `;
}

function html(card) {
  const W = card.story ? 1080 : 1080;
  const H = card.story ? 1920 : 1350;
  const base = shell(card, W, H);

  /* ---------------- reveal — the announcement ---------------- */
  if (card.kind === 'reveal') {
    return `<html><head><meta charset="utf-8"><style>${base}
      .scrim{position:absolute;inset:0;background:linear-gradient(to bottom,
        rgba(18,16,14,.46) 0%, rgba(18,16,14,.08) 24%, rgba(18,16,14,.30) 44%,
        rgba(18,16,14,.84) 58%, rgba(18,16,14,.96) 70%, ${INK} 86%)}
      .copy{position:absolute;left:80px;right:80px;bottom:86px;color:${CREAM}}
      h1{font-size:158px;line-height:.92;margin-top:30px}
      .sub{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;font-size:46px;
           color:${GOLD};margin-top:24px;letter-spacing:-.01em}
      .support{font-size:27px;line-height:1.5;color:rgba(246,241,233,.8);margin-top:20px;max-width:28ch}
      .foot{display:flex;justify-content:space-between;font-size:21px;font-weight:500;
            color:rgba(246,241,233,.6);margin-top:30px}
    </style></head><body>
      <div class="shot"></div><div class="warm"></div><div class="scrim"></div><div class="grain"></div>
      <div class="copy">
        ${arc({ w: 300 })}
        <h1>${card.headline}</h1>
        <p class="sub">${card.sub}</p>
        <p class="support">${card.support}</p>
        <div class="rule" style="margin-top:28px"></div>
        <div class="foot"><span>${card.footL}</span><span>${card.footR}</span></div>
      </div>
    </body></html>`;
  }

  /* ---------------- sanctuary — the emotional one ---------------- */
  if (card.kind === 'sanctuary') {
    return `<html><head><meta charset="utf-8"><style>${base}
      /* A light sandwich, not a gradient to black. The first attempt washed
         cream over the top half and dropped to ink at the base, which read as
         three stacked bands rather than one photograph. Cream holds the type at
         top, clears entirely through the middle so the room is actually seen,
         then returns softly at the base so the footer has ground to sit on. */
      .scrim{position:absolute;inset:0;background:linear-gradient(to bottom,
        rgba(246,241,233,.96) 0%, rgba(246,241,233,.90) 30%, rgba(246,241,233,.42) 46%,
        rgba(246,241,233,0) 60%, rgba(246,241,233,0) 78%, rgba(246,241,233,.86) 96%,
        rgba(246,241,233,.94) 100%)}
      .copy{position:absolute;left:80px;right:80px;top:96px;color:${INK}}
      h1{font-size:70px;line-height:1.06;margin-top:28px;max-width:15ch}
      .support{font-size:28px;line-height:1.52;color:rgba(18,16,14,.68);margin-top:26px;max-width:26ch}
      .foot{position:absolute;left:80px;right:80px;bottom:64px;display:flex;
            justify-content:space-between;font-size:21px;font-weight:600;color:${INK}}
    </style></head><body>
      <div class="shot"></div><div class="warm"></div><div class="scrim"></div><div class="grain"></div>
      <div class="copy">
        ${arc({ w: 290, label: 'rgba(18,16,14,.5)' })}
        <h1>${card.headline}</h1>
        <p class="support">${card.support}</p>
      </div>
      <div class="foot"><span>${card.footL}</span><span>${card.footR}</span></div>
    </body></html>`;
  }

  /* ---------------- ledger — the four-hour maths, no photo ---------------- */
  if (card.kind === 'ledger') {
    const rows = card.items
      .map((i) => `<div class="row"><span>${i.label}</span><span class="t">${i.value}</span></div>`)
      .join('');
    return `<html><head><meta charset="utf-8"><style>${base}
      body{background:${CREAM};color:${INK}}
      .wrap{position:absolute;inset:0;padding:92px 84px 80px;display:flex;flex-direction:column}
      h1{font-size:70px;margin-top:26px;max-width:14ch}
      .rows{margin-top:52px;border-top:1px solid rgba(18,16,14,.18)}
      .row{display:flex;justify-content:space-between;align-items:baseline;padding:26px 0;
           border-bottom:1px solid rgba(18,16,14,.18);font-size:30px;color:rgba(18,16,14,.86)}
      .t{color:${GOLD};font-weight:600;font-size:22px;letter-spacing:.12em;text-transform:uppercase}
      .grow{flex:1}
      .close{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;font-size:52px;
             line-height:1.14;color:${VIOLET};max-width:19ch}
      .foot{display:flex;justify-content:space-between;font-size:22px;font-weight:600;color:${INK};
            margin-top:40px;padding-top:22px;border-top:1px solid rgba(18,16,14,.18)}
    </style></head><body>
      <div class="wrap">
        ${arc({ w: 290, label: 'rgba(18,16,14,.5)' })}
        <h1>${card.headline}</h1>
        <div class="rows">${rows}</div>
        <div class="grow"></div>
        <p class="close">${card.close}</p>
        <div class="foot"><span>${card.footL}</span><span>${card.footR}</span></div>
      </div>
    </body></html>`;
  }

  /* ---------------- dated — the urgency posts ---------------- */
  if (card.kind === 'dated') {
    return `<html><head><meta charset="utf-8"><style>${base}
      .scrim{position:absolute;inset:0;background:linear-gradient(to bottom,
        rgba(18,16,14,.50) 0%, rgba(18,16,14,.12) 26%, rgba(18,16,14,.34) 46%,
        rgba(18,16,14,.86) 60%, ${INK} 82%)}
      .stamp{position:absolute;top:76px;left:80px;right:80px;display:flex;
             justify-content:space-between;align-items:center}
      .tag{font-size:19px;letter-spacing:.3em;text-transform:uppercase;font-weight:700;
           color:${INK};background:${GOLD};padding:14px 24px;border-radius:2px}
      .copy{position:absolute;left:80px;right:80px;bottom:84px;color:${CREAM}}
      .date{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;font-size:120px;
            line-height:.92;letter-spacing:-.035em;color:${CREAM}}
      .month{font-size:26px;letter-spacing:.24em;text-transform:uppercase;font-weight:600;
             color:${GOLD};margin-top:14px}
      h1{font-size:56px;line-height:1.08;margin-top:26px;max-width:18ch}
      .support{font-size:26px;line-height:1.5;color:rgba(246,241,233,.78);margin-top:18px;max-width:29ch}
      .foot{display:flex;justify-content:space-between;font-size:21px;font-weight:500;
            color:rgba(246,241,233,.6);margin-top:28px}
    </style></head><body>
      <div class="shot"></div><div class="warm"></div><div class="scrim"></div><div class="grain"></div>
      <div class="stamp"><span class="tag">${card.tag}</span></div>
      <div class="copy">
        ${arc({ w: 250 })}
        <p class="date" style="margin-top:22px">${card.date}</p>
        <p class="month">${card.month}</p>
        <h1>${card.headline}</h1>
        <p class="support">${card.support}</p>
        <div class="rule" style="margin-top:26px"></div>
        <div class="foot"><span>${card.footL}</span><span>${card.footR}</span></div>
      </div>
    </body></html>`;
  }

  /* ---------------- fits — what the window holds ---------------- */
  if (card.kind === 'fits') {
    const items = card.items.map((t) => `<li><span>${t}</span></li>`).join('');
    return `<html><head><meta charset="utf-8"><style>${base}
      .frame{position:absolute;left:0;right:0;top:0;height:36%;overflow:hidden}
      .seam{position:absolute;left:0;right:0;top:36%;height:3px;background:${GOLD};z-index:2}
      .plate{position:absolute;left:0;right:0;bottom:0;height:64%;background:${CREAM};color:${INK};
             padding:42px 76px 46px;display:flex;flex-direction:column}
      h1{font-size:54px;margin-top:14px;max-width:18ch}
      ol{list-style:none;counter-reset:i;margin-top:26px}
      li{counter-increment:i;display:flex;gap:24px;padding:18px 0;align-items:baseline;
         border-bottom:1px solid rgba(18,16,14,.14);font-size:27px;line-height:1.34;
         color:rgba(18,16,14,.84)}
      li:first-child{border-top:1px solid rgba(18,16,14,.14)}
      li::before{content:'0' counter(i);font-family:'Inter',sans-serif;font-size:22px;color:${GOLD};
                 min-width:52px;font-weight:600;font-variant-numeric:tabular-nums}
      .grow{flex:1}
      .close{border-left:2px solid ${GOLD};padding-left:22px;font-size:25px;line-height:1.45;
             color:rgba(18,16,14,.68);max-width:82%}
      .foot{display:flex;justify-content:space-between;font-size:21px;font-weight:600;color:${INK};margin-top:22px}
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

  /* ---------------- story — 9:16 ---------------- */
  return `<html><head><meta charset="utf-8"><style>${base}
    .scrim{position:absolute;inset:0;background:linear-gradient(to bottom,
      rgba(18,16,14,.52) 0%, rgba(18,16,14,.14) 26%, rgba(18,16,14,.30) 48%,
      rgba(18,16,14,.82) 66%, ${INK} 88%)}
    /* Story safe areas are real: the top ~14% and bottom ~20% carry Instagram's
       own UI, so nothing that must be read goes there. */
    .copy{position:absolute;left:88px;right:88px;bottom:400px;color:${CREAM}}
    h1{font-size:104px;line-height:.98;margin-top:34px}
    .sub{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;font-size:46px;
         color:${GOLD};margin-top:26px}
    .support{font-size:32px;line-height:1.45;color:rgba(246,241,233,.82);margin-top:24px;max-width:22ch}
  </style></head><body>
    <div class="shot"></div><div class="warm"></div><div class="scrim"></div><div class="grain"></div>
    <div class="copy">
      ${arc({ w: 300 })}
      <h1>${card.headline}</h1>
      ${card.sub ? `<p class="sub">${card.sub}</p>` : ''}
      <p class="support">${card.support}</p>
    </div>
  </body></html>`;
}

export const CAMPAIGN = [
  {
    file: 'sun-01-reveal.png',
    kind: 'reveal',
    photo: 'site/site-13-IMG_0764.jpg',
    focus: '50% 28%',
    zoom: 118,
    headline: 'Sundays.',
    sub: '10 til 2. Every week.',
    support: 'The chair is open on a Sunday now. It was not before.',
    footL: 'Hair by Sha',
    footR: 'Camberwell',
  },
  {
    file: 'sun-02-yours.png',
    kind: 'sanctuary',
    photo: 'site/site-01-salon-interior-final.jpg',
    focus: '50% 46%',
    zoom: 128,
    headline: 'Four hours in the week that belong to you.',
    support:
      'No school run. No inbox. Nowhere you have to be at 3pm. Just the chair, the light through the front window, and someone doing your hair properly.',
    footL: 'Sundays, 10–2',
    footR: 'Camberwell',
  },
  {
    file: 'sun-03-ledger.png',
    kind: 'ledger',
    headline: 'A Sunday is four hours long.',
    items: [
      { label: 'A blonde transformation', value: '4 hrs' },
      { label: 'A lived-in balayage', value: '3 hr 30' },
      { label: 'Half foil and a toner', value: '2 hr 30' },
      { label: 'Or five blow waves', value: '45 min ea' },
    ],
    close: 'Which means most Sundays hold one person. Sometimes two. Never more.',
    footL: 'Sundays, 10–2',
    footR: 'Hair by Sha',
  },
  {
    file: 'sun-04-this-sunday.png',
    kind: 'dated',
    photo: 'site/site-11-IMG_0767.jpg',
    // Pushed hard right at high zoom to cut the salon mirror out of frame — it
    // carries a clearly recognisable face on the left of the original, which is
    // not usable in a campaign without that person's consent. The hair itself
    // is the best warm caramel in the library, so it is worth the tight crop.
    focus: '74% 33%',
    zoom: 162,
    tag: 'This Sunday',
    date: '30',
    month: 'August',
    headline: 'The first one.',
    support:
      'Four hours, one chair. If you have been meaning to book something big, this is the Sunday with nothing in front of it.',
    footL: '10am – 2pm',
    footR: 'Camberwell',
  },
  {
    file: 'sun-05-next-sunday.png',
    kind: 'dated',
    photo: 'site/site-15-hero-brunette.jpg',
    focus: '50% 38%',
    zoom: 114,
    tag: 'Sunday after',
    date: '06',
    month: 'September',
    headline: 'Then this one.',
    support:
      'Same four hours. Same one chair. Book it now and the whole thing is off your list before spring properly starts.',
    footL: '10am – 2pm',
    footR: 'Camberwell',
  },
  {
    file: 'sun-06-fits.png',
    kind: 'fits',
    photo: 'site/site-10-IMG_2720.jpg',
    focus: '50% 26%',
    zoom: 122,
    eyebrow: 'What fits in a Sunday',
    headline: 'Pick one, and it is yours for the morning.',
    items: [
      'Blonde transformation with K18 — the full four hours',
      'Lived-in balayage, toner and blow wave — three and a half',
      'Half foil, toner and treatment — two and a half',
      'Root colour and refresh — an hour and three quarters',
      'A blow wave, if all you want is to feel finished — forty five minutes',
    ],
    close: 'Times, not prices. What a Sunday actually costs you is the four hours, and there are only four.',
    footL: 'Sundays, 10–2',
    footR: 'Hair by Sha',
  },
  /* ---- stories, 9:16 ---- */
  {
    file: 'sun-s1-story-reveal.png',
    kind: 'story',
    story: true,
    photo: 'site/site-13-IMG_0764.jpg',
    focus: '50% 30%',
    zoom: 112,
    headline: 'Sundays.',
    sub: '10 til 2. Every week.',
    support: 'The chair is open on a Sunday now. Swipe up, or tap the link.',
  },
  {
    file: 'sun-s2-story-onechair.png',
    kind: 'story',
    story: true,
    photo: 'site/site-11-IMG_0767.jpg',
    // Same mirrored-face crop as sun-04.
    focus: '74% 26%',
    zoom: 150,
    headline: 'One chair.',
    sub: 'Sunday 30 August.',
    support: 'Four hours holds one big colour. That is the whole day.',
  },
  {
    file: 'sun-s3-story-ask.png',
    kind: 'story',
    story: true,
    photo: 'site/site-10-IMG_2720.jpg',
    focus: '50% 26%',
    zoom: 112,
    headline: 'Would you come on a Sunday?',
    sub: '',
    support: 'Put the poll on this one. Then answer every yes with a booking link.',
  },
];

export async function render(outDir = OUT, cards = CAMPAIGN) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const scratch = join(PHOTOS, '.render.html');
  const written = [];
  for (const card of cards) {
    const W = 1080;
    const H = card.story ? 1920 : 1350;
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    writeFileSync(scratch, html(card));
    await page.goto(`file://${scratch}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    if (card.photo) {
      await page.evaluate(
        (src) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = src; }),
        card.photo,
      );
    }
    const buf = await page.screenshot({ type: 'png' });
    writeFileSync(join(outDir, card.file), buf);
    written.push(card.file);
    console.log(`${card.file}  ${Math.round(buf.length / 1000)}kB`);
    await page.close();
  }
  await browser.close();
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) await render();
