import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { paths } from './config.js';
import { makeLogger } from './log.js';

const log = makeLogger('analyse');
const SCRIPT = join(paths.root, 'scripts', 'analyse.py');
const PYTHON = process.env.SHA_PYTHON || 'python3';

/**
 * Bridge to the Python analysers.
 *
 * Both capabilities degrade rather than fail. If whisper cannot run — no
 * model cached, no network to fetch one, Python missing — the pipeline
 * continues with written captions instead of word-synced ones and says so.
 * A missing nicety must never stop the week's content going out.
 */

function runPython(args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(PYTHON, [SCRIPT, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ ok: false, error: `timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `could not start ${PYTHON}: ${e.message}` });
    });
    child.on('close', () => {
      clearTimeout(timer);
      // The script prints one JSON object; anything else on stdout is noise
      // from a library, so take the last parseable line.
      const line = out.trim().split('\n').filter(Boolean).pop();
      if (!line) return resolve({ ok: false, error: err.trim().split('\n').pop() || 'no output' });
      try {
        resolve(JSON.parse(line));
      } catch {
        resolve({ ok: false, error: `unparseable output: ${line.slice(0, 200)}` });
      }
    });
  });
}

/** Word-level transcript. Returns { ok:false } rather than throwing. */
export async function transcribe(file, { model = null, timeoutMs = 10 * 60 * 1000 } = {}) {
  const args = ['transcribe', file];
  if (model) args.push(model);
  const res = await runPython(args, timeoutMs);
  if (!res.ok) {
    log.warn(`transcription unavailable: ${res.error}`);
    return { ok: false, error: res.error, words: [], hasSpeech: false };
  }
  log.info(`transcribed ${res.words.length} words (${res.language})`);
  return res;
}

/** Subject-tracking crop centres. Falls back to a centred crop. */
export async function framing(file, { samples = 24, timeoutMs = 4 * 60 * 1000 } = {}) {
  const res = await runPython(['frame', file, String(samples)], timeoutMs);
  if (!res.ok) {
    log.warn(`framing analysis unavailable, centring crop: ${res.error}`);
    return { ok: false, error: res.error, meanCentre: 0.5, recommendStatic: true, track: [] };
  }
  return res;
}

/**
 * Turn a framing track into an ffmpeg crop x-expression.
 *
 * A static offset is used unless the subject genuinely moves, because an
 * animated crop on near-static footage adds motion the footage never had and
 * reads as a mistake. When the subject does move, the crop follows in steps
 * between samples rather than continuously — imperceptible in playback and
 * far cheaper than a per-frame expression.
 */
export function cropExpression(framingResult, { sourceWidth, cropWidth }) {
  const maxX = Math.max(0, sourceWidth - cropWidth);
  const toX = (centre) => Math.round(Math.min(maxX, Math.max(0, centre * sourceWidth - cropWidth / 2)));

  if (!framingResult?.ok || framingResult.recommendStatic || framingResult.track.length < 3) {
    return { expr: String(toX(framingResult?.meanCentre ?? 0.5)), animated: false };
  }

  // Nested if() chain: pick the x for whichever sample window we are in.
  const track = framingResult.track;
  let expr = String(toX(track[track.length - 1].centre));
  for (let i = track.length - 2; i >= 0; i--) {
    expr = `if(lt(t,${track[i + 1].t}),${toX(track[i].centre)},${expr})`;
  }
  return { expr, animated: true };
}

export default { transcribe, framing, cropExpression };
