#!/usr/bin/env node
// Lay the voice out for the reel: each line cut from the take, placed after
// the last with that line's own gap (reel/notify.json, gapAfter), normalised
// for Instagram, and the timeline the picture follows written beside it.
//
//   node tools/cut-vo.mjs              # from the voice take below
//   node tools/cut-vo.mjs --estimate   # no voice yet: time the lines from word counts
//
// writes reel/out/vo.wav (not in --estimate) and reel/out/timeline.json
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// The take, and where each line sits in it.
//
// THESE SPANS ARE HARDCODED AND GO STALE THE INSTANT THE VOICE CHANGES.
// After regenerating the voice, run
//   node tools/vo-spans.mjs reel/vo/kairo-notify.mp3
// and paste what it prints over LINES. Never edit the numbers by hand.
const VO = 'reel/vo/kairo-notify.mp3';
const LINES = [
  // ['hook', 0.00, 0.00],  — no take yet (the voice waits on the Higgsfield account)
];

const ESTIMATE = process.argv.includes('--estimate');
const LEAD = 0.08;          // the hook is spoken on frame three, not after a title
const PRE = 0.06, POST = 0.12; // air either side of each cut
const WPS = 2.9;            // a quick, conversational read, for --estimate only

const script = JSON.parse(fs.readFileSync('reel/notify.json', 'utf8'));
fs.mkdirSync('reel/out', { recursive: true });

const spans = ESTIMATE
  ? script.lines.map((l) => { const w = l.say.split(/\s+/).length; return [l.id, 0, w / WPS + (/[.,]$/.test(l.say) ? 0.05 : 0)]; })
  : LINES;
if (!ESTIMATE && (!fs.existsSync(VO) || !LINES.length)) {
  console.error(`No voice take yet (${VO}) or LINES is empty. Use --estimate to plan, or generate the voice and run tools/vo-spans.mjs.`);
  process.exit(2);
}
if (spans.length !== script.lines.length || spans.some(([id], i) => id !== script.lines[i].id)) {
  console.error('LINES does not match reel/notify.json line for line. Re-run tools/vo-spans.mjs and paste its output.');
  process.exit(1);
}

// Identical pauses are what make a synthetic voice sound synthetic.
const gaps = script.lines.slice(0, -1).map((l) => l.gapAfter);
const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
const spread = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
if (spread < 0.08) console.warn(`warning: the gaps barely vary (spread ${spread.toFixed(2)} s) — vary them`);

let t = LEAD;
const placed = spans.map(([id, a, b], i) => {
  const line = script.lines[i];
  const from = ESTIMATE ? 0 : Math.max(0, a - PRE);
  const to = ESTIMATE ? b : b + POST;
  const start = t + (ESTIMATE ? 0 : a - from);           // when the first word lands
  const end = start + (b - a);
  const p = { id, say: line.say, scene: line.scene, start: +start.toFixed(3), end: +end.toFixed(3), cut: [from, to], at: t };
  t = t + (to - from) - (ESTIMATE ? 0 : POST) + line.gapAfter;
  return p;
});
const duration = +(placed[placed.length - 1].end + script.tail).toFixed(3);
const timeline = { id: script.id, estimated: ESTIMATE, duration, lines: placed.map(({ cut, at, ...rest }) => rest) };
fs.writeFileSync('reel/out/timeline.json', JSON.stringify(timeline, null, 2));

const [lo, hi] = script.target;
console.log(`${ESTIMATE ? 'estimated' : 'cut'}: ${duration.toFixed(2)} s (target ${lo}–${hi})${duration > hi ? '  ← OVER THE CAP' : duration < lo ? '  ← short' : ''}`);
placed.forEach((p) => console.log(`  ${p.start.toFixed(2).padStart(6)} – ${p.end.toFixed(2).padStart(6)}  ${p.id.padEnd(7)} ${p.say}`));
if (ESTIMATE) process.exit(0);

// The voice track: each line at its place, then -14 LUFS / -1.5 dBTP for Instagram.
const parts = placed.map((p, i) => {
  const [from, to] = p.cut, len = to - from;
  return `[0:a]atrim=start=${from.toFixed(3)}:end=${to.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.015,`
    + `afade=t=out:st=${(len - 0.05).toFixed(3)}:d=0.05,adelay=${Math.round(p.at * 1000)}:all=1[v${i}]`;
});
const graph = `${parts.join(';')};${placed.map((_, i) => `[v${i}]`).join('')}amix=inputs=${placed.length}:normalize=0,`
  + `highpass=f=75,apad,atrim=end=${duration},loudnorm=I=-14:TP=-1.5:LRA=7,aresample=48000[out]`;
const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', VO, '-filter_complex', graph, '-map', '[out]', '-ac', '2', 'reel/out/vo.wav'], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);
console.log(`wrote ${path.join('reel', 'out', 'vo.wav')} and timeline.json`);
