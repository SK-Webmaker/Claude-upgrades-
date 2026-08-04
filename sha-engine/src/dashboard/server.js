import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brand, system, capabilities, paths } from '../lib/config.js';
import { bus, makeLogger } from '../lib/log.js';
import * as store from '../lib/store.js';
import gate from '../stages/gate.js';
import ingest from '../stages/ingest.js';
import research from '../stages/research.js';
import plan from '../stages/plan.js';
import render from '../stages/render.js';
import ship from '../stages/ship.js';
import learn from '../stages/learn.js';

const log = makeLogger('dashboard');
const HERE = dirname(fileURLToPath(import.meta.url));

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
    mix: system.mix,
    generatedAt: new Date().toISOString(),
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mp4': 'video/mp4',
  '.json': 'application/json',
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

const { port, host } = system.dashboard;
server.listen(port, host, () => {
  process.stdout.write(`\n  ${brand.business.name} control room\n  http://${host}:${port}\n\n`);
});
