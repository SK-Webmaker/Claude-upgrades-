import ingest from '../stages/ingest.js';
import research from '../stages/research.js';
import plan from '../stages/plan.js';
import render from '../stages/render.js';
import gate from '../stages/gate.js';
import ship from '../stages/ship.js';
import learn from '../stages/learn.js';

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
    role: 'Takes in raw footage and keeps track of what exists',
    produces: ['footage'],
    requires: [],
    optional: [],
    run: () => ingest.run(),
    escalate: 'No new footage arrived. Nothing can be cut until clips are uploaded.',
    critical: false,
  },
  {
    id: 'scout',
    name: 'Scout',
    role: 'Watches what is working in Australian beauty content',
    produces: ['trends'],
    requires: [],
    optional: ['liveResearch'],
    run: (ctx) => research.run({ scrape: ctx?.scrape || null }),
    escalate: 'Running without live trend data. Formats are ranked on past results only.',
    critical: false,
  },
  {
    id: 'producer',
    name: 'Producer',
    role: 'Decides what gets made this week and why',
    produces: ['plan'],
    requires: ['footage'],
    optional: ['trends'],
    run: () => plan.run(),
    escalate: 'Could not build a plan. Usually means there is no footage at all.',
    critical: true,
  },
  {
    id: 'editor',
    name: 'Editor',
    role: 'Cuts footage into finished verticals',
    produces: ['posts'],
    requires: ['plan'],
    optional: ['transcription', 'framing'],
    run: () => render.run(),
    escalate: 'Nothing rendered. Either no slot had usable footage, or ffmpeg failed.',
    critical: true,
  },
  {
    id: 'critic',
    name: 'Critic',
    role: 'Blocks anything that should not reach a client',
    produces: ['verdicts'],
    requires: ['posts'],
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
