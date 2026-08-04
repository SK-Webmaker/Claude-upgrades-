import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { paths } from './config.js';

/**
 * Every stage writes here. The dashboard subscribes to the same emitter, which
 * is what makes the interface live rather than a page you refresh.
 */
export const bus = new EventEmitter();
bus.setMaxListeners(50);

const LEVELS = { debug: 10, info: 20, ok: 25, warn: 30, error: 40 };
const MIN = LEVELS[process.env.SHA_LOG_LEVEL || 'info'] ?? 20;

const COLOR = {
  debug: '\x1b[2m', info: '\x1b[0m', ok: '\x1b[32m',
  warn: '\x1b[33m', error: '\x1b[31m', reset: '\x1b[0m', dim: '\x1b[2m',
};

function ensureLogDir() {
  if (!existsSync(paths.logs)) mkdirSync(paths.logs, { recursive: true });
}

function write(level, stage, message, detail) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    stage,
    message,
    ...(detail !== undefined ? { detail } : {}),
  };

  // Broadcast first so the dashboard stays live even if disk writes fail.
  bus.emit('log', entry);

  if ((LEVELS[level] ?? 20) >= MIN) {
    const c = COLOR[level] || '';
    const stageTag = stage ? `${COLOR.dim}[${stage}]${COLOR.reset} ` : '';
    process.stdout.write(`${c}${level.padEnd(5)}${COLOR.reset} ${stageTag}${message}\n`);
  }

  try {
    ensureLogDir();
    const day = entry.ts.slice(0, 10);
    appendFileSync(join(paths.logs, `${day}.jsonl`), JSON.stringify(entry) + '\n');
  } catch {
    // Logging must never take the pipeline down.
  }
}

export function makeLogger(stage) {
  return {
    debug: (m, d) => write('debug', stage, m, d),
    info: (m, d) => write('info', stage, m, d),
    ok: (m, d) => write('ok', stage, m, d),
    warn: (m, d) => write('warn', stage, m, d),
    error: (m, d) => write('error', stage, m, d),

    /** Announce stage lifecycle so the dashboard can animate the pipeline. */
    start(detail) {
      bus.emit('stage', { stage, status: 'running', ts: Date.now(), detail });
      write('info', stage, 'started', detail);
    },
    done(detail) {
      bus.emit('stage', { stage, status: 'done', ts: Date.now(), detail });
      write('ok', stage, 'complete', detail);
    },
    fail(err) {
      bus.emit('stage', { stage, status: 'failed', ts: Date.now(), detail: String(err?.message || err) });
      write('error', stage, String(err?.message || err));
    },
    progress(pct, note) {
      bus.emit('progress', { stage, pct, note, ts: Date.now() });
    },
  };
}
