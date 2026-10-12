#!/usr/bin/env node
// Render the reel: every frame of reel/notify.html at 30 fps, 1080x1920, with
// the voice from reel/out/vo.wav. About 13 minutes — probe first
// (tools/probe-reel.mjs); almost every framing mistake shows in one frame.
//
//   node tools/render-reel.mjs            # needs reel/out/vo.wav (tools/cut-vo.mjs)
//   node tools/render-reel.mjs --silent   # picture only, for checking motion
//
// writes reel/out/kairo-notify.mp4 and prints its measured loudness — the
// person rendering this cannot hear it, so the numbers are the check.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'reel', 'out');
const FPS = 30;
const SILENT = process.argv.includes('--silent');
const vo = path.join(OUT, 'vo.wav');
const timeline = JSON.parse(fs.readFileSync(path.join(OUT, 'timeline.json'), 'utf8'));
if (!SILENT && (!fs.existsSync(vo) || timeline.estimated)) {
  console.error('No real voice yet: reel/out/vo.wav is missing or the timeline is an estimate. Generate the voice, run tools/vo-spans.mjs, paste LINES into tools/cut-vo.mjs, run it — or use --silent.');
  process.exit(2);
}
const inject = {
  TIMELINE: timeline,
  BRAND: JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'brand.json'), 'utf8')),
  SHOTMETA: JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'screenshots', 'kairo-notify-prompt.json'), 'utf8')),
};
const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--force-color-profile=srgb'] });
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.addInitScript((d) => Object.assign(window, d), inject);
await page.goto('file://' + path.join(ROOT, 'reel', 'notify.html'));
await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready);
const D = await page.evaluate(() => window.DURATION);
const frames = Math.round(D * FPS);

const picture = path.join(OUT, SILENT ? 'kairo-notify-silent.mp4' : '.picture.mp4');
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1', '-movflags', '+faststart', picture], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.seek(t), i / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 120 === 0) console.log(`frame ${i}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close();
if (errs.length) console.log('page errors:', errs);
if (SILENT) { console.log(`wrote ${path.relative(ROOT, picture)} (no sound)`); process.exit(0); }

const final = path.join(OUT, 'kairo-notify.mp4');
const mux = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', picture, '-i', vo, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', final], { stdio: 'inherit' });
if (mux.status !== 0) process.exit(1);
fs.rmSync(picture, { force: true });
const loud = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', final, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.split('Summary:').pop();
const pick = (re) => (re.exec(loud) || [])[1];
console.log(`wrote ${path.relative(ROOT, final)}: ${D.toFixed(2)} s, ${frames} frames`);
console.log(`measured: integrated ${pick(/I:\s+(-?[\d.]+) LUFS/)} LUFS, LRA ${pick(/LRA:\s+([\d.]+) LU/)} LU, true peak ${pick(/Peak:\s+(-?[\d.]+) dBFS/)} dBFS (target -14 LUFS, peak under -1)`);
