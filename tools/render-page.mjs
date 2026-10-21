#!/usr/bin/env node
// Render any presenter-free reel page (reel/<name>.html) to two MP4s:
//   reel/out/<name>.mp4          the original beat (tools/beat.mjs) under the sound effects
//   reel/out/<name>-nomusic.mp4  sound effects only, for posting under a trending sound
//
//   node tools/render-page.mjs group-chat --sheet   # contact sheet only (seconds, not minutes)
//   node tools/render-page.mjs group-chat           # the full render
//
// The page sets window.DURATION, window.CUES ([time, kind] for tools/sfx.mjs),
// window.BPM, window.SHEET (times for the contact sheet) and window.seek(t),
// which may return a promise (B-roll frames load as images). Every picture is a
// function of t, so a frame here is the frame in the reel.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { buildSfx } from './sfx.mjs';
import { buildBeat } from './beat.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'reel', 'out');
const FPS = 30;
const name = process.argv[2];
const SHEET = process.argv.includes('--sheet');
if (!name || !fs.existsSync(path.join(ROOT, 'reel', `${name}.html`))) {
  console.error('usage: node tools/render-page.mjs <reel/NAME.html without .html> [--sheet]');
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

const exe = process.env.CHROME || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files', '--force-color-profile=srgb'] });
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.addInitScript((d) => Object.assign(window, d), {
  BRAND: JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'brand.json'), 'utf8')),
  FRAMES: JSON.parse(fs.readFileSync(path.join(OUT, 'broll', 'frames.json'), 'utf8')),
});
await page.goto('file://' + path.join(ROOT, 'reel', `${name}.html`));
await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready);
const { D, CUES, BPM, TIMES } = await page.evaluate(() => ({ D: window.DURATION, CUES: window.CUES || [], BPM: window.BPM || 124, TIMES: window.SHEET || [] }));

if (SHEET) {
  // One small frame per time, tiled six across, each labelled with its time.
  const times = TIMES.length ? TIMES : Array.from({ length: Math.ceil(D) }, (_, i) => i + 0.5);
  const dir = path.join(OUT, 'probe', name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const [i, t] of times.entries()) {
    await page.evaluate((x) => window.seek(x), t);
    // the time, drawn in the page (this ffmpeg has no drawtext)
    await page.evaluate((x) => { let l = document.getElementById('__t'); if (!l) { l = document.createElement('div'); l.id = '__t';
      l.style.cssText = 'position:fixed;left:16px;top:16px;z-index:99;font:700 60px sans-serif;color:#fff;background:#000c;padding:6px 16px;border-radius:12px'; document.body.appendChild(l); }
      l.textContent = x.toFixed(2) + ' s'; }, t);
    await page.screenshot({ path: path.join(dir, `${String(i).padStart(3, '0')}.png`) });
    await page.evaluate(() => document.getElementById('__t').remove());
  }
  await b.close();
  const sheet = path.join(OUT, `${name}-sheet.jpg`);
  const labels = times.map((t, i) => `[${i}:v]scale=360:-1[v${i}]`);
  const cols = Math.min(6, times.length), rows = Math.ceil(times.length / cols);
  const inputs = times.flatMap((_, i) => ['-i', path.join(dir, `${String(i).padStart(3, '0')}.png`)]);
  const graph = `${labels.join(';')};${times.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${times.length}:layout=${
    times.map((_, i) => `${(i % cols) * 360}_${Math.floor(i / cols) * 640}`).join('|')}:fill=black`;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', graph, '-q:v', '3', sheet], { stdio: 'inherit' });
  if (errs.length) console.log('page errors:', errs);
  console.log(r.status === 0 ? `wrote ${path.relative(ROOT, sheet)} (${times.length} frames, ${cols}x${rows})` : 'contact sheet failed');
  process.exit(r.status);
}

const frames = Math.round(D * FPS);
const picture = path.join(OUT, `.${name}-picture.mp4`);
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1', '-movflags', '+faststart', picture], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.seek(t), i / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 150 === 0) console.log(`frame ${i}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close();
if (errs.length) console.log('page errors:', errs);

// The person rendering this cannot hear it, so the numbers are the check.
const level = (f) => {
  const o = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.split('Summary:').pop();
  return `${(/I:\s+(-?[\d.]+) LUFS/.exec(o) || [])[1]} LUFS, true peak ${(/Peak:\s+(-?[\d.]+) dBFS/.exec(o) || [])[1]} dBFS`;
};
const sfx = buildSfx(CUES, D, path.join(OUT, `${name}-sfx.wav`), { gainDb: 0 });
const beat = buildBeat({ bpm: BPM, duration: D, out: path.join(OUT, `${name}-beat.wav`), gainDb: -2 }).out;
const mux = (audio, graph, out) => {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', picture, ...audio.flatMap((a) => ['-i', a]),
    '-filter_complex', graph, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(1);
  console.log(`wrote ${path.relative(ROOT, out)}: ${level(out)}`);
};
// Effects on their own are short hits: lifted to sit near -16 LUFS, held under -1 dBTP.
mux([sfx], '[1:a]volume=6dB,alimiter=limit=0.8:level=false[a]', path.join(OUT, `${name}-nomusic.mp4`));
mux([beat, sfx], '[1:a][2:a]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.8:level=false[a]', path.join(OUT, `${name}.mp4`));
fs.rmSync(picture, { force: true });
console.log(`${D.toFixed(2)} s, ${frames} frames, ${CUES.length} cues, ${BPM} bpm; beat alone ${level(beat)}; effects alone ${level(sfx)}`);
