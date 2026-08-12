import { readdirSync, statSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { probe } from '../lib/ffmpeg.js';
import { paths } from '../lib/config.js';
import { makeLogger } from '../lib/log.js';
import * as store from '../lib/store.js';

const log = makeLogger('ingest');
const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm']);

/**
 * Sha's only job is dropping clips into the inbox. Everything here is about
 * making that safe: dedupe by content hash so re-syncing a folder does not
 * create duplicates, and classify each clip so the planner knows what it has.
 */

function hashFile(file) {
  // Hash the first 2MB plus size — full hashing a 4GB video to detect a
  // duplicate is not worth the I/O, and this is more than enough to be unique.
  const fd = readFileSync(file, { flag: 'r' }).subarray(0, 2 * 1024 * 1024);
  const size = statSync(file).size;
  return createHash('sha256').update(fd).update(String(size)).digest('hex').slice(0, 16);
}

/**
 * Guess what a clip is from its filename. Sha can name files anything, but if
 * she uses a keyword we pick it up — 'before', 'after', 'foils', 'reveal'.
 */
export function classify(filename) {
  const n = filename.toLowerCase();
  const tags = [];
  const map = {
    before: ['before', 'bfore', 'start', 'arrival'],
    after: ['after', 'final', 'finish', 'reveal', 'result'],
    process: ['foil', 'foils', 'apply', 'paint', 'balayage', 'toner', 'wash', 'rinse', 'blowdry', 'blow'],
    talking: ['talk', 'speak', 'chat', 'explain', 'tip'],
  };
  for (const [tag, words] of Object.entries(map)) {
    if (words.some((w) => n.includes(w))) tags.push(tag);
  }
  if (!tags.length) tags.push('unsorted');
  return tags;
}

/** Group clips shot close together into one appointment. */
export function groupIntoSessions(clips, gapMinutes = 90) {
  const sorted = [...clips].sort((a, b) => new Date(a.shotAt) - new Date(b.shotAt));
  const sessions = [];
  let current = null;
  for (const clip of sorted) {
    const t = new Date(clip.shotAt).getTime();
    if (!current || t - current.lastTs > gapMinutes * 60 * 1000) {
      current = { id: store.id('sess'), clips: [], startedAt: clip.shotAt, lastTs: t };
      sessions.push(current);
    }
    current.clips.push(clip.id);
    current.lastTs = t;
  }
  return sessions.map(({ lastTs, ...s }) => s);
}

export async function run({ inbox = paths.inbox, dest = paths.footage } = {}) {
  log.start();
  try {
    for (const d of [inbox, dest]) if (!existsSync(d)) mkdirSync(d, { recursive: true });

    const existing = store.read('footage', []);
    const seen = new Set(existing.map((f) => f.hash));

    const files = readdirSync(inbox)
      .filter((f) => VIDEO_EXT.has(extname(f).toLowerCase()))
      .map((f) => join(inbox, f));

    if (!files.length) {
      log.info('inbox is empty — nothing new to ingest');
      log.done({ added: 0, total: existing.length });
      return { added: [], skipped: [], total: existing.length };
    }

    const added = [];
    const skipped = [];

    for (const [i, file] of files.entries()) {
      log.progress(Math.round((i / files.length) * 100), basename(file));
      let hash;
      try {
        hash = hashFile(file);
      } catch (e) {
        log.warn(`unreadable, skipping: ${basename(file)}`);
        continue;
      }

      if (seen.has(hash)) {
        skipped.push(basename(file));
        log.debug(`duplicate, skipping: ${basename(file)}`);
        continue;
      }

      let meta;
      try {
        meta = await probe(file);
      } catch (e) {
        log.warn(`not a readable video, skipping: ${basename(file)} (${e.message.split('\n')[0]})`);
        continue;
      }

      const stat = statSync(file);
      const target = join(dest, `${hash}${extname(file).toLowerCase()}`);
      renameSync(file, target);

      const record = {
        id: store.id('clip'),
        hash,
        file: target,
        originalName: basename(file),
        tags: classify(basename(file)),
        durationSec: Number(meta.durationSec.toFixed(2)),
        width: meta.width,
        height: meta.height,
        isVertical: meta.height >= meta.width,
        hasAudio: meta.hasAudio,
        sizeBytes: meta.sizeBytes,
        shotAt: stat.mtime.toISOString(),
        consent: null,
        usedInPosts: [],
      };

      store.upsert('footage', record);
      seen.add(hash);
      added.push(record);
      log.info(`+ ${record.originalName} · ${record.durationSec}s · ${record.width}x${record.height} · ${record.tags.join(',')}`);
    }

    const total = store.read('footage', []).length;
    log.done({ added: added.length, skipped: skipped.length, total });
    return { added, skipped, total };
  } catch (err) {
    log.fail(err);
    throw err;
  }
}

/** What the planner can actually build from right now. */
export function inventory() {
  const clips = store.read('footage', []);
  const unused = clips.filter((c) => !c.usedInPosts?.length);
  const byTag = {};
  for (const c of unused) for (const t of c.tags) byTag[t] = (byTag[t] || 0) + 1;
  return {
    total: clips.length,
    unused: unused.length,
    byTag,
    totalUnusedSeconds: Math.round(unused.reduce((a, c) => a + c.durationSec, 0)),
    sessions: groupIntoSessions(unused),
  };
}

export default { run, inventory, classify, groupIntoSessions };
