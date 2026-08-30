#!/usr/bin/env node
/**
 * Social proof assets — the pinned Facebook card, testimonial posts, an
 * Instagram Highlight cover, and a QR card.
 *
 * ---------------------------------------------------------------------------
 * Two separate gates, because the quotes and the rating are not the same claim.
 *
 * A QUOTE is verifiable as soon as it exists — six real ones, with names, are in
 * `content/reviews.json`, collected off her own site. Those cards render live.
 *
 * A RATING is a claim about a place a customer can go and check. "5.0 on Google"
 * is only worth printing if tapping it lands on a profile showing 5.0. Hair by
 * Sha has no publicly findable Google Business Profile — the July growth audit
 * found none, and her own website links "Read all reviews on Google" to a search
 * results page rather than a profile, which is the tell that whoever built it
 * had no profile URL either. (The 57-review Camberwell listing belongs to Hair
 * Hut, the salon she rents a chair inside.)
 *
 * So `rating`/`reviewCount`/`profileUrl` gate the pinned card only. Without them
 * the pinned card falls back to a claim that IS supported by the quotes on file:
 * named clients who have followed her across three suburbs for ten years. That
 * is stronger than a star average anyway, and it does not create a dead link.
 *
 * False social proof is the most damaging thing in this whole system. The
 * customer taps "read our reviews", finds nothing, and the trust is gone. The
 * whole point of citing Google is that it is checkable — so nothing here cites a
 * platform unless there is a URL on file that actually reaches it.
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
const PROFILE = (data.source.profileUrl || '').trim();
const HAS_RATING = data.rating != null && data.reviewCount != null && PROFILE;
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

/* ---------------- the pinned card ----------------
 * With a rating on file: the star average, big, sourced.
 * Without one: the claim the quotes DO support. Three named clients on file
 * describe following her for ten years across Malvern, Armadale and Camberwell.
 * That is specific, checkable against the testimonial cards sitting beside it,
 * and it needs no profile to link to.
 */
function heroHtml() {
  const W = 1080, H = 1080; // square — Facebook's pinned post crops kindly to this
  return `<html><head><meta charset="utf-8"><style>${base(W, H)}
    body{background:${SUN}}
    .disc{width:820px;height:820px;background:${CREAM};right:-210px;top:-160px;opacity:.96}
    .wrap{position:absolute;inset:0;padding:76px 72px 70px;display:flex;flex-direction:column;z-index:5}
    .rulebar{height:10px;background:${INK};width:190px;margin-bottom:28px}
    .grow{flex:1}
    h1{font-size:${HAS_RATING ? 210 : 116}px;color:${INK};margin-top:10px;max-width:13ch}
    .of{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;font-size:60px;
        color:${VIOLET};margin-top:6px}
    .count{font-size:34px;font-weight:700;color:${INK};margin-top:24px;max-width:26ch;line-height:1.4}
    .cta{display:inline-block;background:${INK};color:${SUN};font-size:24px;font-weight:800;
         letter-spacing:.16em;text-transform:uppercase;padding:20px 30px;align-self:flex-start;margin-top:30px}
    .foot{display:flex;justify-content:space-between;font-size:21px;font-weight:700;color:${INK};
          border-top:3px solid ${INK};padding-top:22px;margin-top:30px}
  </style></head><body>
    <div class="disc"></div>
    <div class="wrap">
      <div class="rulebar"></div>
      <p class="kicker" style="color:${INK}">${HAS_RATING ? 'Loved by our clients' : 'In their own words'}</p>
      <div class="grow"></div>
      ${HAS_RATING
        ? `<div style="margin-bottom:14px">${stars(data.rating, 54, INK)}</div>
           <h1>${esc(data.rating.toFixed(1))}</h1>
           <p class="of">on ${esc(data.source.platform)}</p>
           <p class="count">${esc(data.reviewCount)} reviews</p>
           <span class="cta">Read our ${esc(data.source.platform)} reviews</span>`
        : `<div style="margin-bottom:20px">${stars(5, 48, INK)}</div>
           <h1>Ten years.<br>Three suburbs.<br>Same clients.</h1>
           <p class="count">Malvern, then Armadale, now Camberwell &mdash; and they followed her.</p>
           <span class="cta">Read what they said</span>`}
      <div class="grow"></div>
      <div class="foot"><span>Hair by Sha</span><span>Camberwell</span></div>
    </div>
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
  // Long reviews are the good ones — a specific review is a persuasive review —
  // so the type steps down rather than the quote getting cut. Never truncate a
  // customer's words to fit a layout; that is editing the review.
  const len = filled ? r.quote.length : 0;
  const size = len > 250 ? 44 : len > 150 ? 52 : 66;
  // Only claim a platform when there is a URL that reaches it. Otherwise the
  // client's own context ("client of 10+ years") is both true and better copy.
  const attribution = PROFILE
    ? `Verified on ${esc(data.source.platform)}`
    : esc(r && r.context ? r.context : '');
  return `<html><head><meta charset="utf-8"><style>${base(W, H)}
    body{background:${bg}}
    .disc{width:640px;height:640px;background:${acc};left:-240px;bottom:-260px;opacity:.28}
    .wrap{position:absolute;inset:0;padding:76px 72px 70px;display:flex;flex-direction:column;z-index:5}
    .rulebar{height:10px;background:${acc};width:190px;margin-bottom:26px}
    /* Not centred. An even split leaves the quote sitting low against the disc
       and reads bottom-heavy at feed size — the top gap wants to be smaller. */
    .grow{flex:1}
    .grow.top{flex:.42}
    .quote{font-family:'Fraunces',serif;font-variation-settings:'opsz' 144;
           font-size:${size}px;line-height:1.16;color:${fg};letter-spacing:-.02em}
    .who{font-size:28px;font-weight:700;color:${acc};margin-top:32px}
    .src{font-size:22px;font-weight:600;color:${fg};opacity:.62;margin-top:8px}
    .foot{display:flex;justify-content:space-between;font-size:21px;font-weight:700;color:${fg};
          border-top:3px solid ${fg};padding-top:22px;margin-top:28px;opacity:.9}
  </style></head><body>
    <div class="disc"></div>
    <div class="wrap">
      <div class="rulebar"></div>
      <p class="kicker" style="color:${acc}">${PROFILE ? esc(data.source.platform) + ' review' : 'In her words'}</p>
      <div class="grow top"></div>
      <div style="margin-bottom:22px">${stars(filled ? 5 : 0, 40, acc)}</div>
      <p class="quote">${filled ? '&ldquo;' + esc(r.quote) + '&rdquo;' : '&ldquo;Paste the review here, word for word.&rdquo;'}</p>
      <p class="who">${filled ? esc(r.author || '') : '— client name'}</p>
      ${attribution ? `<p class="src">${attribution}</p>` : ''}
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

console.log(`${realReviews.length} real review(s) on file.`);
console.log(
  HAS_RATING
    ? 'Rating + profile URL found — pinned card renders the star average.'
    : 'No rating/profile URL — pinned card falls back to the tenure claim, and cards cite client context rather than a platform.'
);

await shoot(browser, heroHtml(), 'proof-01-pinned.png', 1080, 1080);

const slots = realReviews.length ? realReviews : [null, null, null];
for (let i = 0; i < slots.length; i++) {
  await shoot(browser, reviewHtml(slots[i], i), `proof-${String(i + 2).padStart(2, '0')}-review.png`, 1080, 1080);
}

const n = slots.length + 2;
await shoot(browser, highlightHtml(), `proof-${String(n).padStart(2, '0')}-highlight-cover.png`, 1080, 1920);

// Booking QR is real and usable today. The review QR needs the profile URL.
//
// Uses the branded Kairo domain, not the raw Render host. Both serve the same
// app (identical response, checked 29 Aug 2026) but this is a card printed and
// handed to a client — a visible `*.onrender.com` reads as a dev link, and it is
// the domain her own Instagram bio already points at.
const BOOKING_URL = 'https://hairbysha.kairobookings.com/book';
const qrOpts = { margin: 1, width: 900, color: { dark: '#12100E', light: '#FFFFFF' } };
const bookUri = await QRCode.toDataURL(BOOKING_URL, qrOpts);
await shoot(browser, qrHtml(bookUri, 'Book your next appointment', 'Point your camera here. Sundays now open, 10 til 2.'),
  `proof-${String(n + 1).padStart(2, '0')}-qr-booking.png`, 1080, 1350);

if (PROFILE) {
  const revUri = await QRCode.toDataURL(PROFILE, qrOpts);
  await shoot(browser, qrHtml(revUri, 'Loved your visit?', `Leave a ${data.source.platform} review. It takes about thirty seconds.`),
    `proof-${String(n + 2).padStart(2, '0')}-qr-review.png`, 1080, 1350);
} else {
  console.log('  (review QR skipped — no profileUrl in reviews.json)');
}

await browser.close();
console.log(
  HAS_RATING
    ? '\nDone.'
    : '\nDone. Testimonial cards are postable. The rating card is not — fill in rating, reviewCount and profileUrl once the Google profile exists.'
);
