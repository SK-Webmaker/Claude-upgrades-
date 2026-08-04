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
  sha week [--dry-run]    Run the full Monday sequence end to end
  sha status              Where everything currently stands

Flags
  --dry-run               Go through the motions without publishing anything
  --force                 Ignore schedule times when shipping
`;

function flag(name) {
  return process.argv.includes(`--${name}`);
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
  log.info('running the full weekly sequence');
  await ingest.run();
  await research.run();
  await plan.run();
  await render.run();
  await gate.run();
  if (dryRun) {
    log.warn('dry run — stopping before publish. Approve posts, then run `sha ship`.');
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
    case 'week': await week({ dryRun }); break;
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
