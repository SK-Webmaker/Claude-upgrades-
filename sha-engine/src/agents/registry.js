import { runLibrarian } from '../stages/ingest.js';
import { runScout } from '../stages/scout.js';
import { runProducer } from '../stages/brief.js';
import { runCritic } from '../stages/gate.js';
import { runPublisher } from '../stages/ship.js';
import { runAnalyst } from '../stages/learn.js';

/**
 * The agent pipeline.
 *
 * Order is never hardcoded — the coordinator derives it from `requires`/`produces`.
 * Adding an agent means declaring what it needs and what it emits; the graph
 * re-sorts itself.
 *
 * There is deliberately no Editor stage. Cutting raw video on a machine is what
 * broke the workflow before. Sha films and edits natively; this engine's job is
 * to tell her exactly what to film (Producer) and to publish what she approves
 * (Publisher).
 */
export const AGENTS = [
  {
    name: 'Analyst',
    role: 'Scores what already shipped so the next cycle learns from real numbers.',
    requires: [],
    produces: ['insights'],
    run: runAnalyst,
  },
  {
    name: 'Librarian',
    role: 'Ingests the photos and video Sha uploads, and hosts them at public URLs Instagram can fetch.',
    requires: [],
    produces: ['library'],
    run: runLibrarian,
  },
  {
    name: 'Scout',
    role: 'Ranks content formats against the reference library and live market research.',
    requires: ['insights'],
    produces: ['formatRanking'],
    run: runScout,
  },
  {
    name: 'Producer',
    role: 'Writes the weekly shoot brief and drafts a caption for every slot.',
    requires: ['formatRanking', 'library'],
    produces: ['drafts', 'brief'],
    run: runProducer,
  },
  {
    name: 'Critic',
    role: 'Hard gate. Nothing reaches Sha, and nothing reaches the public, without passing.',
    requires: ['drafts'],
    produces: ['gated'],
    run: runCritic,
  },
  {
    name: 'Publisher',
    role: 'Queues gated posts for approval and publishes the ones Sha taps through.',
    requires: ['gated'],
    produces: ['queued'],
    run: runPublisher,
  },
];

export function getAgent(name) {
  const agent = AGENTS.find((a) => a.name === name);
  if (!agent) throw new Error(`Unknown agent: ${name}`);
  return agent;
}
