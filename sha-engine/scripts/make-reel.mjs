#!/usr/bin/env node
/**
 * Builds an actual Reel. Not a cover and a shot list — a finished 1080x1920 MP4
 * she can upload.
 *
 * ---------------------------------------------------------------------------
 * The palette — "the studio palette"
 *
 * Taken from her own room rather than invented. Every photograph off her site
 * has the same four things in it: a big fiddle-leaf fig, warm timber floor,
 * cream walls, and window light. So the new colours are FIG (a deep muted
 * green) and CLAY (the timber), sitting with the existing brand ink, cream and
 * gold. That gives her something no other salon in Camberwell is using, and it
 * is defensible because it is literally the room clients walk into.
 *
 * The previous palettes were a marigold campaign colour and a red ticket stamp.
 * Both were borrowed ideas. This one belongs to the business.
 *
 * ---------------------------------------------------------------------------
 * How it is made
 *
 * Chromium renders every frame as a still PNG, so the type is exact — image
 * models mangle real words and a malformed price is worse than no card.
 * ffmpeg then does only motion and transitions: a slow zoompan push on each
 * scene, cross-dissolved with xfade. That split matters — text never goes near
 * a video filter, so it stays crisp.
 *
 * Scenes are rendered at 2x (2160x3840) and zoompan'd down to 1080x1920.
 * zoompan on a same-size input produces visible stepping; oversampling first is
 * what makes the push read as smooth.
 *
 * Format follows what the research says is working for salons in 2026: open on
 * the desired result, then a wrong-vs-right pairing rather than a list of tips.
 *   https://www.glammatic.com/post/5-viral-instagram-reel-trends-your-salon-must-try-today
 *   https://www.socialmon.ai/blog/70-salon-instagram-post-ideas-that-actually-drive-bookings-in-2026
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const BLOG = join(ROOT, 'content', 'photos', 'blog');
const OUT = join(ROOT, 'content', 'reels');
const WORK = join(OUT, '.frames');

/* ---------------- the studio palette ---------------- */
const INK = '#12100E';
const CREAM = '#F6F1E9';
const GOLD = '#C08B3E';
const FIG = '#2F4032';   // fiddle-leaf green, from the plants in every photo
const CLAY = '#C9A88B';  // warm timber, from the floor
const RUST = '#9C4A2F';  // the "don't" marker. Muted, not a warning triangle.

const FONTS = readFileSync(join(ROOT, 'assets', 'fonts', 'brand-fonts.css'), 'utf8');
const W = 2160, H = 3840;          // render at 2x, encode at 1080x1920
const FPS = 30;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const chromiumPath = () =>
  [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p)) || undefined;

function base() {
  return `${FONTS}
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${W}px;height:${H}px;overflow:hidden}
    body{position:relative;background:${INK};font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}
    .fr{font-family:'Fraunces',serif;font-weight:400;font-variation-settings:'opsz' 144;
        letter-spacing:-.03em;line-height:.94}
    .photo{position:absolute;inset:0;background-size:cover;background-position:center 32%}
    .eyebrow{font-size:42px;letter-spacing:.3em;text-transform:uppercase;font-weight:700}
    .rule{height:8px;width:200px;background:${GOLD}}
    /* Everything lives inside the band Instagram's own UI leaves alone:
       it covers roughly the bottom 700px and the right 360px at this scale.
       Photo scenes anchor to the bottom because the photograph fills the rest;
       flat scenes centre, or the type sits in a corner of an empty field. */
    .safe{position:absolute;left:148px;right:420px;top:300px;bottom:760px;
          display:flex;flex-direction:column;justify-content:flex-end;gap:52px}
    .safe.mid{justify-content:center}
    .num{font-family:'Inter',sans-serif;font-variation-settings:normal;font-weight:700;
         font-variant-numeric:tabular-nums}`;
}

/* An arc of the fig colour — the recurring shape of the system. Organic, and it
   echoes the round mirrors and the plants without being a literal leaf. */
const arc = (c, size, x, y, op = 1) =>
  `<div style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;
     background:${c};left:${x}px;top:${y}px;opacity:${op}"></div>`;

/* ---------------- scene kinds ---------------- */

function photoScene(s) {
  return `<html><head><meta charset="utf-8"><style>${base()}
    .photo{background-image:url('${s.photo}')}
    .tint{position:absolute;inset:0;background:${s.tint || 'rgba(47,64,50,.30)'};mix-blend-mode:multiply}
    .scrim{position:absolute;inset:0;background:linear-gradient(180deg,
      rgba(18,16,14,.52) 0%, rgba(18,16,14,.10) 26%, rgba(18,16,14,.40) 58%,
      rgba(18,16,14,.92) 84%, rgba(18,16,14,.99) 100%)}
    h1{font-size:${s.size || 190}px;color:${CREAM};text-shadow:0 4px 70px rgba(0,0,0,.55)}
    .sup{font-size:60px;line-height:1.4;color:rgba(246,241,233,.92);font-weight:500;max-width:19ch}
    .top{position:absolute;left:148px;top:190px;display:flex;gap:34px;align-items:center}
  </style></head><body>
    <div class="photo"></div><div class="tint"></div><div class="scrim"></div>
    ${s.eyebrow ? `<div class="top"><span class="rule"></span><span class="eyebrow" style="color:${GOLD}">${esc(s.eyebrow)}</span></div>` : ''}
    <div class="safe">
      <h1 class="fr">${s.title}</h1>
      ${s.support ? `<p class="sup">${esc(s.support)}</p>` : ''}
    </div>
  </body></html>`;
}

/* Flat colour field. This is the look the operator asked for — the Sunday
   campaign language, evolved onto the studio palette. */
function fieldScene(s) {
  const bg = s.bg || FIG;
  const fg = s.fg || CREAM;
  return `<html><head><meta charset="utf-8"><style>${base()}
    body{background:${bg}}
    h1{font-size:${s.size || 210}px;color:${fg}}
    .sup{font-size:62px;line-height:1.38;color:${s.supColor || 'rgba(246,241,233,.82)'};font-weight:500;max-width:20ch}
    .top{position:absolute;left:148px;top:190px;display:flex;gap:34px;align-items:center}
    .kick{font-size:52px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:${s.kickColor || GOLD}}
  </style></head><body>
    ${s.arcs || ''}
    ${s.eyebrow ? `<div class="top"><span class="rule" style="background:${s.kickColor || GOLD}"></span><span class="eyebrow" style="color:${s.kickColor || GOLD}">${esc(s.eyebrow)}</span></div>` : ''}
    <div class="safe mid">
      ${s.kick ? `<p class="kick">${esc(s.kick)}</p>` : ''}
      <h1 class="fr">${s.title}</h1>
      ${s.support ? `<p class="sup">${esc(s.support)}</p>` : ''}
    </div>
  </body></html>`;
}

/* The "don't". Struck through, rust marker — the visual opposite of the do. */
function dontScene(s) {
  return `<html><head><meta charset="utf-8"><style>${base()}
    body{background:${INK}}
    .kick{font-size:52px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:${RUST}}
    h1{font-size:${s.size || 186}px;color:${CREAM};
       text-decoration:line-through;text-decoration-color:${RUST};text-decoration-thickness:12px}
    .sup{font-size:58px;line-height:1.4;color:rgba(246,241,233,.7);font-weight:500;max-width:22ch}
  </style></head><body>
    ${arc(RUST, 1900, -700, 1500, 0.16)}
    ${arc(RUST, 420, 1500, 900, 0.5)}
    <div class="safe mid">
      <p class="kick">Don't &nbsp;&middot;&nbsp; ${esc(s.n)}</p>
      <h1 class="fr">${s.title}</h1>
      ${s.support ? `<p class="sup">${esc(s.support)}</p>` : ''}
    </div>
  </body></html>`;
}

/* ---------------- the reel ---------------- */
const SCENES = [
  // Open on the desired result, per the 2026 salon research — the "before" is
  // only interesting once you already care about the after.
  { kind: 'photo', dur: 3.0, photo: 'blog-03-IMG_8353.jpg', eyebrow: 'Hair by Sha · Camberwell',
    size: 178, tint: 'rgba(47,64,50,.22)',
    title: 'This is what<br>six weeks<br>later should<br>look like.' },

  { kind: 'field', dur: 2.6, bg: FIG, kick: 'Colour care',
    title: 'Four things<br>quietly<br>wrecking it.', size: 200,
    arcs: arc(CLAY, 1300, 1250, 220, 0.2) + arc(GOLD, 700, -240, 2900, 0.16) },

  { kind: 'dont', dur: 2.3, n: 'One', title: 'Washing it<br>the day you<br>get home.',
    support: 'The cuticle is still open. Everything you paid for goes down the drain.' },
  { kind: 'photo', dur: 2.3, photo: 'blog-02-IMG_0432.jpg', size: 176, tint: 'rgba(47,64,50,.34)',
    title: 'Give it<br>48 hours.', support: 'Then the toner has something to hold on to.' },

  { kind: 'dont', dur: 2.3, n: 'Two', title: 'Hot water.',
    support: 'Heat opens the cuticle every single wash, and the tone leaves with it.' },
  { kind: 'photo', dur: 2.3, photo: 'blog-04-IMG_0433.jpg', size: 176, tint: 'rgba(47,64,50,.34)',
    title: 'Rinse it<br>lukewarm.', support: 'The cheapest thing on this list, and the one that works most.' },

  { kind: 'dont', dur: 2.3, n: 'Three', title: 'Purple<br>shampoo,<br>every wash.',
    support: 'It is a toner, not a shampoo. Daily use turns blonde grey and flat.' },
  { kind: 'field', dur: 2.3, bg: CLAY, fg: INK, kickColor: FIG, supColor: 'rgba(18,16,14,.72)',
    kick: 'Do', title: 'Once a week<br>is plenty.', size: 186,
    support: 'And leave it on for two minutes, not ten.',
    arcs: arc(FIG, 1100, 1400, 2600, 0.18) },

  { kind: 'dont', dur: 2.3, n: 'Four', title: 'Straightener<br>on its<br>highest heat.',
    support: 'Coloured hair does not need 230 degrees. It needs less than you think.' },
  { kind: 'photo', dur: 2.3, photo: 'blog-01-IMG_0435.jpg', size: 176, tint: 'rgba(47,64,50,.34)',
    title: '185 is<br>enough.', support: 'Above that you are cooking the colour out of it.' },

  { kind: 'field', dur: 3.4, bg: CREAM, fg: INK, kickColor: FIG, supColor: 'rgba(18,16,14,.72)',
    kick: 'Hair by Sha · Camberwell', title: 'Book the gloss<br>before it<br>goes.', size: 176,
    support: 'Toner & gloss · $45 · 45 minutes. Sundays now open, 10 til 2.',
    arcs: arc(FIG, 1500, 1200, -300, 0.13) + arc(GOLD, 900, -300, 3000, 0.2) },
];

/* ---------------- render ---------------- */
mkdirSync(OUT, { recursive: true });
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

const scratch = join(BLOG, '.reel-render.html');
const browser = await chromium.launch({ executablePath: chromiumPath() });

console.log('Rendering scenes at 2x…');
for (let i = 0; i < SCENES.length; i++) {
  const s = SCENES[i];
  const html = s.kind === 'photo' ? photoScene(s) : s.kind === 'dont' ? dontScene(s) : fieldScene(s);
  writeFileSync(scratch, html);
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(`file://${scratch}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
  const f = join(WORK, `s${String(i).padStart(2, '0')}.png`);
  writeFileSync(f, await page.screenshot({ type: 'png' }));
  await page.close();
  console.log(`  scene ${i + 1}/${SCENES.length}  ${s.kind}  ${s.dur}s`);
}
await browser.close();
rmSync(scratch, { force: true });

/* Each scene becomes a segment with a slow push. Alternating the zoom direction
   stops the whole reel drifting one way, which reads as a slideshow. */
console.log('\nEncoding segments…');
const XF = 0.45; // cross-dissolve length
for (let i = 0; i < SCENES.length; i++) {
  const s = SCENES[i];
  const frames = Math.round(s.dur * FPS);
  const inZoom = i % 2 === 0;
  const z = inZoom
    ? `min(1.0+0.00075*on,1.10)`     // slow push in
    : `max(1.10-0.00075*on,1.0)`;    // slow pull out
  // zoompan's `d` emits d frames for EVERY input frame. With `-loop 1 -t dur`
  // the input is dur*fps frames, so d=frames produced frames^2 — a 3s scene
  // became 270s. Feed it exactly one input frame and cap the output instead.
  execFileSync(
    ffmpegPath,
    [
      '-y', '-loop', '1', '-i', join(WORK, `s${String(i).padStart(2, '0')}.png`),
      '-filter_complex',
      `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=${FPS},format=yuv420p`,
      '-frames:v', String(frames),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-r', String(FPS),
      join(WORK, `v${String(i).padStart(2, '0')}.mp4`),
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  process.stdout.write(`  ${i + 1}`);
}

console.log('\n\nCross-dissolving…');
const inputs = [];
SCENES.forEach((_, i) => inputs.push('-i', join(WORK, `v${String(i).padStart(2, '0')}.mp4`)));

// xfade chains pairwise; each transition shortens the timeline by XF, so the
// offset for step n is the running total of durations so far minus n*XF.
let filter = '';
let prev = '[0:v]';
let offset = SCENES[0].dur;
for (let i = 1; i < SCENES.length; i++) {
  const out = i === SCENES.length - 1 ? '[vout]' : `[x${i}]`;
  filter += `${prev}[${i}:v]xfade=transition=fade:duration=${XF}:offset=${(offset - XF).toFixed(3)}${out};`;
  offset = offset - XF + SCENES[i].dur;
  prev = `[x${i}]`;
}
filter = filter.replace(/;$/, '');

const finalPath = join(OUT, 'w6-reel-colour-care.mp4');
execFileSync(
  ffmpegPath,
  [...['-y'], ...inputs, '-filter_complex', filter, '-map', '[vout]',
   '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
   '-movflags', '+faststart', '-r', String(FPS), finalPath],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);

const total = SCENES.reduce((n, s) => n + s.dur, 0) - XF * (SCENES.length - 1);
console.log(`\nDone → ${finalPath}`);
console.log(`  ${SCENES.length} scenes, ~${total.toFixed(1)}s, 1080x1920, no audio (add in-app)`);

// Keep the first frame as the cover.
execFileSync(ffmpegPath, ['-y', '-i', finalPath, '-frames:v', '1', join(OUT, 'w6-reel-cover.png')],
  { stdio: ['ignore', 'ignore', 'pipe'] });
console.log(`  cover → ${join(OUT, 'w6-reel-cover.png')}`);
console.log(`  work frames kept in ${WORK} (delete when happy)`);
