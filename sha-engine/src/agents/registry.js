import ingest from '../stages/ingest.js';
import scout from '../stages/scout.js';
import brief from '../stages/brief.js';
import plan from '../stages/plan.js';
import gate from '../stages/gate.js';
import ship from '../stages/ship.js';
import learn from '../stages/learn.js';
import goals from '../stages/goals.js';

/**
 * The specialists.
 *
 * Each agent owns one job, states what it needs before it can work, and
 * declares what it produces. The coordinator reads these declarations rather
 * than hard-coding an order, which is what lets the system re-plan when a
 * capability is missing instead of marching into a failure.
 *
 * `escalate` is the important field: it says, in plain words, what Sha should
 * be told when this agent cannot do its job. An automated system that goes
 * quiet is worse than one that fails loudly.
 */

export const AGENTS = [
  {
    id: 'librarian',
    name: 'Librarian',
    role: 'Takes in photos Sha sends and keeps track of what exists',
    produces: ['footage'],
    requires: [],
    optional: [],
    run: () => ingest.run(),
    escalate: 'No new photos arrived. Photo posts need images before they can be built.',
    critical: false,
  },
  {
    id: 'scout',
    name: 'Scout',
    role: 'Finds video formats worth copying, and the video that proves it',
    produces: ['trends'],
    requires: [],
    optional: [],
    run: () => scout.run(),
    escalate: 'Could not rank formats. The reference library is built in, so this should not happen.',
    critical: false,
  },
  {
    id: 'strategist',
    name: 'Strategist',
    role: "Sets this week's target, scores last week, and moves the next target on the result",
    produces: ['goals'],
    requires: [],
    // Scores are last week's, so this reads whatever the Analyst last wrote
    // rather than requiring a fresh run — otherwise the graph cycles.
    optional: ['scores'],
    run: (ctx) => goals.run({ account: ctx?.account ?? null }),
    escalate:
      'Could not set this week’s target. The plan still runs, but nothing will be scored against a goal.',
    critical: false,
  },
  {
    id: 'producer',
    name: 'Producer',
    role: "Writes the week's shoot brief — what to film and why",
    produces: ['plan'],
    requires: [],
    optional: ['trends', 'goals'],
    run: () => brief.run(),
    escalate: 'Could not write the brief. Check config/brand.json is readable.',
    critical: true,
  },
  // The Editor is retired. Moving raw footage off a phone onto a machine was
  // the step that actually broke the workflow, so video is now filmed and
  // posted natively by Sha against a written brief. Photo posts still publish
  // through the API path, which is why the Publisher survives.

  {
    id: 'critic',
    name: 'Critic',
    role: 'Blocks anything that should not reach a client',
    produces: ['verdicts'],
    // Nothing produces 'posts' now that the Editor is retired; the Critic
    // gates whatever photo posts are pending, and passes cleanly when none are.
    requires: [],
    optional: [],
    run: () => gate.run(),
    escalate: 'The gate could not run, so nothing is cleared for approval.',
    critical: true,
  },
  {
    id: 'publisher',
    name: 'Publisher',
    role: 'Sends approved posts out at the right time',
    produces: ['published'],
    requires: ['approved'],
    optional: ['instagramPublish', 'tiktokPublish'],
    run: (ctx) => ship.run({ dryRun: ctx?.dryRun ?? false }),
    escalate: 'Could not publish. Accounts are probably not linked yet.',
    critical: false,
  },
  {
    id: 'analyst',
    name: 'Analyst',
    role: 'Scores what went out and teaches the Producer',
    produces: ['scores', 'memory'],
    requires: ['published'],
    optional: [],
    run: () => learn.run(),
    escalate: 'No performance data yet. Scoring resumes once posts have been live a while.',
    critical: false,
  },
];

export function getAgent(id) {
  return AGENTS.find((a) => a.id === id) || null;
}

export default { AGENTS, getAgent };
