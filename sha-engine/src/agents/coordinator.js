import { capabilities, system } from '../lib/config.js';
import { makeLogger, bus } from '../lib/log.js';
import * as store from '../lib/store.js';
import { AGENTS, getAgent } from './registry.js';

const log = makeLogger('coordinator');

/**
 * The coordinator.
 *
 * It does not do any of the work. It decides which specialist runs, in what
 * order, what to do when one fails, and what is worth interrupting Sha about.
 *
 * The ordering is derived from each agent's declared requirements rather than
 * written down, so adding an agent is a matter of declaring what it needs —
 * the coordinator works out where it belongs. Everything it does is recorded
 * as a run record, which is what makes an automated system auditable after
 * the fact instead of a black box that either worked or did not.
 */

const MAX_RETRIES = 2;

/** Topological order from declared requires/produces. */
export function resolveOrder(agents = AGENTS) {
  const produced = new Map();
  for (const a of agents) for (const p of a.produces) produced.set(p, a.id);

  const ordered = [];
  const state = new Map(); // id -> 'visiting' | 'done'

  const visit = (agent, trail = []) => {
    if (state.get(agent.id) === 'done') return;
    if (state.get(agent.id) === 'visiting') {
      // A cycle would hang the run; report it rather than looping.
      throw new Error(`Circular dependency: ${[...trail, agent.id].join(' → ')}`);
    }
    state.set(agent.id, 'visiting');
    for (const need of agent.requires) {
      const providerId = produced.get(need);
      const provider = providerId ? agents.find((x) => x.id === providerId) : null;
      if (provider && provider.id !== agent.id) visit(provider, [...trail, agent.id]);
    }
    state.set(agent.id, 'done');
    ordered.push(agent);
  };

  for (const a of agents) visit(a);
  return ordered;
}

/** Which optional capabilities an agent is missing right now. */
function missingOptional(agent, caps) {
  return (agent.optional || []).filter((c) => c in caps && !caps[c]);
}

/**
 * Decide whether a failure stops the run.
 *
 * A critical agent failing means the rest of the week cannot be built, so the
 * run halts and Sha is told. A non-critical one failing is noted and the run
 * continues — losing trend data should never cost her a week of posting.
 */
function classify(agent, error) {
  return {
    agentId: agent.id,
    fatal: Boolean(agent.critical),
    message: agent.escalate,
    detail: String(error?.message || error).split('\n')[0],
  };
}

async function runAgent(agent, ctx) {
  const caps = capabilities();
  const degraded = missingOptional(agent, caps);

  bus.emit('agent', { agentId: agent.id, status: 'running', ts: Date.now() });
  if (degraded.length) {
    log.warn(`${agent.name} running degraded — missing ${degraded.join(', ')}`);
  }

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const result = await agent.run(ctx);
      bus.emit('agent', { agentId: agent.id, status: 'done', ts: Date.now() });
      return { ok: true, agentId: agent.id, attempt, degraded, result };
    } catch (err) {
      lastError = err;
      if (attempt <= MAX_RETRIES) {
        log.warn(`${agent.name} failed (attempt ${attempt}), retrying: ${err.message.split('\n')[0]}`);
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
  }

  bus.emit('agent', { agentId: agent.id, status: 'failed', ts: Date.now() });
  return { ok: false, agentId: agent.id, degraded, error: classify(agent, lastError) };
}

/**
 * Run the week.
 *
 * `only` restricts to a subset (still dependency-ordered), `dryRun` stops
 * anything reaching a platform, and `stopBefore` lets the run halt at the
 * approval gate — which is the normal mode, since Sha approves before
 * anything publishes.
 */
export async function run({ only = null, dryRun = false, stopBefore = 'publisher', scrape = null } = {}) {
  const started = Date.now();
  log.start({ dryRun, only, stopBefore });

  const caps = capabilities();
  let order;
  try {
    order = resolveOrder();
  } catch (err) {
    log.fail(err);
    throw err;
  }

  if (only?.length) {
    const wanted = new Set(only);
    order = order.filter((a) => wanted.has(a.id));
  }

  const ctx = { dryRun, scrape, caps };
  const record = {
    id: store.id('run'),
    startedAt: new Date(started).toISOString(),
    dryRun,
    steps: [],
    escalations: [],
    halted: false,
  };

  for (const agent of order) {
    if (stopBefore && agent.id === stopBefore) {
      log.info(`holding before ${agent.name} — waiting on Sha's approval`);
      record.steps.push({ agentId: agent.id, status: 'held', reason: 'awaiting approval' });
      break;
    }

    log.info(`→ ${agent.name}: ${agent.role}`);
    const outcome = await runAgent(agent, ctx);

    record.steps.push({
      agentId: agent.id,
      status: outcome.ok ? 'done' : 'failed',
      attempt: outcome.attempt ?? null,
      degraded: outcome.degraded,
      summary: summarise(agent.id, outcome.result),
    });

    if (outcome.degraded?.length) {
      record.escalations.push({
        level: 'note', agentId: agent.id,
        message: agent.escalate, missing: outcome.degraded,
      });
    }

    if (!outcome.ok) {
      record.escalations.push({
        level: outcome.error.fatal ? 'blocker' : 'warning',
        agentId: agent.id,
        message: outcome.error.message,
        detail: outcome.error.detail,
      });
      if (outcome.error.fatal) {
        log.error(`${agent.name} failed and the run cannot continue: ${outcome.error.detail}`);
        record.halted = true;
        break;
      }
      log.warn(`${agent.name} failed but is not critical — continuing`);
    }
  }

  record.finishedAt = new Date().toISOString();
  record.durationMs = Date.now() - started;

  const runs = store.read('runs', []);
  runs.push(record);
  store.write('runs', runs.slice(-40));

  const blockers = record.escalations.filter((e) => e.level === 'blocker');
  if (blockers.length) log.error(`run halted: ${blockers.map((b) => b.message).join(' | ')}`);
  else log.done({ steps: record.steps.length, escalations: record.escalations.length });

  return record;
}

/** One-line human summary per agent, for the run log and the dashboard. */
function summarise(agentId, result) {
  if (!result) return null;
  switch (agentId) {
    case 'librarian': return `${result.added?.length ?? 0} new clip(s), ${result.total ?? 0} total`;
    case 'scout': return `${result.items?.length ?? 0} trend(s), ${result.live ? 'live' : 'offline'}`;
    case 'producer': return `${result.slots?.length ?? 0} slot(s), ${result.slots?.filter((s) => s.status === 'ready_to_cut').length ?? 0} ready`;
    case 'editor': return `${result.rendered?.length ?? 0} rendered, ${result.failed?.length ?? 0} failed`;
    case 'critic': return `${result.awaitingApproval?.length ?? 0} for approval, ${result.blocked?.length ?? 0} blocked`;
    case 'publisher': return `${result.shipped?.length ?? 0} published`;
    case 'analyst': return `${result.scored ?? 0} scored`;
    default: return null;
  }
}

/** What the coordinator would do right now, without doing it. */
export function explain() {
  const caps = capabilities();
  return resolveOrder().map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    requires: a.requires,
    critical: a.critical,
    degraded: missingOptional(a, caps),
  }));
}

export default { run, resolveOrder, explain };
