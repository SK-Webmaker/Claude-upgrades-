#!/usr/bin/env node
import { brand, system, creds, capabilities, paths } from './lib/config.js';
import { makeLogger } from './lib/log.js';
import * as store from './lib/store.js';
import ingest from './stages/ingest.js';
import research from './stages/research.js';
import plan from './stages/plan.js';
import render from './stages/render.js';
import gate from './stages/gate.js';
import ship from './stages/ship.js';
import learn from './stages/learn.js';
import tiktok from './platforms/tiktok.js';
import coordinator from './agents/coordinator.js';
import goals from './stages/goals.js';
import review from './stages/review.js';
import brief from './stages/brief.js';
import pack from './lib/pack.js';

const log = makeLogger('cli');

const HELP = `
sha — content engine for ${brand.business.name}, ${brand.business.suburb} ${brand.business.region}

  sha doctor              What is connected, what is missing, what to do next
  sha ingest              Pull new footage out of the inbox
  sha research            Refresh the trend brief (Australia)
  sha plan                Build next week's slots
  sha cut                 Render every slot that has footage
  sha gate                Run the rules, queue what passes for approval
  sha approve <id>        Approve a post
  sha reject <id> [why]   Reject a post and teach the planner why
  sha ship [--dry-run]    Publish what is approved and due
  sha learn               Score what published and update pattern memory
  sha .start              Start the week: review, target, ingest, brief, gate
  sha review              Grade the live Instagram account and say what to change
  sha goals               Set this week's target from last week's result
  sha week [--dry-run]    Coordinator runs the full week end to end
  sha agents              Show the agent roster and what each one needs
  sha status              Where everything currently stands

Flags
  --dry-run               Go through the motions without publishing anything
  --force                 Ignore schedule times when shipping
`;

function flag(name) {
  return process.argv.includes(`--${name}`);
}

/**
 * `.start` — the weekly kick-off, in the order the week actually runs.
 *
 * Review last week against the live account first, so the target and the plan
 * are both set from what really happened rather than from what was hoped for.
 * It stops at the approval queue: nothing publishes without Sha.
 */
async function startWeek({ dryRun = false } = {}) {
  const started = Date.now();
  process.stdout.write(`\n  ${brand.business.name} — starting the week\n\n`);

  const steps = [
    ['Reviewing last week on Instagram', async () => reviewReport({ quiet: true })],
    ['Setting this week’s target', async () => goals.run()],
    ['Taking in new footage', async () => ingest.run()],
    ['Refreshing what is working', async () => research.run()],
    ['Writing the shoot brief', async () => brief.run()],
    ['Gating what is ready', async () => gate.run()],
  ];

  const done = [];
  for (const [label, fn] of steps) {
    process.stdout.write(`  · ${label} ... `);
    try {
      const out = await fn();
      done.push({ label, ok: true, out });
      process.stdout.write('\x1b[32mok\x1b[0m\n');
    } catch (err) {
      done.push({ label, ok: false, error: err.message });
      process.stdout.write(`\x1b[33mskipped\x1b[0m — ${err.message}\n`);
    }
  }

  const posts = store.read('posts', []);
  const waiting = posts.filter((p) => p.status === 'awaiting_approval');
  const planNow = store.read('plan', { slots: [] });
  const toFilm = (planNow.slots || []).filter((s) => !s.clipIds?.length);

  process.stdout.write(`\n  Ready in ${((Date.now() - started) / 1000).toFixed(1)}s\n\n`);
  process.stdout.write(`  ${waiting.length} post(s) waiting for your approval\n`);
  process.stdout.write(`  ${toFilm.length} slot(s) still need filming\n`);

  const lastReview = store.read('review', null);
  if (lastReview?.summary?.grade) {
    process.stdout.write(
      `  Last week graded ${lastReview.summary.grade} — ${lastReview.summary.averageEngagement}% average engagement\n`,
    );
    for (const action of lastReview.summary.actions.slice(0, 2)) {
      process.stdout.write(`    → ${action}\n`);
    }
  }

  // The finished posts, printed last because they are the part she acts on.
  let week = null;
  try {
    week = pack.current();
  } catch (err) {
    process.stdout.write(`\n  \x1b[33mThis week's pack did not pass the Critic\x1b[0m — ${err.message}\n`);
  }

  if (week) {
    process.stdout.write(`\n  Ready to post — ${week.title}\n\n`);
    for (const p of week.posts) {
      const img = p.imageReady ? p.image : `${p.image} (not rendered yet)`;
      process.stdout.write(`    ${p.day.padEnd(10)} ${p.title}\n`);
      process.stdout.write(`               ${img}\n`);
    }
    process.stdout.write(`\n  Video guides for the week\n\n`);
    for (const g of week.videoGuides) {
      process.stdout.write(`    ${g.title} — ${g.lengthSec[0]}-${g.lengthSec[1]}s, ${g.difficulty}\n`);
    }
  }

  process.stdout.write(`\n  Open the console to copy the captions, then: sha ship${dryRun ? ' --dry-run' : ''}\n\n`);
  return {
    steps: done,
    waiting: waiting.length,
    toFilm: toFilm.length,
    ready: week?.posts?.length ?? 0,
    guides: week?.videoGuides?.length ?? 0,
  };
}

/** Grades the live account and prints the scorecard. */
async function reviewReport({ quiet = false } = {}) {
  const out = await review.run();

  if (out.unavailable) {
    if (!quiet) process.stdout.write(`\n  Cannot review: ${out.unavailable}\n\n`);
    return out;
  }
  if (quiet) return out;

  const { account, summary, captionIssues } = out;
  process.stdout.write(`\n  @${account.username} — ${account.followers} followers\n\n`);
  process.stdout.write(`  Grade ${summary.grade} · ${summary.averageEngagement}% average engagement\n`);
  process.stdout.write(`  ${summary.verdict}\n\n`);

  if (summary.best) process.stdout.write(`  Best:  ${summary.best.engagementRate}%  ${summary.best.permalink}\n`);
  if (summary.worst) process.stdout.write(`  Worst: ${summary.worst.engagementRate}%  ${summary.worst.permalink}\n`);

  process.stdout.write('\n  What to change:\n');
  for (const action of summary.actions) process.stdout.write(`    · ${action}\n`);

  if (captionIssues.length) {
    process.stdout.write(`\n  \x1b[33m${captionIssues.length} published caption(s) carry a defect:\x1b[0m\n`);
    for (const issue of captionIssues.slice(0, 5)) {
      if (issue.bareHashtags.length) {
        process.stdout.write(`    · ${issue.bareHashtags.length} hashtags missing "#" — ${issue.permalink}\n`);
      }
      if (issue.draftArtifact) {
        process.stdout.write(`    · draft text "${issue.draftArtifact}" published — ${issue.permalink}\n`);
      }
    }
  }
  process.stdout.write('\n');
  return out;
}

async function doctor() {
  const caps = capabilities();
  const inv = ingest.inventory();

  const rows = [
    ['Instagram publishing', caps.instagramPublish, 'Set IG_USER_ID, IG_ACCESS_TOKEN and PUBLIC_MEDIA_BASE_URL'],
    ['TikTok publishing', caps.tiktokPublish, 'Set TIKTOK_ACCESS_TOKEN'],
    ['TikTok direct post', caps.tiktokDirectPost, 'Requires passing TikTok app audit — drafts flow works meanwhile'],
    ['Live trend research', caps.liveResearch, 'Set FIRECRAWL_API_KEY and enable the Firecrawl connector'],
    ['Booking URL', caps.bookingUrlSet, 'Set business.bookingUrl in config/brand.json'],
    ['Consent policy', caps.consentPolicySet, 'Set consent.policy in config/brand.json'],
  ];

  process.stdout.write(`\n${brand.business.name} — system check\n\n`);
  for (const [label, ok, fix] of rows) {
    const mark = ok ? '\x1b[32m ok \x1b[0m' : '\x1b[33mtodo\x1b[0m';
    process.stdout.write(`  [${mark}] ${label.padEnd(22)}${ok ? '' : `→ ${fix}`}\n`);
  }

  process.stdout.write(`\n  Footage: ${inv.total} clip(s), ${inv.unused} unused (${inv.totalUnusedSeconds}s)\n`);
  if (Object.keys(inv.byTag).length) {
    process.stdout.write(`  Tagged:  ${Object.entries(inv.byTag).map(([k, v]) => `${k} ${v}`).join(', ')}\n`);
  }

  const mode = tiktok.resolveMode();
  process.stdout.write(`\n  TikTok mode: ${mode}${mode === 'inbox' ? ' (posts land in drafts for one tap)' : ' (fully automatic)'}\n`);

  const checklist = tiktok.auditChecklist();
  const remaining = checklist.filter((c) => !c.done);
  if (remaining.length) {
    process.stdout.write('\n  To unlock TikTok auto-posting:\n');
    for (const c of remaining) process.stdout.write(`    · ${c.text}\n`);
  }
  process.stdout.write('\n');
}

function status() {
  const posts = store.read('posts', []);
  const p = store.read('plan', { slots: [] });
  const t = store.read('trends', {});
  const by = {};
  for (const post of posts) by[post.status] = (by[post.status] || 0) + 1;

  process.stdout.write(`\n  Week of ${p.weekOf || '—'} · ${p.slots?.length || 0} slot(s) planned\n`);
  process.stdout.write(`  Trend brief: ${t.generatedAt ? `${t.items?.length || 0} trends, ${t.live ? 'live' : 'offline'}` : 'not generated'}\n`);
  process.stdout.write(`  Posts: ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(', ') || 'none yet'}\n\n`);

  const waiting = posts.filter((x) => x.status === 'awaiting_approval');
  if (waiting.length) {
    process.stdout.write(`  Waiting on Sha (${waiting.length}):\n`);
    for (const w of waiting) {
      const warn = w.gate?.warnings?.length ? ` · ${w.gate.warnings.length} warning` : '';
      process.stdout.write(`    ${w.id}  ${w.formatName}  ${w.render?.durationSec?.toFixed(1)}s${warn}\n`);
    }
    process.stdout.write('\n');
  }
}

async function week({ dryRun }) {
  // The coordinator owns ordering, retries and escalation; the CLI just asks
  // for a week and reports what came back.
  const record = await coordinator.run({ dryRun, stopBefore: 'publisher' });

  if (record.escalations.length) {
    process.stdout.write('\n  Escalations:\n');
    for (const e of record.escalations) {
      process.stdout.write(`    [${e.level}] ${e.agentId}: ${e.message}\n`);
    }
  }
  if (record.halted) {
    process.stdout.write('\n  Run halted — see the blocker above.\n');
  } else {
    log.info('posts are queued for approval; run `sha ship` once Sha has approved');
  }
  status();
}

const [, , command, ...rest] = process.argv;
const dryRun = flag('dry-run');
const force = flag('force');

try {
  switch (command) {
    case 'doctor': await doctor(); break;
    case 'ingest': await ingest.run(); break;
    case 'research': await research.run(); break;
    case 'plan': await plan.run(); break;
    case 'cut': case 'render': await render.run(); break;
    case 'gate': await gate.run(); break;
    case 'approve': {
      const id = rest.find((a) => !a.startsWith('--'));
      if (!id) throw new Error('Usage: sha approve <postId>');
      const p = gate.decide(id, 'approve');
      log.ok(`approved ${p.id}`);
      break;
    }
    case 'reject': {
      const args = rest.filter((a) => !a.startsWith('--'));
      const [id, ...why] = args;
      if (!id) throw new Error('Usage: sha reject <postId> [reason]');
      const p = gate.decide(id, 'reject', why.join(' ') || null);
      log.ok(`rejected ${p.id}`);
      break;
    }
    case 'ship': await ship.run({ dryRun, force }); break;
    case 'learn': await learn.run(); break;
    case 'review': await reviewReport(); break;
    case 'goals': await goals.run(); break;
    // `.start` is the weekly kick-off. Accepted with or without the dot so it
    // reads the same typed here, in the dashboard, or in chat.
    case '.start': case 'start': await startWeek({ dryRun }); break;
    case 'week': await week({ dryRun }); break;
    case 'agents': {
      process.stdout.write('\n  Agent roster (dependency-ordered)\n\n');
      for (const a of coordinator.explain()) {
        const flag = a.critical ? '\x1b[33mcritical\x1b[0m' : 'optional';
        const deg = a.degraded.length ? ` \x1b[33m· degraded: ${a.degraded.join(', ')}\x1b[0m` : '';
        process.stdout.write(`  ${a.name.padEnd(12)}${flag.padEnd(18)}${a.role}${deg}\n`);
      }
      process.stdout.write('\n');
      break;
    }
    case 'status': status(); break;
    case 'help': case undefined: process.stdout.write(HELP); break;
    default:
      process.stderr.write(`Unknown command: ${command}\n${HELP}`);
      process.exit(1);
  }
} catch (err) {
  process.stderr.write(`\n\x1b[31mFailed:\x1b[0m ${err.message}\n\n`);
  process.exit(1);
}
