#!/usr/bin/env node
/**
 * Week 8 posts — "Come for Sha".
 *
 * The live read settled what this account is: seven of her ten best reels have
 * Sha herself on camera. People are not following a salon, they are following
 * her — one review literally says so, ten years across three suburbs. So the
 * week sells the person, and the services and prices hang off her.
 *
 *   P1  Book Sha            the manifesto, Sha in an arch, credentials as tiles
 *   P2  Pick your step      every price as a staircase, $45 to $340
 *   P3  They followed her   the Stella review verbatim, the three-suburb route
 *   P4  Your appointment    carousel, five slides: what actually happens
 *
 * The arch is the new device. It echoes the round mirrors on her walls, it
 * frames a person rather than a product, and it crops out the host salon's
 * poster that sits behind her in every photo of her at work.
 *
 * Density rule for this week, from the brief: no dead space. Every card is
 * built edge to edge — oversized outline letterforms behind the photograph,
 * credential tiles along the foot, a CTA bar on every single one.
 *
 * Prices from brand.json via svc(); reviews verbatim from reviews.json via
 * review(). Neither is ever typed by hand here.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PHOTOS = join(ROOT, 'content', 'photos');
const OUT = join(ROOT, 'content', 'cards');

const INK = '#12100E', CREAM = '#F6F1E9', GOLD = '#C08B3E', FIG = '#2F4032', CLAY = '#C9A88B';
const FONTS = readFileSync(join(ROOT, 'assets', 'fonts', 'brand-fonts.css'), 'utf8');
const BRAND = JSON.parse(readFileSync(join(ROOT, 'config', 'brand.json'), 'utf8'));
const REVIEWS = JSON.parse(readFileSync(join(ROOT, 'content', 'reviews.json'), 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const chromiumPath = () =>
  [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p)) || undefined;

function svc(name) {
  const s = BRAND.positioning.services.find((x) => x.name === name);
  if (!s) throw new Error(`service not in brand.json: ${name}`);
  return s;
}
function review(author) {
  const r = REVIEWS.reviews.find((x) => x.author === author);
  if (!r) throw new Error(`review not on file: ${author}`);
  return r;
}
const hm = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr${m % 60 ? ' ' + (m % 60) : ''}`);

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='5'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

const base = (bg) => `${FONTS}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1080px;height:1350px;overflow:hidden}
  body{position:relative;background:${bg};font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;color:${CREAM}}
  .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.12;mix-blend-mode:multiply;pointer-events:none;z-index:50}
  .fr{font-family:'Fraunces',serif;font-weight:400;font-variation-settings:'opsz' 144;letter-spacing:-.035em;line-height:.9}
  .num{font-family:'Inter',sans-serif;font-weight:800;letter-spacing:-.05em;font-variant-numeric:tabular-nums;line-height:.86}
  .lbl{font-size:20px;letter-spacing:.3em;text-transform:uppercase;font-weight:800}
  .arch{position:absolute;overflow:hidden;border-radius:999px 999px 0 0}
  .arch img{position:absolute;max-width:none}
  .cta{position:absolute;left:0;right:0;bottom:0;height:128px;display:flex;align-items:center;justify-content:space-between;padding:0 64px;z-index:30}
  .cta b{font-size:36px;font-weight:800;letter-spacing:-.01em}
  .cta span{font-size:21px;font-weight:800;letter-spacing:.22em;text-transform:uppercase}
  .disc{position:absolute;border-radius:50%}
`;

/* =============================================================== P1 */
function bookSha() {
  const tiles = [
    ['20+', 'years behind the chair'],
    ['1000+', 'happy clients'],
    ['K18', 'certified'],
    ['1', 'chair · no hand-offs'],
  ];
  return `<html><head><meta charset="utf-8"><style>${base(FIG)}
    .ghost{position:absolute;left:-30px;top:40px;font-size:560px;color:transparent;-webkit-text-stroke:3px rgba(201,168,139,.34);z-index:1;letter-spacing:-.05em}
    .tiles{position:absolute;left:0;right:0;bottom:128px;height:196px;display:grid;grid-template-columns:repeat(4,1fr);z-index:20}
    .tile{padding:28px 26px;border-right:3px solid ${FIG};background:${CREAM};color:${INK};display:flex;flex-direction:column;justify-content:center}
    .tile:last-child{border-right:0}
    .tile .num{font-size:66px;color:${FIG}}
    .tile p{font-size:19px;font-weight:700;margin-top:10px;line-height:1.25;color:rgba(18,16,14,.72)}
  </style></head><body>
    <div class="disc" style="width:720px;height:720px;left:-260px;top:520px;background:${CLAY};opacity:.16"></div>
    <div class="ghost fr">Sha</div>
    <div class="arch" style="left:486px;top:96px;width:540px;height:934px;z-index:5;border:8px solid ${GOLD}">
      <img src="ig/ig-03-18130950424627623.jpg" style="width:1010px;height:1796px;left:-458px;top:-188px">
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(18,16,14,0) 60%,rgba(18,16,14,.55))"></div>
    </div>
    <div style="position:absolute;left:64px;top:84px;z-index:10;display:flex;gap:18px;align-items:center">
      <i style="width:90px;height:5px;background:${GOLD}"></i><span class="lbl" style="color:${CLAY}">Hair by Sha · Camberwell</span></div>
    <div style="position:absolute;left:64px;top:470px;width:470px;z-index:10">
      <div style="position:relative;display:inline-block">
        <p class="fr" style="font-size:66px;color:${CREAM};line-height:1">Don’t book<br>a salon.</p>
        <i style="position:absolute;left:0;width:62%;bottom:-18px;height:7px;background:${GOLD}"></i>
      </div>
      <h1 class="fr" style="font-size:212px;color:${GOLD};margin-top:26px">Book<br>Sha.</h1>
    </div>
    <div class="tiles">${tiles.map(([n, l]) => `<div class="tile"><span class="num">${n}</span><p>${l}</p></div>`).join('')}</div>
    <div class="cta" style="background:${GOLD};color:${INK}"><b>DM me to book</b><span>Sundays 10–2</span></div>
    <div class="grain"></div>
  </body></html>`;
}

/* =============================================================== P2 */
function ladder() {
  const steps = [
    ['Toner & gloss', svc('Toner & Gloss'), CREAM, INK],
    ['Blow wave', svc('Blow Wave'), CLAY, INK],
    ['Root colour + refresh', svc('Root Colour + Refresh'), GOLD, INK],
    ['Partial foils', svc('Partial Blonde (Foils)'), FIG, CREAM],
    ['Balayage · lived-in', svc('Balayage / Lived-in Blonde'), CREAM, INK],
  ];
  const H = [330, 430, 560, 700, 860];
  return `<html><head><meta charset="utf-8"><style>${base(INK)}
    .stairs{position:absolute;left:40px;right:40px;bottom:128px;height:860px;display:flex;align-items:flex-end;gap:12px;z-index:10}
    .st{flex:1;display:flex;flex-direction:column;padding:26px 18px;position:relative}
    .st .fromx{font-size:18px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;opacity:.7}
    .st .pr{font-size:78px;margin-top:4px}
    .st .nm{font-size:21px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;margin-top:14px;line-height:1.22}
    .st .tm{font-size:19px;font-weight:600;margin-top:8px;opacity:.72}
    .st .n{position:absolute;right:16px;bottom:14px;font-size:120px;opacity:.12}
    .rays{position:absolute;width:2400px;height:2400px;left:-700px;top:-1400px;border-radius:50%;
      background:repeating-conic-gradient(from 0deg,${GOLD} 0deg 3.2deg,transparent 3.2deg 8deg);opacity:.09}
  </style></head><body>
    <div class="rays"></div>
    <div style="position:absolute;left:64px;top:78px;z-index:10;display:flex;gap:18px;align-items:center">
      <i style="width:90px;height:5px;background:${GOLD}"></i><span class="lbl" style="color:${GOLD}">Every price, up front</span></div>
    <h1 class="fr" style="position:absolute;left:64px;top:128px;font-size:136px;z-index:10">Pick your<br><span style="color:${GOLD}">step.</span></h1>
    <p style="position:absolute;right:64px;top:170px;width:380px;text-align:right;font-size:27px;font-weight:600;line-height:1.38;color:rgba(246,241,233,.82);z-index:10">
      Final quote before anything is mixed. Length and thickness decide the rest.</p>
    <div class="stairs">
      ${steps
        .map(
          ([n, s, bg, fg], i) => `<div class="st" style="height:${H[i]}px;background:${bg};color:${fg}">
            <span class="fromx">${s.from ? 'from' : '&nbsp;'}</span>
            <span class="pr fr">$${s.price}</span>
            <span class="nm">${esc(n)}</span>
            <span class="tm">${hm(s.minutes)}</span>
            <span class="n num">${i + 1}</span>
          </div>`,
        )
        .join('')}
    </div>
    <div class="cta" style="background:${GOLD};color:${INK}"><b>DM me your step</b><span>Hair by Sha</span></div>
    <div class="grain"></div>
  </body></html>`;
}

/* =============================================================== P3 */
function followed() {
  const st = review('Stella McCammon');
  const others = [review('Nimali Samarakoon'), review('Uppsala Trinh')];
  return `<html><head><meta charset="utf-8"><style>${base(CREAM)}
    body{color:${INK}}
  </style></head><body>
    <div class="disc" style="width:760px;height:760px;left:520px;top:-260px;background:${CLAY};opacity:.4"></div>
    <div class="num" style="position:absolute;left:40px;top:40px;font-size:430px;color:${GOLD};z-index:2">10</div>
    <div class="lbl" style="position:absolute;left:66px;top:440px;width:590px;color:${FIG};z-index:3;font-size:22px">Years. Three suburbs.</div>
    <div class="arch" style="left:700px;top:56px;width:316px;height:420px;z-index:4;border:6px solid ${GOLD}">
      <img src="ig/ig-03-18130950424627623.jpg" style="width:720px;height:1280px;left:-360px;top:-160px">
    </div>
    <div style="position:absolute;left:66px;right:66px;top:520px;height:74px;z-index:5">
      <i style="position:absolute;left:24px;right:24px;top:22px;height:5px;background:${FIG}"></i>
      ${['Malvern', 'Armadale', 'Camberwell']
        .map(
          (s, i) => `<div style="position:absolute;left:${i * 50}%;transform:translateX(-${i * 50}%);text-align:${['left', 'center', 'right'][i]}">
            <i style="display:inline-block;width:50px;height:50px;border-radius:50%;background:${i === 2 ? GOLD : FIG};border:5px solid ${CREAM}"></i>
            <div style="font-size:24px;font-weight:800;margin-top:4px">${s}</div></div>`,
        )
        .join('')}
    </div>
    <div style="position:absolute;left:66px;right:66px;top:648px;z-index:6">
      <p class="fr" style="font-size:43px;line-height:1.2;letter-spacing:-.02em">“${esc(st.quote)}”</p>
      <p style="margin-top:20px;font-size:25px;font-weight:800;color:${FIG}">${esc(st.author)} <span style="font-weight:600;color:rgba(18,16,14,.55)">· ${esc(st.context)}</span></p>
    </div>
    <div style="position:absolute;left:66px;right:66px;top:1060px;display:flex;gap:14px;z-index:6">
      ${others
        .map(
          (r) => `<div style="flex:1;background:${FIG};color:${CREAM};padding:22px 24px;border-radius:18px">
            <div style="font-size:24px;font-weight:800">${esc(r.author)}</div>
            <div style="font-size:21px;font-weight:600;color:${CLAY};margin-top:6px">${esc(r.context)}</div></div>`,
        )
        .join('')}
    </div>
    <div class="cta" style="background:${INK};color:${CREAM}"><b>Some follow a salon. <em style="font-style:normal;color:${GOLD}">Hers follow her.</em></b><span style="color:${GOLD}">DM to book</span></div>
    <div class="grain"></div>
  </body></html>`;
}

/* =============================================================== P4 carousel */
function stepSlide({ n, of, kicker, title, body, photo, pos, bg, fg, acc, cta, tags = [] }) {
  return `<html><head><meta charset="utf-8"><style>${base(bg)}
    body{color:${fg}}
  </style></head><body>
    <div class="num" style="position:absolute;right:-30px;top:-30px;font-size:620px;color:transparent;-webkit-text-stroke:4px ${acc};opacity:.5;z-index:1">${n}</div>
    <div class="arch" style="left:64px;top:96px;width:460px;height:640px;z-index:4;border:6px solid ${acc}">
      <img src="${photo}" style="${pos}">
    </div>
    <div style="position:absolute;left:64px;top:780px;right:64px;z-index:5">
      <div class="lbl" style="color:${acc};font-size:23px">${esc(kicker)}</div>
      <h2 class="fr" style="font-size:104px;margin-top:18px;max-width:15ch">${title}</h2>
      <p style="font-size:34px;font-weight:600;line-height:1.4;margin-top:24px;max-width:30ch;opacity:.88">${esc(body)}</p>
    </div>
    <div style="position:absolute;left:560px;top:470px;z-index:6;display:flex;flex-direction:column;gap:14px;align-items:flex-start">
      ${tags.map((t) => `<span style="padding:16px 26px;border-radius:999px;border:3px solid ${acc};font-size:28px;font-weight:800;color:${fg}">${esc(t)}</span>`).join('')}
    </div>
    <div style="position:absolute;right:64px;top:100px;z-index:6;display:flex;gap:10px">
      ${Array.from({ length: of }, (_, i) => `<i style="width:${i + 1 === +n + 1 ? 44 : 14}px;height:14px;border-radius:14px;background:${acc};opacity:${i + 1 <= +n + 1 ? 1 : .35}"></i>`).join('')}
    </div>
    <div class="cta" style="background:${acc};color:${bg === INK || bg === FIG ? INK : CREAM}"><b>${esc(cta)}</b><span>${+n + 1} / ${of}</span></div>
    <div class="grain"></div>
  </body></html>`;
}
function cover() {
  return `<html><head><meta charset="utf-8"><style>${base(INK)}</style></head><body>
    <img src="ig/ig-01-18260664004305649.jpg" style="position:absolute;left:0;top:-240px;width:1080px;height:1920px;object-fit:cover">
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(18,16,14,.45) 0%,rgba(18,16,14,.05) 26%,rgba(18,16,14,.35) 48%,rgba(18,16,14,.92) 74%,rgba(18,16,14,.98) 100%)"></div>
    <div style="position:absolute;left:64px;top:84px;display:flex;gap:18px;align-items:center;z-index:5">
      <i style="width:90px;height:5px;background:${GOLD}"></i><span class="lbl" style="color:${GOLD}">Your appointment · swipe</span></div>
    <div style="position:absolute;left:64px;right:64px;bottom:170px;z-index:5">
      <h1 class="fr" style="font-size:128px">What actually happens in <span style="color:${GOLD}">Sha’s chair.</span></h1>
      <p style="margin-top:26px;font-size:32px;font-weight:600;color:rgba(246,241,233,.86);max-width:26ch">Four steps. One person. Nobody else waiting.</p>
    </div>
    <div class="cta" style="background:${GOLD};color:${INK}"><b>Swipe →</b><span>1 / 5</span></div>
    <div class="grain"></div>
  </body></html>`;
}

const CARDS = [
  { file: 'w8-p1-book-sha.png', html: bookSha },
  { file: 'w8-p2-ladder.png', html: ladder },
  { file: 'w8-p3-followed.png', html: followed },
  { file: 'w8-c1-1.png', html: cover },
  {
    file: 'w8-c1-2.png',
    html: () =>
      stepSlide({
        n: '1', of: 5, kicker: 'Step one · the chat', bg: FIG, fg: CREAM, acc: GOLD, cta: 'Price before anything starts', tags: ['Hair history', 'Your diary', 'Price first'],
        title: 'We talk first.',
        body: 'Your hair history, your diary, the result you are after. You get the price before a single bowl is mixed.',
        photo: 'site/site-01-salon-interior-final.jpg', pos: 'width:900px;height:1200px;left:-240px;top:-220px',
      }),
  },
  {
    file: 'w8-c1-3.png',
    html: () =>
      stepSlide({
        n: '2', of: 5, kicker: 'Step two · the colour', bg: CREAM, fg: INK, acc: FIG, cta: 'Placed by hand, by Sha', tags: ['Hand-placed', 'No hand-offs', 'One chair'],
        title: 'Only one pair of hands.',
        body: 'No apprentice, no second chair, no hand-off halfway through. The person you booked is the person doing it.',
        // site-05 shows a client's face; this is Sha's hands and foil only.
        photo: 'site/site-02-sha-at-work-2.jpg', pos: 'width:1090px;height:1453px;left:-330px;top:-610px',
      }),
  },
  {
    file: 'w8-c1-4.png',
    html: () =>
      stepSlide({
        n: '3', of: 5, kicker: 'Step three · the toner', bg: INK, fg: CREAM, acc: GOLD, cta: 'The step worth not rushing', tags: ['Unrushed', 'Tone matched', 'Glossed'],
        title: 'Where the tone is decided.',
        body: 'It gets the time it needs, because nobody else is waiting for the chair. This is the part most colour lives or dies on.',
        photo: 'site/site-09-sleek-blonde-highlights.jpg', pos: 'width:620px;height:930px;left:-80px;top:-60px',
      }),
  },
  {
    file: 'w8-c1-5.png',
    html: () =>
      stepSlide({
        n: '4', of: 5, kicker: 'Step four · the finish', bg: CLAY, fg: INK, acc: FIG, cta: 'DM me to book yours', tags: ['Blow wave', 'Next date set', 'Formula on file'],
        title: 'Then we plan the next one.',
        body: 'Blow wave, then your next date mapped before you leave, so the colour never needs rescuing.',
        photo: 'blog/blog-03-IMG_8353.jpg', pos: 'width:620px;height:1102px;left:-80px;top:-170px',
      }),
  },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromiumPath() });
const scratch = join(PHOTOS, '.w8-card.html');
for (const c of CARDS) {
  writeFileSync(scratch, c.html());
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await page.goto(`file://${scratch}`, { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))).then(() => document.fonts.ready));
  writeFileSync(join(OUT, c.file), await page.screenshot({ type: 'png' }));
  console.log('  ' + c.file);
  await page.close();
}
await browser.close();
rmSync(scratch, { force: true });
console.log(`\nDone — ${CARDS.length} cards.`);
