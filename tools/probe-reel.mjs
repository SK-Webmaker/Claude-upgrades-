#!/usr/bin/env node
// Look at the reel before rendering it. A full render is ~13 minutes and almost
// every framing mistake is visible in one frame, so this seeks the stage to a
// handful of moments, measures what is on screen with getBoundingClientRect
// (never by eyeballing a screenshot), and lays the frames out as a contact sheet.
//
//   node tools/probe-reel.mjs                 # 3 frames per shot: in, middle, out
//   node tools/probe-reel.mjs --at 0.5,7.2    # just these moments
//
// Checks, per frame:
//   frame     every [data-probe] element sits inside 1080x1920
//   safe      text stays clear of Instagram's own furniture: 230 px at the top,
//             380 px at the bottom (caption, buttons), 60 px left and right
//   size      no text under 40 px — it is read on a phone at arm's length
//   overflow  no line wider than its box
//   still     the frame 0.1 s later differs (a reel that stops moving reads as paused)
//   shots     no shot longer than ~3 s
// Writes reel/out/probe/*.png, report.json and sheet.png.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'reel', 'out', 'probe');
const SAFE = { left: 60, right: 1020, top: 230, bottom: 1540 };
const MAX_SHOT = 3.1;
const args = process.argv.slice(2);
const atArg = (() => { const i = args.indexOf('--at'); return i >= 0 ? args[i + 1].split(',').map(Number) : null; })();

const timelineFile = path.join(ROOT, 'reel', 'out', 'timeline.json');
if (!fs.existsSync(timelineFile)) { console.error('No reel/out/timeline.json — run node tools/cut-vo.mjs (or --estimate) first.'); process.exit(2); }
const inject = {
  TIMELINE: JSON.parse(fs.readFileSync(timelineFile, 'utf8')),
  BRAND: JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'brand.json'), 'utf8')),
  SHOTMETA: JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'screenshots', 'kairo-notify-prompt.json'), 'utf8')),
};

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--force-color-profile=srgb'] });
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.addInitScript((d) => Object.assign(window, d), inject);
await page.goto('file://' + path.join(ROOT, 'reel', 'notify.html'));
await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready);
const shots = await page.evaluate(() => window.SHOTS);
const duration = await page.evaluate(() => window.DURATION);

const times = atArg || shots.flatMap((s) => [s.from + 0.06, (s.from + s.to) / 2, s.to - 0.06]).map((t) => +Math.min(t, duration - 0.02).toFixed(2));

const measure = () => page.evaluate((SAFE) => {
  const visible = (el) => { for (let e = el; e && e.id !== 'f'; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) return false; } return true; };
  const shot = [...document.querySelectorAll('.shot')].find((s) => getComputedStyle(s).visibility === 'visible')?.id || '';
  const items = [...document.querySelectorAll('[data-probe]')].filter(visible).map((el) => {
    const r = el.getBoundingClientRect(); const fs = parseFloat(getComputedStyle(el).fontSize);
    // the words themselves, not the box they sit in
    const range = document.createRange(); range.selectNodeContents(el); const t = range.getBoundingClientRect();
    const box = t.width ? t : r;
    const issues = [];
    if (box.left < 0 || box.top < 0 || box.right > 1080 || box.bottom > 1920) issues.push('frame');
    if (box.left < SAFE.left || box.right > SAFE.right || box.top < SAFE.top || box.bottom > SAFE.bottom) issues.push('safe');
    if (fs < 40) issues.push('size');
    if (el.scrollWidth > el.clientWidth + 2) issues.push('overflow');
    return { id: el.id, text: el.innerText.replace(/\s+/g, ' ').trim().slice(0, 60), rect: [Math.round(box.left), Math.round(box.top), Math.round(box.right), Math.round(box.bottom)], fontSize: fs, issues };
  });
  return { shot, items };
}, SAFE);

const report = { duration, shots: shots.map((s) => ({ ...s, length: +(s.to - s.from).toFixed(2), tooLong: s.to - s.from > MAX_SHOT })), frames: [] };
for (const t of times) {
  await page.evaluate((t) => window.seek(t), t); await page.waitForTimeout(30);
  const file = path.join(OUT, `t${t.toFixed(2).padStart(6, '0')}.png`);
  await page.screenshot({ path: file });
  const m = await measure();
  await page.evaluate((t) => window.seek(t), Math.min(t + 0.1, duration)); await page.waitForTimeout(20);
  const next = path.join(OUT, '.next.png'); await page.screenshot({ path: next });
  const psnr = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-i', next, '-lavfi', 'psnr', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const avg = /average:(\S+)/.exec(psnr)?.[1];
  const still = avg === 'inf' || Number(avg) > 60;
  report.frames.push({ t, file: path.basename(file), shot: m.shot.replace('s-', ''), still, psnr: avg, items: m.items });
}
fs.rmSync(path.join(OUT, '.next.png'), { force: true });

// The contact sheet: every probed frame, labelled with its time and shot, problems in red.
const cells = report.frames.map((f) => {
  const bad = f.items.flatMap((i) => i.issues.map((x) => `${i.id}:${x}`)).concat(f.still ? ['still'] : []);
  return `<figure><img src="${f.file}"><figcaption><b>${f.t.toFixed(2)} s</b> · ${f.shot}${bad.length ? ` <i>${bad.join(' ')}</i>` : ''}</figcaption></figure>`;
}).join('');
fs.writeFileSync(path.join(OUT, 'sheet.html'), `<!doctype html><meta charset=utf-8><style>
  body{margin:0;background:#11151c;font:600 22px/1.3 sans-serif;color:#cfd6e2;width:${6 * 300 + 7 * 14}px;padding:14px;box-sizing:border-box;display:flex;flex-wrap:wrap;gap:14px}
  figure{margin:0;width:300px} img{width:300px;height:533px;display:block;border-radius:10px;outline:1px solid #2a3240}
  figcaption{padding:6px 2px 0} i{color:#ff6b6b;font-style:normal;display:block;font-size:18px}</style>${cells}`);
const sheet = await b.newPage({ viewport: { width: 6 * 300 + 7 * 14, height: 900 } });
await sheet.goto('file://' + path.join(OUT, 'sheet.html'));
await sheet.screenshot({ path: path.join(OUT, 'sheet.png'), fullPage: true });
await b.close();

report.errors = errs;
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
const problems = report.frames.flatMap((f) => f.items.filter((i) => i.issues.length).map((i) => `${f.t.toFixed(2)} ${f.shot} ${i.id} [${i.issues.join(',')}] ${i.rect.join(',')} "${i.text}"`)
  .concat(f.still ? [`${f.t.toFixed(2)} ${f.shot} STILL (psnr ${f.psnr})`] : []));
console.log(`probed ${report.frames.length} frames over ${duration.toFixed(2)} s; ${shots.length} shots, longest ${Math.max(...report.shots.map((s) => s.length)).toFixed(2)} s`);
report.shots.filter((s) => s.tooLong).forEach((s) => console.log(`  SHOT TOO LONG: ${s.id} ${s.length} s`));
problems.forEach((p) => console.log('  ' + p));
if (errs.length) console.log('  page errors:', errs);
console.log(`contact sheet: ${path.relative(process.cwd(), path.join(OUT, 'sheet.png'))}`);
process.exit(problems.length || errs.length || report.shots.some((s) => s.tooLong) ? 1 : 0);
