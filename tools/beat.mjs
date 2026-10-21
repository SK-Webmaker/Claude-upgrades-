// An original beat for a reel, synthesised with ffmpeg: nothing licensed,
// nothing downloaded, so it can never be muted for copyright.
//
// Four-on-the-floor kick, a clap on 2 and 4, closed hats on the off-beats and
// a sub bass walking Am–F–C–G, at the reel's tempo so the cuts land on beats.
// Quiet enough to sit under sound effects; the reel can also be posted
// without it, under a trending sound added in Instagram.
//
//   import { buildBeat } from './beat.mjs';
//   buildBeat({ bpm: 124, duration: 15.5, out: 'reel/out/beat.wav' });
import { spawnSync } from 'node:child_process';

export function buildBeat({ bpm = 124, duration, out, gainDb = -3, introBeats = 0 }) {
  const b = 60 / bpm;                 // one beat, seconds
  const T = `(t-${introBeats * b})`; // the beat starts after an optional silent intro
  const on = `gte(t,${introBeats * b})`;
  const ph = (period, offset = 0) => `mod(${T}+${offset},${period})`;
  // Kick: a sine sweeping 160 Hz → 48 Hz, decaying fast.
  const kick = `0.9*sin(2*PI*(48*${ph(b)}+(112/22)*(1-exp(-22*${ph(b)}))))*exp(-7*${ph(b)})`;
  // Clap on beats 2 and 4: a short noise burst.
  const clap = `0.38*(random(1)*2-1)*exp(-28*${ph(2 * b, b)})`;
  // Closed hat on every off-beat eighth.
  const hat = `0.13*(random(2)*2-1)*exp(-70*${ph(b, b / 2)})`;
  // Sub bass: the root of each bar's chord, pumping on the eighths.
  const bar = `mod(floor(${T}/${4 * b}),4)`;
  const root = `if(eq(${bar},0),55,if(eq(${bar},1),43.65,if(eq(${bar},2),65.41,49)))`;
  const bass = `0.42*sin(2*PI*${root}*${T})*(0.35+0.65*(1-exp(-18*${ph(b / 2)})))`;
  const expr = `${on}*(${kick}+${clap}+${hat}+${bass})`;
  // Normalised to a fixed loudness rather than a fixed gain, so the bed sits at
  // the same level whatever the tempo; gainDb is relative to -14 LUFS.
  const graph = `aevalsrc=exprs='${expr}':s=48000:d=${duration},highpass=f=30,`
    + `loudnorm=I=${-14 + gainDb}:TP=-2:LRA=7,aresample=48000,aformat=channel_layouts=stereo`;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', graph, '-ar', '48000', out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('could not build the beat');
  return { out, beat: b };
}
