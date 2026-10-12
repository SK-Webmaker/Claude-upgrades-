#!/usr/bin/env node
// Read where the speech is in a voice take, and print the LINES block that
// tools/cut-vo.mjs needs. Run it every time the voice is regenerated: the spans
// in cut-vo.mjs are hardcoded and go stale the instant the take changes.
//
//   node tools/vo-spans.mjs reel/vo/kairo-notify.mp3 [--script reel/notify.json]
//        [--noise -38] [--breath 0.22]
//
// A pause shorter than --breath (seconds) is a breath inside a line and is not
// a cut point. If the span count does not match the script's line count, it
// says so and prints the raw spans: adjust --breath rather than guessing.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && !/^-?\d/.test(a));
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
if (!file || !fs.existsSync(file)) { console.error('usage: node tools/vo-spans.mjs <voice file> [--script reel/notify.json]'); process.exit(2); }
const noise = Number(opt('noise', -38));
const breath = Number(opt('breath', 0.22));
const script = JSON.parse(fs.readFileSync(opt('script', 'reel/notify.json'), 'utf8'));

const ff = (filters) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', filters, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;

const probe = ff(`silencedetect=noise=${noise}dB:d=0.08`);
const duration = (() => { const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(probe); return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : NaN; })();
const silences = [];
let open = null;
for (const line of probe.split('\n')) {
  const s = /silence_start: (-?[\d.]+)/.exec(line); if (s) open = Math.max(0, Number(s[1]));
  const e = /silence_end: ([\d.]+)/.exec(line); if (e && open !== null) { silences.push([open, Number(e[1])]); open = null; }
}
if (open !== null) silences.push([open, duration]);

// Speech is what the silences leave; pauses shorter than a breath stay inside a line.
let spans = [];
let cursor = 0;
for (const [a, b] of silences) { if (a > cursor) spans.push([cursor, a]); cursor = b; }
if (cursor < duration) spans.push([cursor, duration]);
spans = spans.filter(([a, b]) => b - a > 0.06);
const merged = [];
for (const sp of spans) {
  const last = merged[merged.length - 1];
  if (last && sp[0] - last[1] < breath) last[1] = sp[1]; else merged.push([...sp]);
}

const loud = ff('ebur128=peak=true');
const I = (/I:\s+(-?[\d.]+) LUFS/.exec(loud.split('Summary:').pop()) || [])[1];
const TP = (/Peak:\s+(-?[\d.]+) dBFS/.exec(loud.split('Summary:').pop()) || [])[1];

console.log(`${file}: ${duration.toFixed(2)} s, ${merged.length} spans (script has ${script.lines.length} lines), integrated ${I} LUFS, true peak ${TP} dBFS`);
const r2 = (n) => Math.round(n * 100) / 100;
if (merged.length !== script.lines.length) {
  console.log('\nSpan count does not match the script. Raw spans:');
  merged.forEach(([a, b], i) => console.log(`  ${i + 1}. ${r2(a)} – ${r2(b)}  (${r2(b - a)} s)`));
  console.log(`\nA long breath split a line: raise --breath (now ${breath}). Two lines ran together: lower it.`);
  process.exit(1);
}
console.log('\nPaste this into LINES in tools/cut-vo.mjs:\n');
console.log('const LINES = [');
merged.forEach(([a, b], i) => console.log(`  ['${script.lines[i].id}', ${r2(a).toFixed(2)}, ${r2(b).toFixed(2)}],  // ${script.lines[i].say}`));
console.log('];');
