// Sound effects for a reel, synthesised: nothing licensed, nothing downloaded.
//
// Each cue (window.CUES in the reel page) is [time, kind], set from the same
// cut times the picture uses, so a whoosh is always on its cut. The track sits
// well under the voice: its loudest moment peaks about 10 dB below her.
//
//   import { buildSfx } from './sfx.mjs';
//   buildSfx(cues, duration, 'reel/out/sfx.wav');
import { spawnSync } from 'node:child_process';

// aevalsrc expressions, t from the start of the sound. Short and dry on purpose.
const SOUNDS = {
  // two-note message chime, like a text arriving
  ding: { d: 0.9, e: '0.55*sin(2*PI*1318.5*t)*exp(-7*t) + 0.4*gte(t,0.09)*sin(2*PI*1975.5*(t-0.09))*exp(-8*(t-0.09))', post: '' },
  // air moving past: noise swelling and falling away
  whoosh: { d: 0.34, e: '0.5*(random(0)*2-1)*pow(sin(PI*t/0.34),2)', post: 'highpass=f=700,lowpass=f=5200,' },
  // the SENT stamp: a low hit with a short click on top
  thud: { d: 0.5, e: '0.62*sin(2*PI*(55*t+2.6*(1-exp(-28*t))))*exp(-9*t) + 0.25*(random(0)*2-1)*exp(-160*t)', post: 'lowpass=f=3000,' },
  // something landing: a quick falling blip
  pop: { d: 0.14, e: '0.35*sin(2*PI*(1250*t-2600*t*t))*exp(-34*t)', post: '' },
  // a light tick on a cut
  tick: { d: 0.06, e: '0.3*(random(0)*2-1)*exp(-140*t)', post: 'highpass=f=2500,' },
};

export function buildSfx(cues, duration, out, { gainDb = -6 } = {}) {
  const parts = cues.filter(([t, kind]) => SOUNDS[kind] && t >= 0 && t < duration).map(([t, kind], i) => {
    const s = SOUNDS[kind];
    return `aevalsrc=exprs='${s.e}':s=48000:d=${s.d},${s.post}adelay=${Math.round(t * 1000)}:all=1[c${i}]`;
  });
  const graph = `${parts.join(';')};${parts.map((_, i) => `[c${i}]`).join('')}amix=inputs=${parts.length}:normalize=0,`
    + `volume=${gainDb}dB,apad,atrim=end=${duration},aformat=channel_layouts=stereo[out]`;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-filter_complex', graph, '-map', '[out]', '-ar', '48000', out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('could not build the sound effects');
  return out;
}
