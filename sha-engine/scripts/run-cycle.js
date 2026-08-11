#!/usr/bin/env node
/**
 * Weekly cycle. Run from the Render cron.
 *
 * Analyst -> Librarian -> Scout -> Producer -> Critic -> Publisher
 *
 * Ends with posts sitting in the review queue. Publishes nothing — that only
 * happens after Sha taps approve, via publish-due.js.
 */
import { AGENTS } from '../src/agents/registry.js';
import { runPipeline } from '../src/agents/coordinator.js';
import { Store } from '../src/lib/store.js';
import { InstagramComposio } from '../src/platforms/instagram-composio.js';

const store = new Store();

let platform = null;
try {
  platform = new InstagramComposio();
} catch (err) {
  console.warn(`No Instagram platform: ${err.message}`);
  console.warn('Running without live insights or media verification.');
}

const cadence = Number(process.env.POSTS_PER_WEEK) || 3;

try {
  const result = await runPipeline(AGENTS, { store, platform, cadence });

  console.log('\n--- cycle complete ---');
  for (const step of result.trace) {
    console.log(`  ${step.ok ? 'ok  ' : 'FAIL'} ${step.agent} (${step.ms}ms)`);
  }
  console.log(`\nDrafted:  ${result.drafts?.length ?? 0}`);
  console.log(`Queued:   ${result.queued?.length ?? 0} awaiting Sha's approval`);
  console.log(`To film:  ${result.brief?.needsFilming ?? 0}`);

  const blocked = (result.gated ?? []).filter((p) => !p.gate.passed);
  if (blocked.length) {
    console.log(`\nBlocked by the Critic (${blocked.length}):`);
    for (const post of blocked) {
      for (const v of post.gate.violations.filter((x) => x.severity === 'block')) {
        console.log(`  [${v.rule}] ${v.message}`);
      }
    }
  }
} catch (err) {
  console.error(`Cycle failed: ${err.message}`);
  if (err.trace) console.error(err.trace);
  process.exit(1);
}
