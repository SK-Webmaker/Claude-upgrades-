import { join } from 'node:path';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { ffmpeg, probe, detectScenes, motionProfile } from '../lib/ffmpeg.js';
import { writeAss, escapeFilterPath } from '../lib/subtitles.js';
import { brand, system, paths } from '../lib/config.js';
import { makeLogger } from '../lib/log.js';

const log = makeLogger('cut');

/**
 * Choose the segments worth keeping.
 *
 * Scene detection tells us where the camera changed; motion energy tells us
 * where something is actually happening. A salon clip is mostly a stationary
 * phone pointed at slow work, so scene cuts alone are far too sparse — we
 * score windows by motion and take the densest ones, then order them by time
 * so the result still reads as a sequence rather than a shuffle.
 */
export function selectSegments(motion, sceneTimes, duration, opts) {
  const { minSegmentSeconds, maxSegmentSeconds } = opts.cut;
  const targetTotal = opts.video.targetSeconds;

  if (!motion.length) {
    // No usable motion data — fall back to evenly spaced windows.
    const n = Math.max(1, Math.round(targetTotal / maxSegmentSeconds));
    const step = duration / n;
    return Array.from({ length: n }, (_, i) => ({
      start: Number((i * step).toFixed(2)),
      end: Number(Math.min(duration, i * step + Math.min(step, maxSegmentSeconds)).toFixed(2)),
      energy: 0,
    })).filter((s) => s.end - s.start >= 0.4);
  }

  // Build candidate windows anchored on scene boundaries plus a rolling grid,
  // so we never miss action that happens mid-scene.
  const anchors = new Set([0, ...sceneTimes]);
  for (let t = 0; t < duration; t += maxSegmentSeconds) anchors.add(Number(t.toFixed(2)));

  const sorted = [...anchors].sort((a, b) => a - b);
  const windows = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    const nextAnchor = sorted[i + 1] ?? duration;
    const end = Math.min(duration, start + Math.min(maxSegmentSeconds, Math.max(minSegmentSeconds, nextAnchor - start)));
    if (end - start < minSegmentSeconds) continue;
    const inWindow = motion.filter((s) => s.t >= start && s.t < end);
    const energy = inWindow.length
      ? inWindow.reduce((a, s) => a + s.energy, 0) / inWindow.length
      : 0;
    windows.push({ start: Number(start.toFixed(2)), end: Number(end.toFixed(2)), energy });
  }

  if (!windows.length) {
    return [{ start: 0, end: Math.min(duration, maxSegmentSeconds), energy: 0 }];
  }

  // Take the highest-energy windows until we have enough runtime, then restore
  // chronological order.
  const byEnergy = [...windows].sort((a, b) => b.energy - a.energy);
  const picked = [];
  let total = 0;
  for (const w of byEnergy) {
    if (total >= targetTotal) break;
    if (picked.some((p) => w.start < p.end && w.end > p.start)) continue; // no overlaps
    picked.push(w);
    total += w.end - w.start;
  }
  return picked.sort((a, b) => a.start - b.start);
}

/**
 * Work out exactly how long the finished cut will be, before rendering it.
 *
 * Without this the caller has to guess, render, discover the guess was wrong
 * and render again — which doubles the cost of every clip. The maths is the
 * same as the filtergraph applies, so the prediction is exact rather than
 * approximate.
 *
 * The ramp is also suppressed when applying it would drop the clip under the
 * platform minimum; a 14-second source should not be sped up into an
 * 11-second clip that then fails the gate.
 */
export function predictDuration(segments, opts) {
  const kept = segments.reduce((a, s) => a + (s.end - s.start), 0);
  const { rampFactor, rampAfterSecond } = opts.cut;
  if (kept <= rampAfterSecond + 2 || rampFactor <= 1) return { duration: kept, ramped: false };

  const ramped = rampAfterSecond + (kept - rampAfterSecond) / rampFactor;
  if (ramped < opts.video.minSeconds) return { duration: kept, ramped: false };
  return { duration: ramped, ramped: true };
}

/**
 * Build the ffmpeg filtergraph for one source file.
 *
 * Everything happens in a single pass: trim to the chosen segments, scale and
 * crop each to 9:16 without squashing, concatenate, speed-ramp the tail, then
 * burn captions. One pass keeps a full render inside a few seconds per clip
 * and avoids generational quality loss from intermediate files.
 */
export function buildFilterGraph(segments, meta, opts, assFile, prediction = null) {
  const { width, height } = opts.video;
  const { rampFactor, rampAfterSecond } = opts.cut;
  const pred = prediction || predictDuration(segments, opts);
  const parts = [];
  const labels = [];

  segments.forEach((seg, i) => {
    // Scale so the short edge covers the frame, then centre-crop. `increase`
    // guarantees both dimensions are >= target so the crop never reads
    // out of bounds on odd source aspect ratios.
    parts.push(
      `[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS,` +
      `scale=${width}:${height}:force_original_aspect_ratio=increase,` +
      `crop=${width}:${height},setsar=1[v${i}]`
    );
    labels.push(`[v${i}]`);
  });

  let cursor;
  if (segments.length === 1) {
    cursor = '[v0]';
  } else {
    parts.push(`${labels.join('')}concat=n=${segments.length}:v=1:a=0[cat]`);
    cursor = '[cat]';
  }

  // Speed-ramp everything after the hook so the middle never drags — unless
  // doing so would take the clip under the platform minimum.
  if (pred.ramped) {
    parts.push(
      `${cursor}split=2[head][tail]`,
      `[head]trim=start=0:end=${rampAfterSecond},setpts=PTS-STARTPTS[h]`,
      `[tail]trim=start=${rampAfterSecond},setpts=(PTS-STARTPTS)/${rampFactor}[t]`,
      `[h][t]concat=n=2:v=1:a=0[ramped]`
    );
    cursor = '[ramped]';
  }

  // Burn captions via libass. Timings in the ASS file are relative to the
  // finished cut, so this has to come after the trims, concat and speed ramp.
  if (assFile) {
    parts.push(`${cursor}subtitles='${escapeFilterPath(assFile)}'[subbed]`);
    cursor = '[subbed]';
  }

  parts.push(`${cursor}format=yuv420p[vout]`);
  return { graph: parts.join(';'), outLabel: '[vout]' };
}

/**
 * Cut one source file into a publish-ready vertical.
 */
export async function cutClip({ source, outFile, captions = [], slot = null }) {
  const opts = { video: system.video, cut: system.cut, look: brand.look };

  log.info(`probing ${source.split('/').pop()}`);
  const meta = await probe(source);

  if (meta.durationSec < 1) {
    throw new Error(`Source is only ${meta.durationSec}s — nothing to cut`);
  }

  const [sceneTimes, motion] = await Promise.all([
    detectScenes(source, system.cut.sceneThreshold).catch(() => []),
    motionProfile(source, system.cut.motionSampleFps).catch(() => []),
  ]);
  log.debug(`scenes=${sceneTimes.length} motionSamples=${motion.length}`);

  const segments = selectSegments(motion, sceneTimes, meta.durationSec, opts);
  if (!segments.length) throw new Error('No usable segments found in source');

  const keptDuration = segments.reduce((a, s) => a + (s.end - s.start), 0);
  const prediction = predictDuration(segments, opts);
  log.info(
    `selected ${segments.length} segment(s), ${keptDuration.toFixed(1)}s of ${meta.durationSec.toFixed(1)}s` +
    ` → ${prediction.duration.toFixed(1)}s${prediction.ramped ? ' (ramped)' : ''}`
  );

  // Captions can be a plain array or a function of the predicted duration.
  // The function form is what lets us time captions correctly on the first
  // pass instead of rendering, measuring, and rendering again.
  const resolved = typeof captions === 'function' ? captions(prediction.duration) : captions;

  let assFile = null;
  if (resolved?.length) {
    assFile = outFile.replace(/\.mp4$/, '') + '.ass';
    writeAss(assFile, { captions: resolved, look: brand.look, video: system.video });
  }

  const { graph, outLabel } = buildFilterGraph(segments, meta, opts, assFile, prediction);

  const args = [
    '-i', source,
    '-filter_complex', graph,
    '-map', outLabel,
  ];

  // Keep source audio only when it exists and is not being speed-ramped into
  // chipmunk territory; otherwise the track is added at publish time.
  if (meta.hasAudio) {
    args.push('-map', '0:a?', '-c:a', 'aac', '-b:a', system.video.audioBitrate, '-shortest');
  } else {
    args.push('-an');
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '20',
    '-maxrate', system.video.videoBitrate,
    '-bufsize', '12M',
    '-r', String(system.video.fps),
    '-movflags', '+faststart',
    outFile
  );

  log.info('rendering');
  await ffmpeg(args);

  const result = await probe(outFile);
  log.ok(`rendered ${result.width}x${result.height} ${result.durationSec.toFixed(1)}s`);

  return {
    outFile,
    source,
    segments,
    captions: resolved || [],
    predictedSec: Number(prediction.duration.toFixed(2)),
    sourceDurationSec: meta.durationSec,
    durationSec: result.durationSec,
    width: result.width,
    height: result.height,
    sizeBytes: result.sizeBytes,
    slotId: slot?.id ?? null,
  };
}

export function rendersDir() {
  if (!existsSync(paths.renders)) mkdirSync(paths.renders, { recursive: true });
  return paths.renders;
}

export function clearRenders() {
  if (existsSync(paths.renders)) rmSync(paths.renders, { recursive: true, force: true });
  mkdirSync(paths.renders, { recursive: true });
}

export default { cutClip, selectSegments, buildFilterGraph, rendersDir, clearRenders };
