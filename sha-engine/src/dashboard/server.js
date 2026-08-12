import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brand, system, capabilities, paths } from '../lib/config.js';
import { bus, makeLogger } from '../lib/log.js';
import * as store from '../lib/store.js';
import gate from '../stages/gate.js';
import ingest from '../stages/ingest.js';
import coordinator from '../agents/coordinator.js';
import { receiveUpload } from './upload.js';
import research from '../stages/research.js';
import plan from '../stages/plan.js';
import render from '../stages/render.js';
import ship from '../stages/ship.js';
import learn from '../stages/learn.js';
import brief from '../stages/brief.js';
import goals from '../stages/goals.js';
import review from '../stages/review.js';
import chat from './chat.js';

/**
 * A point-in-time snapshot of the account, read live via Composio and committed
 * so the console has real numbers to show before the service has its own
 * credentials. It is only used when no live review exists, and it carries
 * source:'snapshot' and a readAt date so the UI can say plainly that it is not
 * live. A live `.review` overwrites it.
 */
function loadReviewSnapshot() {
  try {
    return JSON.parse(readFileSync(join(HERE, '..', '..', 'data', 'seed', 'review-snapshot.json'), 'utf8'));
  } catch {
    return null;
  }
}

const log = makeLogger('dashboard');
const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Commands Sha can type on the dashboard.
 *
 * An explicit allowlist, never arbitrary evaluation — this endpoint is reachable
 * from a browser and the process holds live social credentials.
 */
const COMMANDS = {
  start: {
    help: 'Run the whole week: review, target, footage, brief, gate',
    run: async () => {
      const out = { steps: [] };
      for (const [label, fn] of [
        ['review', () => review.run()],
        ['goals', () => goals.run()],
        ['ingest', () => ingest.run()],
        ['research', () => research.run()],
        ['brief', () => brief.run()],
        ['gate', () => gate.run()],
      ]) {
        try {
          await fn();
          out.steps.push({ label, ok: true });
        } catch (err) {
          out.steps.push({ label, ok: false, error: err.message });
        }
      }
      const posts = store.read('posts', []);
      out.waiting = posts.filter((p) => p.status === 'awaiting_approval').length;
      const p = store.read('plan', { slots: [] });
      out.toFilm = (p.slots || []).filter((s) => !s.clipIds?.length).length;
      return out;
    },
    done: (r) => {
      const skipped = r.steps.filter((s) => !s.ok).map((s) => s.label);
      const note = skipped.length ? ` (${skipped.join(', ')} skipped)` : '';
      return `Week started${note}. ${r.waiting} waiting for approval, ${r.toFilm} still to film.`;
    },
  },
  review: {
    help: 'Grade the live Instagram account',
    run: () => review.run(),
    done: (r) =>
      r.unavailable
        ? `Cannot review: ${r.unavailable}`
        : `Grade ${r.summary.grade} — ${r.summary.averageEngagement}% average engagement across ${r.reviewed} posts.`,
  },
  goals: {
    help: "Set this week's target",
    run: () => goals.run(),
    done: (r) =>
      r.goals.week.targets.baselineKnown
        ? `Target set: ${r.goals.week.targets.followers} followers, ${r.goals.week.targets.posts} posts.`
        : 'No account metrics available, so no growth target was set this week.',
  },
  brief: { help: "Write the week's shoot brief", run: () => brief.run(), done: () => 'Shoot brief written.' },
  gate: { help: 'Run the rules and queue what passes', run: () => gate.run(), done: () => 'Gate run.' },
  status: {
    help: 'Where everything stands',
    run: async () => {
      const posts = store.read('posts', []);
      return {
        waiting: posts.filter((p) => p.status === 'awaiting_approval').length,
        approved: posts.filter((p) => p.status === 'approved').length,
        published: posts.filter((p) => p.publishedAt).length,
      };
    },
    done: (r) => `${r.waiting} waiting, ${r.approved} approved, ${r.published} published.`,
  },
};

/**
 * Zero-dependency dashboard server.
 *
 * Live updates ride on server-sent events rather than websockets: the traffic
 * here is one-directional (the pipeline talks, the browser listens), SSE
 * reconnects on its own, and it needs no library on either end.
 */

const STAGES = ['ingest', 'research', 'plan', 'cut', 'gate', 'ship', 'learn'];
const RUNNERS = {
  ingest: () => ingest.run(),
  research: () => research.run(),
  plan: () => plan.run(),
  cut: () => render.run(),
  gate: () => gate.run(),
  ship: () => ship.run({ dryRun: true }),
  learn: () => learn.run(),
};

const clients = new Set();
const recentLogs = [];
const stageState = Object.fromEntries(STAGES.map((s) => [s, { status: 'idle', ts: null }]));

function broadcast(event, data) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(frame); } catch { clients.delete(res); }
  }
}

bus.on('log', (entry) => {
  recentLogs.push(entry);
  if (recentLogs.length > 400) recentLogs.shift();
  broadcast('log', entry);
});
bus.on('stage', (e) => {
  const key = e.stage === 'render' ? 'cut' : e.stage;
  if (stageState[key]) stageState[key] = { status: e.status, ts: e.ts, detail: e.detail };
  broadcast('stage', { ...e, stage: key });
});
bus.on('progress', (e) => broadcast('progress', e));
bus.on('state', () => broadcast('snapshot', buildSnapshot()));

const agentState = {};
bus.on('agent', (e) => {
  agentState[e.agentId] = { status: e.status, ts: e.ts };
  broadcast('agent', e);
});

function buildSnapshot() {
  const s = store.snapshot();
  const posts = s.posts || [];
  const inv = ingest.inventory();
  return {
    business: {
      name: brand.business.name,
      operator: brand.business.operator,
      suburb: brand.business.suburb,
      region: brand.business.region,
      instagram: brand.business.instagram,
      timezone: brand.business.timezone,
      objective: brand.positioning.objective,
    },
    capabilities: capabilities(),
    stages: stageState,
    footage: { total: inv.total, unused: inv.unused, byTag: inv.byTag, seconds: inv.totalUnusedSeconds },
    trends: {
      generatedAt: s.trends?.generatedAt || null,
      live: Boolean(s.trends?.live),
      count: s.trends?.items?.length || 0,
      items: (s.trends?.items || []).slice(0, 8),
      formats: (s.trends?.formats || []).slice(0, 8),
    },
    plan: {
      weekOf: s.plan?.weekOf || null,
      allocation: s.plan?.allocation || {},
      slots: s.plan?.slots || [],
      shotList: s.plan?.shotList || [],
      footageGaps: s.plan?.footageGaps || [],
    },
    posts: posts.map((p) => ({
      id: p.id, type: p.type, formatName: p.formatName, status: p.status,
      durationSec: p.render?.durationSec ?? null,
      scheduledFor: p.scheduledFor, publishedAt: p.publishedAt ?? null,
      score: p.score ?? null,
      gate: p.gate ? { verdict: p.gate.verdict, blockers: p.gate.blockers, warnings: p.gate.warnings } : null,
      caption: p.caption, captions: p.captions,
      hasRender: Boolean(p.render?.outFile),
      // Renders are named by slot, not post — hand the client the real
      // filename rather than letting it guess.
      renderFile: p.render?.outFile ? p.render.outFile.split('/').pop() : null,
      results: p.results || {},
    })),
    memory: s.memory || {},
    goals: (() => {
      const weeks = store.read('weeks', []);
      return weeks.length ? { week: weeks[0], lastScorecard: weeks[1]?.scorecard ?? null } : null;
    })(),
    ...(() => {
      const live = store.read('review', null);
      const liveScores = store.read('scores', []);
      if (live) return { review: { ...live, source: 'live' }, scores: liveScores };
      const snap = loadReviewSnapshot();
      if (!snap) return { review: null, scores: [] };
      return {
        review: { at: snap.readAt, account: snap.account, summary: snap.summary,
                  captionIssues: snap.captionIssues, source: 'snapshot', note: snap.note },
        scores: snap.scores,
      };
    })(),
    commands: Object.entries(COMMANDS).map(([name, c]) => ({ name: `.${name}`, help: c.help })),
    chat: { assistant: chat.isAssistantConfigured() },
    mix: system.mix,
    agents: coordinator.explain().map((a) => ({ ...a, ...(agentState[a.id] || { status: 'idle' }) })),
    runs: store.read('runs', []).slice(-5).reverse(),
    generatedAt: new Date().toISOString(),
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mp4': 'video/mp4',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
};

function sendJson(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

/** Range support so previews scrub properly in the browser. */
function serveVideo(req, res, file) {
  const { size } = statSync(file);
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': size, 'Accept-Ranges': 'bytes' });
    return createReadStream(file).pipe(res);
  }
  const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
  const start = parseInt(startStr, 10) || 0;
  const end = endStr ? parseInt(endStr, 10) : size - 1;
  res.writeHead(206, {
    'Content-Type': 'video/mp4',
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': end - start + 1,
  });
  createReadStream(file, { start, end }).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (path === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');
    res.write(`event: snapshot\ndata: ${JSON.stringify(buildSnapshot())}\n\n`);
    for (const entry of recentLogs.slice(-60)) {
      res.write(`event: log\ndata: ${JSON.stringify(entry)}\n\n`);
    }
    clients.add(res);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    return;
  }

  if (path === '/api/snapshot') return sendJson(res, 200, buildSnapshot());

  /**
   * The command surface.
   *
   * Sha types `.start` here rather than opening a terminal. Commands are matched
   * against an explicit allowlist — this endpoint never evaluates arbitrary
   * input, because it is reachable from a browser on a machine holding live
   * social credentials.
   */
  if (path === '/api/command' && req.method === 'POST') {
    const body = await readBody(req);
    const raw = String(body?.command ?? '').trim().toLowerCase();
    const name = raw.replace(/^[./]/, '');
    const command = COMMANDS[name];

    if (!command) {
      return sendJson(res, 400, {
        ok: false,
        reply: `I do not know "${raw}". Try: ${Object.keys(COMMANDS).map((c) => `.${c}`).join(', ')}`,
        known: Object.keys(COMMANDS),
      });
    }

    bus.emit('log', { level: 'info', stage: 'command', msg: `> ${raw}` });
    try {
      const result = await command.run();
      const reply = command.done(result);
      bus.emit('log', { level: 'ok', stage: 'command', msg: reply });
      broadcast('snapshot', buildSnapshot());
      return sendJson(res, 200, { ok: true, reply, result });
    } catch (err) {
      bus.emit('log', { level: 'error', stage: 'command', msg: err.message });
      return sendJson(res, 500, { ok: false, reply: `${name} failed: ${err.message}` });
    }
  }

  if (path === '/api/chat' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const out = await chat.handle({
        history: Array.isArray(body?.history) ? body.history : [],
        message: body?.message,
        commands: COMMANDS,
      });
      if (out.ran?.length) broadcast('snapshot', buildSnapshot());
      return sendJson(res, 200, out);
    } catch (err) {
      return sendJson(res, 500, { mode: 'error', reply: err.message });
    }
  }

  if (path === '/api/run' && req.method === 'POST') {
    const { stage } = await readBody(req);
    const runner = RUNNERS[stage];
    if (!runner) return sendJson(res, 400, { error: `Unknown stage "${stage}"` });
    sendJson(res, 202, { started: stage });
    runner()
      .then(() => broadcast('snapshot', buildSnapshot()))
      .catch((err) => log.error(`${stage} failed: ${err.message}`));
    return;
  }

  // Phone upload. The one surface Sha touches: pick clips in the camera roll,
  // they land in the inbox, and the Librarian picks them up on the next run.
  if (path === '/api/upload' && req.method === 'POST') {
    try {
      const result = await receiveUpload(req);
      log.ok(`upload: ${result.saved.length} file(s)`);
      if (result.saved.length) {
        await ingest.run();
        broadcast('snapshot', buildSnapshot());
      }
      return sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      log.error(`upload failed: ${err.message}`);
      return sendJson(res, 400, { error: err.message });
    }
  }

  // Run the whole coordinated week from the phone.
  if (path === '/api/coordinator' && req.method === 'POST') {
    const body = await readBody(req);
    sendJson(res, 202, { started: true });
    coordinator
      .run({ dryRun: body.dryRun !== false, only: body.only || null })
      .then(() => broadcast('snapshot', buildSnapshot()))
      .catch((err) => log.error(`coordinator failed: ${err.message}`));
    return;
  }

  if (path === '/api/decide' && req.method === 'POST') {
    const { postId, decision, reason } = await readBody(req);
    try {
      const post = gate.decide(postId, decision, reason);
      broadcast('snapshot', buildSnapshot());
      return sendJson(res, 200, { ok: true, status: post.status });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (path.startsWith('/preview/')) {
    const name = decodeURIComponent(path.slice('/preview/'.length)).replace(/[^\w.-]/g, '');
    const file = join(paths.renders, name);
    if (!existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
    return serveVideo(req, res, file);
  }

  const file = path === '/' ? 'index.html' : path.replace(/^\//, '');
  const full = join(HERE, 'public', file);
  if (!full.startsWith(join(HERE, 'public')) || !existsSync(full)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream' });
  res.end(readFileSync(full));
});

/**
 * Locally this binds to 127.0.0.1 from config, which is the right default for a
 * process holding live social credentials. A hosting platform sets PORT and
 * routes to the container from outside, so a loopback bind there is unreachable
 * and every request 502s — when PORT is provided, bind all interfaces.
 */
const port = Number(process.env.PORT) || system.dashboard.port;
const host = process.env.HOST || (process.env.PORT ? '0.0.0.0' : system.dashboard.host);

server.listen(port, host, () => {
  process.stdout.write(`\n  ${brand.business.name} — Gloss studio\n  http://${host}:${port}\n\n`);
});
