#!/usr/bin/env node
// Lay a voice-over on a reel rendered slower for it, one line per file, each on its beat:
//
//   node tools/render-page.mjs noshow --tempo 100 --beats 37.5 --as noshow-vo
//   node tools/mix-vo.mjs noshow        # reel/vo/noshow.json → reel/out/noshow-voiceover.mp4
//
// reel/vo/<name>.json: { tempo, beats, lines: [{ beat, file, text }] }. Each line's
// leading and trailing silence is trimmed, so `beat` is where the first word lands.
// The output carries the voice over the sound effects and no music, for posting
// under a trending sound at low volume.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'reel', 'out');
const name = process.argv[2];
const spec = name && path.join(ROOT, 'reel', 'vo', `${name}.json`);
if (!spec || !fs.existsSync(spec)) { console.error('usage: node tools/mix-vo.mjs <name>  (reads reel/vo/<name>.json)'); process.exit(2); }
const { tempo, beats, lines } = JSON.parse(fs.readFileSync(spec, 'utf8'));
const video = path.join(OUT, `${name}-vo-nomusic.mp4`);
if (!fs.existsSync(video)) { console.error(`render it first: node tools/render-page.mjs ${name} --tempo ${tempo} --beats ${beats} --as ${name}-vo`); process.exit(2); }
const sec = (beat) => beat * 60 / tempo, D = sec(beats);

const ff = (args) => spawnSync('ffmpeg', ['-hide_banner', '-y', ...args], { encoding: 'utf8' });
const duration = (f) => { const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(ff(['-i', f]).stderr); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : NaN; };

// Trim each line to its words (silence below -45 dB at either end), as 48 kHz mono.
const tmp = path.join(OUT, `.${name}-vo`); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp);
const trim = 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse';
let prevEnd = 0, bad = 0;
const placed = lines.map((l, i) => {
  const src = path.join(ROOT, 'reel', 'vo', name, l.file), out = path.join(tmp, `${i}.wav`);
  const r = ff(['-loglevel', 'error', '-i', src, '-af', trim, '-ac', '1', '-ar', '48000', out]);
  if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
  const at = sec(l.beat), len = duration(out), end = at + len;
  const warn = at < prevEnd + 0.08 ? `  ← starts ${(prevEnd + 0.08 - at).toFixed(2)} s too early` : end > D - 0.15 ? '  ← runs past the end' : '';
  if (warn) bad++;
  console.log(`${at.toFixed(2).padStart(6)}–${end.toFixed(2).padEnd(6)} ${l.text}${warn}`);
  prevEnd = end;
  return { out, at };
});
if (bad) { console.error(`${bad} line(s) collide; move their beats in ${path.relative(ROOT, spec)}`); process.exit(1); }

// Voice up front; the effects (already in the -vo-nomusic render) sit 5 dB under it.
const inputs = placed.flatMap((p) => ['-i', p.out]);
const delays = placed.map((p, i) => `[${i + 1}:a]adelay=${Math.round(p.at * 1000)}:all=1[v${i}]`).join(';');
const graph = `${delays};${placed.map((_, i) => `[v${i}]`).join('')}amix=inputs=${placed.length}:normalize=0,loudnorm=I=-16:TP=-2:LRA=7[vo];`
  + `[0:a]volume=-5dB[fx];[vo][fx]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.8:level=false[a]`;
const dest = path.join(OUT, `${name}-voiceover.mp4`);
const r = ff(['-loglevel', 'error', '-i', video, ...inputs, '-filter_complex', graph, '-map', '0:v', '-map', '[a]',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', D.toFixed(3), '-movflags', '+faststart', dest]);
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
fs.rmSync(tmp, { recursive: true, force: true });
const o = ff(['-nostats', '-i', dest, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr.split('Summary:').pop();
console.log(`wrote ${path.relative(ROOT, dest)}: ${D.toFixed(2)} s, ${(/I:\s+(-?[\d.]+) LUFS/.exec(o) || [])[1]} LUFS, true peak ${(/Peak:\s+(-?[\d.]+) dBFS/.exec(o) || [])[1]} dBFS`);
