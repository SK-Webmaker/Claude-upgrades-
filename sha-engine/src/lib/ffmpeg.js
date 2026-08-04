import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function resolveBin(pkg, fallbackCmd) {
  try {
    const mod = require(pkg);
    const p = typeof mod === 'string' ? mod : mod?.path;
    if (p) return p;
  } catch {
    // Fall through to whatever is on PATH.
  }
  return fallbackCmd;
}

export const FFMPEG = process.env.FFMPEG_PATH || resolveBin('ffmpeg-static', 'ffmpeg');
export const FFPROBE = process.env.FFPROBE_PATH || resolveBin('ffprobe-static', 'ffprobe');

export function run(bin, args, { capture = 'stderr', timeoutMs = 15 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${bin} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const tail = err.split('\n').slice(-12).join('\n');
        return reject(new Error(`${bin} exited ${code}\n${tail}`));
      }
      resolve(capture === 'stdout' ? out : err);
    });
  });
}

export const ffmpeg = (args, opts) => run(FFMPEG, ['-hide_banner', '-nostdin', '-y', ...args], opts);
export const ffprobe = (args, opts) => run(FFPROBE, args, { capture: 'stdout', ...opts });

/** Duration, dimensions, rotation and whether the file carries usable audio. */
export async function probe(file) {
  const raw = await ffprobe([
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    file,
  ]);
  const data = JSON.parse(raw);
  const video = (data.streams || []).find((s) => s.codec_type === 'video');
  const audio = (data.streams || []).find((s) => s.codec_type === 'audio');
  if (!video) throw new Error(`No video stream in ${file}`);

  const rotation = Number(
    video.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ?? 0
  );
  const swapped = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;

  return {
    file,
    durationSec: Number(data.format?.duration || video.duration || 0),
    width: swapped ? Number(video.height) : Number(video.width),
    height: swapped ? Number(video.width) : Number(video.height),
    rotation,
    fps: parseFps(video.r_frame_rate),
    hasAudio: Boolean(audio),
    codec: video.codec_name,
    sizeBytes: Number(data.format?.size || 0),
  };
}

function parseFps(r) {
  if (!r) return 30;
  const [n, d] = r.split('/').map(Number);
  if (!d) return n || 30;
  return Math.round((n / d) * 100) / 100;
}

/**
 * Scene-change timestamps. ffmpeg prints one line per detected change to
 * stderr via the `showinfo` filter; we parse the pts_time values back out.
 */
export async function detectScenes(file, threshold = 0.28) {
  const out = await ffmpeg([
    '-i', file,
    '-filter:v', `select='gt(scene,${threshold})',showinfo`,
    '-f', 'null', '-',
  ]);
  const times = [];
  const re = /pts_time:([0-9.]+)/g;
  let m;
  while ((m = re.exec(out)) !== null) times.push(Number(m[1]));
  return times.sort((a, b) => a - b);
}

/**
 * Per-window motion energy, used to find the parts of a clip where something
 * actually happens. Uses the freezedetect-adjacent trick of measuring frame
 * difference via signalstats on a downsampled stream — cheap and good enough
 * to rank segments.
 */
export async function motionProfile(file, sampleFps = 4) {
  const out = await ffmpeg([
    '-i', file,
    '-vf', `fps=${sampleFps},scale=160:-2,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG`,
    '-an', '-f', 'null', '-',
  ]);
  const samples = [];
  const re = /pts_time:([0-9.]+)[\s\S]*?lavfi\.signalstats\.YAVG=([0-9.]+)/g;
  let m;
  while ((m = re.exec(out)) !== null) {
    samples.push({ t: Number(m[1]), energy: Number(m[2]) });
  }
  return samples;
}

export function escapeDrawText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "’")
    .replace(/%/g, '\\%');
}
