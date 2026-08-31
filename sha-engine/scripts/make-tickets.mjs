#!/usr/bin/env node
/**
 * Week 4 — the ticket system.
 *
 * A deliberate break from everything before it. Weeks 1–2 were typographic
 * cards on ink and they scored 1 like each. Week 3 rebuilt on her photography
 * and scored 8 and 6 — better, still under the account average of 7.09%. The
 * Sundays campaign went bright and flat. None of those is this.
 *
 * The idea: a Sunday appointment is a ticket. Numbered, dated, one of one.
 * That is not decoration — it is the argument. Ten til two is four hours, which
 * holds exactly one big colour, so the scarcity is a timetable rather than a
 * marketing device. A ticket says that in a shape people already understand:
 * perforated edge, stub, serial number, and a stamp across the face.
 *
 * Palette is the brand's, plus one new colour doing one job. `#D4441F` appears
 * only as overprint — the rubber stamp — never as a ground. One bold move,
 * everything around it quiet.
 *
 * Fonts must come from the inlined base64 file. Chromium cannot reach
 * fonts.googleapis.com in this sandbox and falls back to Liberation Serif
 * silently, which looks like a school handout.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'content', 'cards');

const INK = '#12100E';
const CREAM = '#F6F1E9';
const STAMP = '#D4441F';
const GOLD = '#B07C33';

const FONTS = readFileSync(join(ROOT, 'assets', 'fonts', 'brand-fonts.css'), 'utf8');

// Paper, not noise. Low-frequency turbulence reads as stock; high-frequency
// reads as a bad JPEG.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='5'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

function chromiumPath() {
  return [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p)) || undefined;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The punched tear line. Circles in the ink colour sit ON the cream, reading as
 * holes punched through the stock. Positioned at the split between ticket and
 * stub — a perforation anywhere else is just a decorative border.
 */
function perf(top) {
  return `<div style="position:absolute;left:-13px;right:-13px;top:${top - 13}px;height:26px;
    background-image:radial-gradient(circle at 13px 13px, ${INK} 11px, transparent 12px);
    background-size:52px 26px;background-repeat:repeat-x;z-index:6"></div>`;
}

function base(W, H) {
  return `${FONTS}
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:${W}px;height:${H}px;overflow:hidden;position:relative;background:${INK};
         font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}
    .card{position:absolute;inset:38px;background:${CREAM};overflow:hidden}
    .grain{position:absolute;inset:0;background-image:${GRAIN};opacity:.13;
           mix-blend-mode:multiply;pointer-events:none;z-index:8}
    .fr{font-family:'Fraunces',serif;font-weight:400;font-variation-settings:'opsz' 144;
        letter-spacing:-.035em;line-height:.88}
    .lbl{font-size:19px;letter-spacing:.3em;text-transform:uppercase;font-weight:700}
    /* Inter for every numeral. Fraunces' display 3 has a flat top that reads as
       a 5 at thumbnail size. */
    .num{font-family:'Inter',sans-serif;font-variation-settings:normal;
         font-weight:700;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
    .stamp{position:absolute;border:6px solid ${STAMP};color:${STAMP};
           font-size:40px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
           padding:16px 26px;transform:rotate(-11deg);z-index:7;line-height:1.1;text-align:center;
           opacity:.92}
    .rule{height:5px;background:${INK}}
    .dash{height:0;border-top:4px dashed rgba(18,16,14,.34)}`;
}

/* ---------- 1 · the claim ticket ---------- */
function ticketHtml(c) {
  const W = 1080, H = 1350;
  return `<html><head><meta charset="utf-8"><style>${base(W, H)}
    .top{position:absolute;left:0;right:0;top:0;height:930px;padding:64px 62px 0;
         display:flex;flex-direction:column}
    .stub{position:absolute;left:0;right:0;bottom:0;height:342px;padding:52px 62px;
          display:flex;flex-direction:column;justify-content:center;gap:16px}
    .split{position:absolute;left:0;right:0;top:930px;z-index:5}
    .head{display:flex;justify-content:space-between;align-items:baseline}
    h1{font-size:250px;color:${INK};margin-top:34px}
    .date{font-size:112px;color:${INK};margin-top:24px}
    .hours{font-size:78px;color:${GOLD};margin-top:10px}
    .one{font-size:26px;font-weight:700;color:${INK};letter-spacing:.02em;
         margin-top:auto;margin-bottom:44px;max-width:22ch;line-height:1.45}
    .claim{font-size:64px;color:${INK};letter-spacing:-.02em}
    .claim b{color:${STAMP}}
    .serial{display:flex;justify-content:space-between;font-size:21px;font-weight:700;
            letter-spacing:.16em;text-transform:uppercase;color:rgba(18,16,14,.55)}
  </style></head><body>
    <div class="card">
      <div class="top">
        <div class="head">
          <span class="lbl" style="color:${GOLD}">Hair by Sha</span>
          <span class="lbl" style="color:${GOLD}">Camberwell</span>
        </div>
        <h1 class="fr">SUNDAY</h1>
        <p class="date num">${esc(c.date)}</p>
        <p class="hours num">10 — 2</p>
        <p class="one">${esc(c.note)}</p>
      </div>
      <div class="split"><div class="dash"></div></div>
      ${perf(930)}
      <div class="stub">
        <div class="serial"><span>Admit one</span><span>No. ${esc(c.serial)}</span></div>
        <p class="claim fr">DM me <b>SUNDAY</b><br>and it's yours.</p>
      </div>
      <!-- stamp is authored markup, not data — deliberately not escaped -->
      <div class="stamp" style="right:52px;top:604px">${c.stamp}</div>
      <div class="grain"></div>
    </div>
  </body></html>`;
}

/* ---------- 2 · what fits in a Sunday ---------- */
function fitsHtml(c) {
  const W = 1080, H = 1350;
  const rows = c.rows
    .map(
      (r) => `<div class="row${r.full ? ' full' : ''}">
        <span class="svc">${esc(r.what)}</span>
        <span class="dots"></span>
        <span class="tm num">${esc(r.time)}</span>
      </div>`,
    )
    .join('');
  return `<html><head><meta charset="utf-8"><style>${base(W, H)}
    .card{padding:64px 62px 56px;display:flex;flex-direction:column}
    .head{display:flex;justify-content:space-between;align-items:baseline}
    h1{font-size:96px;color:${INK};margin-top:30px;max-width:15ch}
    .win{font-size:22px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;
         color:${GOLD};margin-top:26px}
    .rows{margin-top:30px;display:flex;flex-direction:column;flex:1;justify-content:center}
    .row{display:flex;align-items:baseline;gap:16px;padding:30px 0;
         border-bottom:2px solid rgba(18,16,14,.16)}
    .svc{font-size:37px;font-weight:600;color:${INK};white-space:nowrap}
    .dots{flex:1;border-bottom:3px dotted rgba(18,16,14,.3);transform:translateY(-8px)}
    .tm{font-size:37px;color:${INK};white-space:nowrap}
    .row.full .svc,.row.full .tm{color:${STAMP}}
    .row.full{border-bottom-color:${STAMP}}
    .kick{margin-top:34px;font-size:38px;line-height:1.32;color:${INK};max-width:23ch}
    .kick b{color:${STAMP}}
    .cta{margin-top:30px;background:${INK};color:${CREAM};font-size:25px;font-weight:700;
         letter-spacing:.14em;text-transform:uppercase;padding:24px 30px;text-align:center}
  </style></head><body>
    <div class="card">
      <div class="head">
        <span class="lbl" style="color:${GOLD}">Hair by Sha</span>
        <span class="lbl" style="color:${GOLD}">Sundays 10–2</span>
      </div>
      <h1 class="fr">Everything that fits in a Sunday.</h1>
      <p class="win">Four hours. That is the whole window.</p>
      <div class="rows">${rows}</div>
      <p class="kick fr">So it's <b>one big colour</b>, or two small things. Then it's gone for a week.</p>
      <div class="cta">DM me the Sunday you want</div>
      <div class="grain"></div>
    </div>
  </body></html>`;
}

/* ---------- 3 · the correction ---------- */
function mythHtml(c) {
  const W = 1080, H = 1350;
  return `<html><head><meta charset="utf-8"><style>${base(W, H)}
    .card{padding:64px 62px 56px;display:flex;flex-direction:column}
    .head{display:flex;justify-content:space-between;align-items:baseline}
    .grow{flex:1}
    .wrong{font-size:44px;font-weight:600;color:rgba(18,16,14,.42);margin-top:44px;
           text-decoration:line-through;text-decoration-color:${STAMP};
           text-decoration-thickness:5px;max-width:20ch;line-height:1.25}
    h1{font-size:104px;color:${INK};margin-top:30px;max-width:13ch}
    .body{font-size:35px;line-height:1.45;color:rgba(18,16,14,.78);margin-top:34px;max-width:26ch}
    /* The card has to earn a save, and a save comes from the practical half —
       the bit someone wants back in six weeks, not the explanation. */
    .split2{display:flex;gap:0;margin-top:40px;border-top:3px solid rgba(18,16,14,.2)}
    .half{flex:1;padding:26px 24px 0 0}
    .half + .half{padding-left:28px;border-left:3px solid rgba(18,16,14,.2)}
    .half h4{font-size:20px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;
             margin-bottom:14px}
    .half p{font-size:28px;line-height:1.34;color:${INK};font-weight:500}
    .foot{display:flex;justify-content:space-between;align-items:baseline;
          border-top:5px solid ${INK};padding-top:26px;margin-top:34px}
    .foot span{font-size:25px;font-weight:700;color:${INK};letter-spacing:.02em}
  </style></head><body>
    <div class="card">
      <div class="head">
        <span class="lbl" style="color:${GOLD}">Hair by Sha</span>
        <span class="lbl" style="color:${GOLD}">Colour, explained</span>
      </div>
      <p class="wrong">${esc(c.wrong)}</p>
      <h1 class="fr">${esc(c.right)}</h1>
      <p class="body">${esc(c.body)}</p>
      <div class="split2">
        <div class="half"><h4 style="color:${GOLD}">Makes it last</h4><p>${esc(c.helps)}</p></div>
        <div class="half"><h4 style="color:${STAMP}">Will not</h4><p>${esc(c.wont)}</p></div>
      </div>
      <div class="grow"></div>
      <div class="foot"><span>${esc(c.footL)}</span><span>${esc(c.footR)}</span></div>
      <div class="grain"></div>
    </div>
  </body></html>`;
}

const CARDS = [
  {
    file: 'w4-sunday-ticket.png',
    layout: 'ticket',
    date: '06 SEPTEMBER',
    serial: '01 / 01',
    stamp: 'One<br>chair only',
    note: 'Four hours, one appointment. When it is taken, the next one is a week away.',
  },
  {
    file: 'w4-what-fits.png',
    layout: 'fits',
    rows: [
      { what: 'Blonde transformation', time: '4 hrs', full: true },
      { what: 'Balayage / lived-in', time: '3 hr 30' },
      { what: 'Half foil', time: '2 hr 30' },
      { what: 'Root colour + refresh', time: '1 hr 45' },
      { what: 'Blow wave', time: '45 min' },
    ],
  },
  {
    file: 'w4-toner.png',
    layout: 'myth',
    wrong: 'My toner washed out too fast.',
    right: 'It did not wash out. It was never going to stay.',
    body: 'Toner sits on the outside of the hair. It is not permanent colour and was never meant to be — every wash takes a little with it.',
    helps: 'Cooler water. Fewer washes. A gloss booked before it has fully gone.',
    wont: 'A stronger purple shampoo. That tones the surface, it does not replace toner.',
    footL: 'Toner & Gloss',
    footR: '$45 · 45 min',
  },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromiumPath() });

for (const c of CARDS) {
  const html = c.layout === 'ticket' ? ticketHtml(c) : c.layout === 'fits' ? fitsHtml(c) : mythHtml(c);
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(join(OUT, c.file), await page.screenshot({ type: 'png' }));
  console.log('  ' + c.file);
  await page.close();
}

await browser.close();
console.log('\nDone — 3 cards.');
