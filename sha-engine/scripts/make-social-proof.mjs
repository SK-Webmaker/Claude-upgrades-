#!/usr/bin/env node
/**
 * Social proof assets — the pinned Facebook card, testimonial posts, an
 * Instagram Highlight cover, and a QR card.
 *
 * ---------------------------------------------------------------------------
 * The important part: this will not invent a rating.
 *
 * The brief described a pinned post reading "5.0 on Google — 100+ reviews".
 * Hair by Sha has **no Google Business Profile**, which the July growth audit
 * found and a search on 28 Aug 2026 confirmed — there is no Google rating to
 * display. (The 57-review Camberwell listing belongs to Hair Hut, the salon she
 * rents a chair inside, not to her.)
 *
 * So every number and every quote is read from `content/reviews.json`, and when
 * that file is empty the renderer draws a visibly unfinished asset with the
 * slots marked. It is deliberately impossible to accidentally publish a
 * fabricated rating from this script.
 *
 * That is not caution for its own sake. False social proof on a local service
 * business is the most damaging thing in this whole system: the customer taps
 * "read our reviews", finds nothing, and the trust is gone permanently. The
 * whole point of pointing at Google is that it is verifiable.
 *
 * Design follows the Sundays campaign — marigold, violet, ink, cream, type at
 * scale — so the page reads as one brand rather than a salon plus a widget.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'content', 'social-proof');

const INK = '#12100E';
const CREAM = '#F6F1E9';
const VIOLET = '#5B4B7D';
const SUN = '#E8A33D';

const FONTS = readFileSync(join(ROOT, 'assets', 'fonts', 'brand-fonts.css'), 'utf8');
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const data = JSON.parse(readFileSync(join(ROOT, 'content', 'reviews.json'), 'utf8'));
const HAS_RATING = data.rating != null && data.reviewCount != null && data.source.profileUrl;
const realReviews = (data.reviews || []).filter((r) => r.quote && r.quote.trim());

function chromiumPath() {
  return [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p)) || undefined;
}

/** Five stars, drawn. Filled to the rating, so 4.8 is not shown as 5. */
function stars(rating, size = 46, colour = SUN) {
  const pct = rating ? Math.max(0, Math.min(1, rating / 5)) * 100 : 0;
  const star =
    'M12 .6l3.1 6.9 7.5.8-5.6 5 1.6 7.4L12 16.9 5.4 20.7 7 13.3 1.4 8.3l7.5-.8z';
  const one = (fill) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 22" style="display:inline-block;vertical-align:middle"><path d="${star}" fill="${fill}"/></svg>`;
  return `<span style="position:relative;display:inline-block;line-height:0">
      <span style="opacity:.22">${one(colour).repeat(5)}</span>
      <span style="position:absolute;left:0;top:0;overflow:hidden;width:${pct}%;white-space:nowrap">${one(colour).repeat(5)}</span>
    </span>`;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function base(W, H) {
  return `${FONTS}
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:${W}px;height:${H}px;overflow:hidden;position:relative;
         font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}
    .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.10;
           mix-blend-mode:multiply;pointer-events:none;z-index:9}
    .disc{position:absolute;border-radius:50%}
    h1{font-family:'Fraunces',serif;font-weight:400;line-height:.9;letter-spacing:-.04em;
       font-variation-settings:'opsz' 144}
    .kicker{font-size:22px;letter-spacing:.32em;text-transform:uppercase;font-weight:700}
    .todo{position:absolute;inset:0;z-index:12;display:flex;align-items:center;justify-content:center}
    .todo span{background:${INK};color:${SUN};font-size:26px;font-weight:800;letter-spacing:.22em;
               text-transform:uppercase;padding:22px 34px;transform:rotate(-6deg);
               border:4px solid ${SUN};text-align:center;line-height:1.5}`;
}

/* ---------------- the pinned card ---------------- */
function heroHtml() {
  const W = 1080, H = 1080; // square — Facebook's pinned post crops kindly to this
  return `<html><head><meta charset="utf-8"><style>${base(W, H)}
    body{background:${SUN}}
    .disc{width:820px;height:820px;background:${CREAM};right:-210px;top:-160px;opacity:.96}
    .wrap{position:absolute;inset:0;padding:76px 72px 70px;display:flex;flex-direction:column;z-index:5}
    .rulebar{height:10px;background:${INK};width:190px;margin-bottom:28px}
    .grow{flex:1}
    h1{font-size:${HAS_RATING ? 210 : 120}px;color:${INK};margin-top:10px}
    .of{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;font-size:60px;
        color:${VIOLET};margin-top:6px}
    .count{font-size:34px;font-weight:700;color:${INK};margin-top:24px}
    .cta{display:inline-block;background:${INK};color:${SUN};font-size:24px;font-weight:800;
         letter-spacing:.16em;text-transform:uppercase;padding:20px 30px;align-self:flex-start;margin-top:30px}
    .foot{display:flex;justify-content:space-between;font-size:21px;font-weight:700;color:${INK};
          border-top:3px solid ${INK};padding-top:22px;margin-top:30px}
  </style></head><body>
    <div class="disc"></div>
    <div class="wrap">
      <div class="rulebar"></div>
      <p class="kicker" style="color:${INK}">Loved by our clients</p>
      <div class="grow"></div>
      <div style="margin-bottom:14px">${stars(data.rating, 54, INK)}</div>
      <h1>${HAS_RATING ? esc(data.rating.toFixed(1)) : '0.0'}</h1>
      <p class="of">on ${esc(data.source.platform)}</p>
      <p class="count">${HAS_RATING ? esc(data.reviewCount) + ' reviews' : '— reviews'}</p>
      <span class="cta">Read our ${esc(data.source.platform)} reviews</span>
      <div class="grow"></div>
      <div class="foot"><span>Hair by Sha</span><span>Camberwell</span></div>
    </div>
    ${HAS_RATING ? '' : `<div class="todo"><span>Not ready to post<br>no ${esc(data.source.platform)} profile yet</span></div>`}
    <div class="grain"></div>
  </body></html>`;
}

/* ---------------- a testimonial ---------------- */
function reviewHtml(r, i) {
  const W = 1080, H = 1080;
  const tone = i % 2 === 0 ? 'violet' : 'cream';
  const bg = tone === 'violet' ? VIOLET : CREAM;
  const fg = tone === 'violet' ? CREAM : INK;
  const acc = tone === 'violet' ? SUN : VIOLET;
  const filled = r && r.quote && r.quote.trim();
  return `<html><head><meta charset="utf-8"><style>${base(W, H)}
    body{background:${bg}}
    .disc{width:640px;height:640px;background:${acc};left:-240px;bottom:-260px;opacity:.28}
    .wrap{position:absolute;inset:0;padding:76px 72px 70px;display:flex;flex-direction:column;z-index:5}
    .rulebar{height:10px;background:${acc};width:190px;margin-bottom:26px}
    .grow{flex:1}
    .quote{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;
           font-size:${filled && r.quote.length > 150 ? 52 : 66}px;line-height:1.16;color:${fg};
           letter-spacing:-.02em}
    .who{font-size:28px;font-weight:700;color:${acc};margin-top:32px}
    .src{font-size:22px;font-weight:600;color:${fg};opacity:.62;margin-top:8px}
    .foot{display:flex;justify-content:space-between;font-size:21px;font-weight:700;color:${fg};
          border-top:3px solid ${fg};padding-top:22px;margin-top:28px;opacity:.9}
  </style></head><body>
    <div class="disc"></div>
    <div class="wrap">
      <div class="rulebar"></div>
      <p class="kicker" style="color:${acc}">${esc(data.source.platform)} review</p>
      <div class="grow"></div>
      <div style="margin-bottom:22px">${stars(filled ? 5 : 0, 40, acc)}</div>
      <p class="quote">${filled ? '&ldquo;' + esc(r.quote) + '&rdquo;' : '&ldquo;Paste the review here, word for word.&rdquo;'}</p>
      <p class="who">${filled ? esc(r.author || '') : '— first name and initial'}</p>
      <p class="src">Verified on ${esc(data.source.platform)}</p>
      <div class="grow"></div>
      <div class="foot"><span>Hair by Sha</span><span>Camberwell</span></div>
    </div>
    ${filled ? '' : `<div class="todo"><span>Empty slot<br>fill content/reviews.json</span></div>`}
    <div class="grain"></div>
  </body></html>`;
}

/* ---------------- Instagram Highlight cover ---------------- */
function highlightHtml() {
  const W = 1080, H = 1920;
  return `<html><head><meta charset="utf-8"><style>${base(W, H)}
    body{background:${VIOLET}}
    .disc{width:900px;height:900px;background:${SUN};left:90px;top:510px}
    .wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
          flex-direction:column;z-index:5}
    h1{font-size:150px;color:${INK};text-align:center;line-height:.95}
  </style></head><body>
    <div class="disc"></div>
    <div class="wrap">
      <div style="margin-bottom:26px">${stars(5, 74, INK)}</div>
      <h1>REVIEWS</h1>
    </div>
    <div class="grain"></div>
  </body></html>`;
}

/* ---------------- QR card ---------------- */
function qrHtml(dataUri, label, sub) {
  const W = 1080, H = 1350;
  return `<html><head><meta charset="utf-8"><style>${base(W, H)}
    body{background:${CREAM}}
    .disc{width:620px;height:620px;background:${SUN};right:-220px;top:-200px;opacity:.9}
    .wrap{position:absolute;inset:0;padding:84px 72px 76px;display:flex;flex-direction:column;
          align-items:center;text-align:center;z-index:5}
    h1{font-size:78px;color:${INK};margin-top:20px;max-width:16ch}
    .sub{font-size:30px;line-height:1.45;color:rgba(18,16,14,.7);margin-top:22px;max-width:24ch;font-weight:500}
    .qr{background:#fff;padding:26px;margin-top:44px;border:4px solid ${INK}}
    .qr img{display:block;width:440px;height:440px}
    .grow{flex:1}
    .foot{font-size:22px;font-weight:700;color:${INK};border-top:3px solid ${INK};
          padding-top:22px;width:100%;display:flex;justify-content:space-between}
  </style></head><body>
    <div class="disc"></div>
    <div class="wrap">
      <div style="margin-bottom:6px">${stars(5, 44, SUN)}</div>
      <h1>${esc(label)}</h1>
      <p class="sub">${esc(sub)}</p>
      <div class="qr"><img src="${dataUri}" alt="QR code"></div>
      <div class="grow"></div>
      <div class="foot"><span>Hair by Sha</span><span>Camberwell</span></div>
    </div>
    <div class="grain"></div>
  </body></html>`;
}

async function shoot(browser, html, file, W, H) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(join(OUT, file), await page.screenshot({ type: 'png' }));
  console.log(`  ${file}`);
  await page.close();
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromiumPath() });

console.log(HAS_RATING ? 'Rating found — rendering live assets.' : 'No rating in reviews.json — rendering PLACEHOLDER assets.');
await shoot(browser, heroHtml(), 'proof-01-pinned.png', 1080, 1080);
for (let i = 0; i < 3; i++) {
  await shoot(browser, reviewHtml(data.reviews[i], i), `proof-0${i + 2}-review.png`, 1080, 1080);
}
await shoot(browser, highlightHtml(), 'proof-05-highlight-cover.png', 1080, 1920);

// Booking QR is real and usable today. The review QR needs the profile URL.
const qrOpts = { margin: 1, width: 900, color: { dark: '#12100E', light: '#FFFFFF' } };
const bookUri = await QRCode.toDataURL('https://hairbysha-booking.onrender.com/book', qrOpts);
await shoot(browser, qrHtml(bookUri, 'Book your next appointment', 'Point your camera here. Sundays now open, 10 til 2.'), 'proof-06-qr-booking.png', 1080, 1350);

if (data.source.profileUrl) {
  const revUri = await QRCode.toDataURL(data.source.profileUrl, qrOpts);
  await shoot(browser, qrHtml(revUri, 'Loved your visit?', `Leave a ${data.source.platform} review. It takes about thirty seconds.`), 'proof-07-qr-review.png', 1080, 1350);
} else {
  console.log('  (review QR skipped — no profileUrl in reviews.json)');
}

await browser.close();
console.log(HAS_RATING ? '\nDone.' : '\nDone — placeholders only. Do not post these until reviews.json is filled in.');
