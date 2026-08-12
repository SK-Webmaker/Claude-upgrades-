import { join } from 'node:path';
import { brand, system, paths } from '../lib/config.js';
import { makeLogger } from '../lib/log.js';
import * as store from '../lib/store.js';
import { cutClip, rendersDir } from './cut.js';

const log = makeLogger('render');

/**
 * Walk the week's plan and turn every slot that has footage into a finished
 * vertical. This is the bridge between "we decided to make this" and "there
 * is a file on disk" — the cut engine itself stays dumb about plans.
 */

/**
 * Captions are written here rather than at plan time, because until the cut
 * exists we do not know how long anything runs. The hook always lands inside
 * the first two seconds; the rest is paced against the finished duration.
 */
export function writeCaptions(slot, durationSec) {
  const hook = slot.caption?.hook || '';
  const caps = [];

  if (hook) {
    caps.push({
      text: hook.replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim(),
      start: 0.15,
      end: Math.min(3.2, durationSec * 0.35),
      style: 'hook',
    });
  }

  const beats = (slot.beats || []).filter(Boolean);
  if (beats.length && durationSec > 6) {
    const window = durationSec - 3.5;
    const each = window / beats.length;
    beats.forEach((b, i) => {
      caps.push({
        text: String(b).slice(0, 60),
        start: Number((3.5 + i * each).toFixed(2)),
        end: Number((3.5 + (i + 1) * each - 0.15).toFixed(2)),
        style: 'caption',
      });
    });
  }

  return caps;
}

/** Pick the best source clip for a slot — longest usable one wins. */
function chooseSource(slot, clips) {
  const pool = (slot.clipIds || [])
    .map((id) => clips.find((c) => c.id === id))
    .filter(Boolean)
    .filter((c) => c.durationSec >= 2);
  if (!pool.length) return null;
  return pool.sort((a, b) => b.durationSec - a.durationSec)[0];
}

export async function run({ slotIds = null } = {}) {
  log.start();
  try {
    const plan = store.read('plan', { slots: [] });
    const clips = store.read('footage', []);
    const posts = store.read('posts', []);
    rendersDir();

    let slots = plan.slots.filter((s) => s.status === 'ready_to_cut');
    if (slotIds?.length) slots = slots.filter((s) => slotIds.includes(s.id));

    if (!slots.length) {
      log.info('no slots ready to cut');
      log.done({ rendered: 0 });
      return { rendered: [], failed: [] };
    }

    const rendered = [];
    const failed = [];

    for (const [i, slot] of slots.entries()) {
      log.progress(Math.round((i / slots.length) * 100), slot.formatName);

      const source = chooseSource(slot, clips);
      if (!source) {
        log.warn(`${slot.id}: no usable source clip, skipping`);
        failed.push({ slot: slot.id, reason: 'no usable source clip' });
        continue;
      }

      const outFile = join(paths.renders, `${slot.id}.mp4`);

      try {
        // Captions are timed against the cut engine's own prediction, so this
        // renders exactly once regardless of how much the source gets trimmed.
        const render = await cutClip({
          source: source.file,
          outFile,
          captions: (predictedSec) => writeCaptions(slot, predictedSec),
          slot,
        });
        const captions = render.captions;

        const post = {
          id: store.id('post'),
          slotId: slot.id,
          weekOf: slot.weekOf,
          type: slot.type,
          formatId: slot.formatId,
          formatName: slot.formatName,
          clipIds: slot.clipIds,
          caption: slot.caption,
          captions,
          render: {
            outFile,
            durationSec: render.durationSec,
            width: render.width,
            height: render.height,
            sizeBytes: render.sizeBytes,
            segments: render.segments.length,
          },
          scheduledFor: slot.scheduledFor,
          platforms: slot.platforms,
          status: 'cut',
          attempts: 0,
        };

        store.upsert('posts', post);
        slot.status = 'cut';
        rendered.push(post);
        log.ok(`${slot.formatName} → ${render.durationSec.toFixed(1)}s`);
      } catch (err) {
        log.error(`${slot.id} failed to render: ${err.message.split('\n')[0]}`);
        slot.status = 'render_failed';
        failed.push({ slot: slot.id, reason: err.message.split('\n')[0] });
      }
    }

    store.write('plan', plan);
    log.done({ rendered: rendered.length, failed: failed.length });
    return { rendered, failed };
  } catch (err) {
    log.fail(err);
    throw err;
  }
}

export default { run, writeCaptions };
