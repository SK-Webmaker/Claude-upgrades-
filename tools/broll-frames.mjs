#!/usr/bin/env node
// Higgsfield B-roll clips → JPEG frames the reel pages play back by time.
//
//   node tools/broll-frames.mjs            # every reel/broll/*.mp4
//
// Each clip is scaled to fill 1080x1920 (centre-cropped) at 30 fps into
// reel/out/broll/<name>/00001.jpg…, and its frame count is written to
// reel/out/broll/frames.json for the pages to read.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'reel', 'broll');
const OUT = path.join(ROOT, 'reel', 'out', 'broll');
fs.mkdirSync(OUT, { recursive: true });
const counts = {};
for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith('.mp4')).sort()) {
  const name = f.replace(/\.mp4$/, '');
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(SRC, f),
    '-vf', 'fps=30,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,unsharp=5:5:0.6',
    '-q:v', '3', path.join(dir, '%05d.jpg')], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status);
  counts[name] = fs.readdirSync(dir).length;
  console.log(`${name}: ${counts[name]} frames`);
}
fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(counts, null, 1));
