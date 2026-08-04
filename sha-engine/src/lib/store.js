import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { paths } from './config.js';
import { bus } from './log.js';

/**
 * Deliberately a plain JSON store. The whole state of this business's marketing
 * is a few hundred records; a database would be ceremony. Writes are atomic via
 * rename so a crash mid-write cannot corrupt the file.
 */

const FILES = {
  footage: 'footage.json',
  trends: 'trends.json',
  plan: 'plan.json',
  posts: 'posts.json',
  scores: 'scores.json',
  memory: 'memory.json',
};

function ensureDirs() {
  for (const dir of [paths.data, paths.inbox, paths.footage, paths.renders, paths.state, paths.logs]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

function file(key) {
  return join(paths.state, FILES[key] || `${key}.json`);
}

export function read(key, fallback = []) {
  ensureDirs();
  const f = file(key);
  if (!existsSync(f)) return fallback;
  try {
    return JSON.parse(readFileSync(f, 'utf8'));
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  ensureDirs();
  const f = file(key);
  const tmp = `${f}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, f);
  bus.emit('state', { key, ts: Date.now() });
  return value;
}

export function upsert(key, record, matchOn = 'id') {
  const rows = read(key, []);
  const i = rows.findIndex((r) => r[matchOn] === record[matchOn]);
  if (i >= 0) rows[i] = { ...rows[i], ...record, updatedAt: new Date().toISOString() };
  else rows.push({ ...record, createdAt: new Date().toISOString() });
  write(key, rows);
  return record;
}

export function id(prefix = 'x') {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

/**
 * Long-term pattern memory: what actually worked for this salon.
 * Stage 7 writes here; stage 3 reads it when choosing next week's formats.
 */
export function recallPatterns() {
  return read('memory', { formats: {}, hooks: {}, sounds: {}, postingTimes: {} });
}

export function rememberPattern(kind, key, delta) {
  const mem = recallPatterns();
  mem[kind] = mem[kind] || {};
  const cur = mem[kind][key] || { n: 0, score: 0 };
  cur.n += 1;
  cur.score += delta;
  cur.avg = cur.score / cur.n;
  mem[kind][key] = cur;
  write('memory', mem);
  return cur;
}

/** Snapshot for the dashboard's first paint. */
export function snapshot() {
  return {
    footage: read('footage', []),
    trends: read('trends', { generatedAt: null, items: [] }),
    plan: read('plan', { weekOf: null, slots: [] }),
    posts: read('posts', []),
    memory: recallPatterns(),
  };
}
