#!/usr/bin/env node
// Lay the reel out on a presenter take: her video is the voice, so the picture
// follows her timing exactly (re-cutting the audio would break her lip-sync).
//
//   python tools/take-words.py reel/vo/presenter.mp4 > reel/out/words.json
//   node tools/take-timeline.mjs reel/vo/presenter.mp4
//
// Lines the words up against reel/notify.json, says where she went off script,
// and writes:
//   reel/out/timeline.json   every line, and every word, at the time she says it
//   reel/out/vo.wav          her voice, normalised for Instagram (-14 LUFS, -1.5 dBTP)
//   reel/out/face/00001.jpg  her frames at 30 fps, 1080x1920, for the face shots
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const take = process.argv[2];
if (!take || !fs.existsSync(take)) { console.error('usage: node tools/take-timeline.mjs <presenter take .mp4>'); process.exit(2); }
const script = JSON.parse(fs.readFileSync('reel/notify.json', 'utf8'));
const heard = JSON.parse(fs.readFileSync('reel/out/words.json', 'utf8'));

// ── words, compared the way a listener would ─────────────────────────────────
const SAME = { cairo: 'kairo', kyro: 'kairo', kiro: 'kairo', kyrow: 'kairo', 'd.m.': 'dm', 'd.m': 'dm', apps: "app's" };
const norm = (w) => { const k = String(w).toLowerCase().replace(/[“”"]/g, '').replace(/^[^a-z0-9$']+|[^a-z0-9'.]+$/g, '').replace(/\.+$/, ''); return SAME[k] || k; };
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function spell(n) {
  if (n < 20) return [ONES[n]];
  if (n < 100) return [TENS[Math.floor(n / 10)], ...(n % 10 ? [ONES[n % 10]] : [])];
  return [ONES[Math.floor(n / 100)], 'hundred', ...(n % 100 ? ['and', ...spell(n % 100)] : [])];
}
// "$410" heard, "four hundred and ten" scripted: spread its time across the words.
const H = heard.words.flatMap((h) => {
  const m = /^\$?(\d{1,3})$/.exec(norm(h.w));
  if (!m) return [{ ...h, n: norm(h.w) }];
  const ws = spell(Number(m[1])); const d = (h.end - h.start) / ws.length;
  return ws.map((w, i) => ({ w, n: w, start: +(h.start + i * d).toFixed(3), end: +(h.start + (i + 1) * d).toFixed(3), p: h.p }));
});
const S = script.lines.flatMap((l, li) => l.say.split(/\s+/).map((w, wi) => ({ line: li, wi, w, n: norm(w) })));

// ── align script to speech (edit distance, then walk back) ──────────────────
const n = S.length, m = H.length;
const D = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
  D[i][j] = Math.min(D[i - 1][j - 1] + (S[i - 1].n === H[j - 1].n ? 0 : 1), D[i - 1][j] + 1, D[i][j - 1] + 1);
}
const pair = new Array(n).fill(-1); const extra = []; const off = [];
for (let i = n, j = m; i > 0 || j > 0;) {
  if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (S[i - 1].n === H[j - 1].n ? 0 : 1)) {
    pair[i - 1] = j - 1; if (S[i - 1].n !== H[j - 1].n) off.push(`said "${H[j - 1].w}" for "${S[i - 1].w}"`); i--; j--;
  } else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { off.push(`skipped "${S[i - 1].w}"`); i--; } else { extra.push(H[j - 1].w); j--; }
}
// A skipped word still needs a time for its caption: halfway between its neighbours.
const times = S.map((s, i) => (pair[i] >= 0 ? { start: H[pair[i]].start, end: H[pair[i]].end } : null));
for (let i = 0; i < n; i++) if (!times[i]) {
  const prev = times.slice(0, i).reverse().find(Boolean); const next = times.slice(i + 1).find(Boolean);
  const a = prev ? prev.end : (next ? next.start - 0.3 : 0); const b = next ? next.start : a + 0.3;
  times[i] = { start: +a.toFixed(3), end: +Math.max(a + 0.05, b).toFixed(3), guessed: true };
}

// ── snap to the pauses she actually left ────────────────────────────────────
// The transcriber's word times drift by a few hundred milliseconds around a
// pause (it tends to stretch a word across the silence before it). The take's
// own silences are exact, so each one is matched, in order, to the word gap it
// belongs to, preferring gaps at punctuation, and the words between two pauses
// are spread out by the transcriber's proportions.
const sil = [];
{ const out = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', take, '-af', 'silencedetect=noise=-38dB:d=0.12', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  let open = null;
  for (const line of out.split('\n')) {
    const a = /silence_start: (-?[\d.]+)/.exec(line); if (a) open = Math.max(0, Number(a[1]));
    const b = /silence_end: ([\d.]+)/.exec(line); if (b && open !== null) { const g = [open, Number(b[1])]; const last = sil[sil.length - 1];
      if (last && g[0] - last[1] < 0.06) last[1] = g[1]; else sil.push(g); open = null; }
  } }
const speechFrom = sil.length && sil[0][0] < 0.02 ? sil[0][1] : 0;        // leading silence
const inner = sil.filter(([a]) => a > speechFrom + 0.02 && a < times[n - 1].end + 0.3);
const punct = (i) => /[,.?!…]$/.test(S[i].w);
const bnd = (k) => (times[k].end + times[k + 1].start) / 2;              // whisper's gap between word k and k+1
// DP: gap g → boundary k, strictly increasing; a gap may stay unmatched.
const G = inner.length, K = n - 1, MISS = 1.2;
const cost = (g, k) => Math.abs(bnd(k) - (inner[g][0] + inner[g][1]) / 2) - (punct(k) ? 0.35 : 0);
const best = Array.from({ length: G + 1 }, () => new Array(K + 1).fill(Infinity)); const from = Array.from({ length: G + 1 }, () => new Array(K + 1).fill(null));
for (let k = 0; k <= K; k++) best[0][k] = 0;
for (let g = 1; g <= G; g++) for (let k = 0; k <= K; k++) {
  if (best[g - 1][k] + MISS < best[g][k]) { best[g][k] = best[g - 1][k] + MISS; from[g][k] = [g - 1, k, false]; }
  if (k > 0 && best[g][k - 1] < best[g][k]) { best[g][k] = best[g][k - 1]; from[g][k] = [g, k - 1, false]; }
  if (k > 0) { const c = best[g - 1][k - 1] + cost(g - 1, k - 1); if (c < best[g][k]) { best[g][k] = c; from[g][k] = [g - 1, k - 1, true]; } }
}
const gapAfter = new Map();
for (let g = G, k = K; g > 0 && from[g][k];) { const [pg, pk, took] = from[g][k]; if (took) gapAfter.set(k - 1, inner[g - 1]); g = pg; k = pk; }
// Anchors: where each run of speech starts and ends, then spread the words inside.
const anchors = [];
let runStart = 0;
for (let k = 0; k < n; k++) if (gapAfter.has(k) || k === n - 1) { anchors.push([runStart, k]); runStart = k + 1; }
for (const [a, b] of anchors) {
  const t0 = a === 0 ? Math.max(speechFrom, times[0].start) : gapAfter.get(a - 1)[1];
  const t1 = gapAfter.has(b) ? gapAfter.get(b)[0] : times[b].end;
  const w0 = times[a].start, w1 = Math.max(times[b].end, w0 + 0.01);
  const map = (t) => +(t0 + (t1 - t0) * Math.min(1, Math.max(0, (t - w0) / (w1 - w0)))).toFixed(3);
  for (let i = a; i <= b; i++) times[i] = { ...times[i], start: map(times[i].start), end: map(times[i].end) };
}
console.log(`snapped to ${gapAfter.size} of ${inner.length} pauses in the take`);

const lines = script.lines.map((l, li) => {
  const ws = S.map((s, i) => ({ ...s, ...times[i] })).filter((s) => s.line === li);
  return { id: l.id, say: l.say, scene: l.scene, start: ws[0].start, end: ws[ws.length - 1].end,
    words: ws.map((w) => ({ w: w.w, start: w.start, end: w.end, ...(w.guessed ? { guessed: true } : {}) })) };
});
const duration = +(lines[lines.length - 1].end + script.tail).toFixed(3);
fs.mkdirSync('reel/out', { recursive: true });
fs.writeFileSync('reel/out/timeline.json', JSON.stringify({ id: script.id, estimated: false, take: path.basename(take), duration, lines }, null, 1));

const [lo, hi] = script.target;
console.log(`take: ${heard.duration.toFixed(2)} s; reel ${duration.toFixed(2)} s (target ${lo}–${hi})${duration > hi ? '  ← OVER THE CAP' : duration < lo ? '  ← short of the target' : ''}`);
lines.forEach((l) => console.log(`  ${l.start.toFixed(2).padStart(6)} – ${l.end.toFixed(2).padStart(6)}  ${l.id.padEnd(7)} ${l.say}`));
const lowConf = heard.words.filter((w) => w.p < 0.5).map((w) => `"${w.w}" (${w.p})`);
if (off.length) console.log(`\noff script: ${off.reverse().join('; ')}`);
if (extra.length) console.log(`extra words: ${extra.reverse().join(' ')}`);
if (lowConf.length) console.log(`unclear to the transcriber: ${lowConf.join(', ')}`);
if (!off.length && !extra.length) console.log('\nword for word, as scripted.');

// ── her voice, and her frames ───────────────────────────────────────────────
const ff = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' }); if (r.status) process.exit(r.status); };
ff(['-i', take, '-t', String(duration), '-vn', '-af', `highpass=f=75,apad,atrim=end=${duration},loudnorm=I=-14:TP=-1.5:LRA=7,aresample=48000`, '-ac', '2', 'reel/out/vo.wav']);
fs.rmSync('reel/out/face', { recursive: true, force: true }); fs.mkdirSync('reel/out/face');
ff(['-i', take, '-t', String(duration + 0.1), '-vf', 'fps=30,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920', '-q:v', '3', 'reel/out/face/%05d.jpg']);
// The picture needs to know how many frames of her there are.
const faceFrames = fs.readdirSync('reel/out/face').length;
const tl = JSON.parse(fs.readFileSync('reel/out/timeline.json', 'utf8'));
fs.writeFileSync('reel/out/timeline.json', JSON.stringify({ ...tl, faceFrames, faceFps: 30 }, null, 1));
console.log(`wrote reel/out/timeline.json, vo.wav and ${faceFrames} face frames`);
