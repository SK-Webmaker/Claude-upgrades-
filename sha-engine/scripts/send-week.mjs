#!/usr/bin/env node
/**
 * /send — email the finished week to Sha.
 *
 * This exists because of a measured failure, not a feature request. Week 1
 * produced three posts and three guides and none of them went up; the reason
 * she gave was that she never saw them. The work was finished and sitting in
 * content/cards. A system that produces work nobody receives has not produced
 * anything.
 *
 *   node scripts/send-week.mjs --dry-run     # render, write to disk, send nothing
 *   node scripts/send-week.mjs               # actually send
 *
 * Images are embedded from raw.githubusercontent.com rather than attached.
 * GMAIL_SEND_EMAIL's `attachment` field takes a single object keyed by an
 * s3key — not a list — and Composio exposes no upload endpoint on the REST
 * surface, so three cards cannot be attached in one message. Embedding also
 * reads better: she sees each card directly above its own caption instead of
 * matching filenames to text.
 *
 * URLs are pinned to a commit SHA, not a branch. A branch URL dies the moment
 * the branch is merged or renamed, and an email that breaks a week after it is
 * sent is worse than no email.
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const envFile = join(ROOT, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
} catch {
  /* check-creds.mjs is what reports credential problems */
}

const BASE = process.env.COMPOSIO_BASE_URL || 'https://backend.composio.dev';
const KEY = process.env.COMPOSIO_API_KEY || '';
const GMAIL_ACCOUNT = process.env.COMPOSIO_GMAIL_ACCOUNT_ID || '';
const USER = process.env.COMPOSIO_USER_ID || 'sha';
const TO = process.env.SHA_EMAIL || '';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const weekArg = (args.find((a) => a.startsWith('--week=')) || '').split('=')[1];

const red = (m) => `\x1b[31m${m}\x1b[0m`;
const green = (m) => `\x1b[32m${m}\x1b[0m`;
const dim = (m) => `\x1b[2m${m}\x1b[0m`;

/* ---------- the pack ---------- */

const { forWeek } = await import(join(ROOT, 'src/lib/pack.js'));
const PACKS = join(ROOT, 'content', 'packs');

// Newest pack on disk, which is the one just authored. Deliberately not
// forWeek(today): that resolves to the week already in progress, so running
// /send on a Friday would mail out last week's pack instead of the new one.
const newest = readdirSync(PACKS)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
  .sort()
  .pop();
const target = weekArg || newest;
const pack = forWeek(target);

if (!pack || pack.weekOf !== target) {
  console.error(red(`No pack found for ${target}`));
  process.exit(1);
}

/* ---------- where the images live ---------- */

function gitOut(cmd, fallback) {
  try {
    return execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return fallback;
  }
}

const sha = gitOut('git rev-parse HEAD', '');
const remote = gitOut('git remote get-url origin', '');
const slug = (remote.match(/github\.com[:/](.+?)(?:\.git)?$/) || [])[1] || '';
const imageBase = sha && slug
  ? `https://raw.githubusercontent.com/${slug}/${sha}/sha-engine/content/cards`
  : null;

/* ---------- html ---------- */

const INK = '#12100E';
const GOLD = '#B07C33';
const VIOLET = '#6A5B8C';
const CREAM = '#F6F1E9';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** The caption exactly as it must be pasted, hashtags included. */
function fullCaption(c) {
  return [c.hook, c.body, c.cta, (c.hashtags || []).join(' ')].filter(Boolean).join('\n\n');
}

/** A block she can select and copy on a phone without picking up stray text. */
function copyBlock(text) {
  return `<pre style="white-space:pre-wrap;word-wrap:break-word;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;color:${INK};background:${CREAM};border-left:3px solid ${GOLD};border-radius:2px;padding:18px 20px;margin:0 0 8px">${esc(text)}</pre>`;
}

function postBlock(p, i) {
  const img = imageBase
    ? `<img src="${imageBase}/${encodeURIComponent(p.image)}" alt="${esc(p.imageAlt)}" width="560" style="width:100%;max-width:560px;height:auto;display:block;border-radius:3px;margin:0 0 18px">`
    : `<p style="color:#b00">[image unavailable — repo URL could not be resolved]</p>`;
  const steps = (p.howToPost || [])
    .map((s) => `<li style="margin:0 0 6px">${esc(s)}</li>`)
    .join('');
  return `
  <tr><td style="padding:0 0 44px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${GOLD};font-weight:600">
      ${i + 1} &middot; ${esc(p.day)} &middot; ${esc(new Date(p.postAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Melbourne' }))}
    </p>
    <h2 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:${INK};font-weight:600">${esc(p.title)}</h2>
    ${img}
    <p style="margin:0 0 8px;font-size:13px;color:#666">Save the image, then copy this caption:</p>
    ${copyBlock(fullCaption(p.caption))}
    <ul style="margin:14px 0 0;padding-left:20px;font-size:14px;line-height:1.5;color:#444">${steps}</ul>
  </td></tr>`;
}

function guideBlock(g, i) {
  const copy = g.copyThis || {};
  const steps = (copy.howToCopy || [])
    .map((s) => `<li style="margin:0 0 7px">${esc(s)}</li>`)
    .join('');
  const shots = (g.shots || []).map((s) => `<li style="margin:0 0 5px">${esc(s)}</li>`).join('');
  const text = (g.onScreenText || []).map((s) => `<li style="margin:0 0 4px">${esc(s)}</li>`).join('');
  const also = (g.alsoWatch || [])
    .map(
      (a) =>
        `<li style="margin:0 0 6px"><a href="${esc(a.url)}" style="color:${VIOLET}">${esc(a.creator)}</a> — ${esc(a.what)}</li>`,
    )
    .join('');
  return `
  <tr><td style="padding:0 0 40px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${GOLD};font-weight:600">
      Video ${i + 1} &middot; ${esc((g.lengthSec || []).join('–'))}s
    </p>
    <h2 style="margin:0 0 6px;font-size:21px;line-height:1.3;color:${INK};font-weight:600">${esc(g.title)}</h2>
    <p style="margin:0 0 14px;font-size:13px;color:#666">${esc(g.difficulty)}</p>

    <p style="margin:0 0 10px;font-size:15px;color:${INK}">
      <strong>Watch this one, then rebuild it with your own footage:</strong><br>
      <a href="${esc(copy.url)}" style="color:${VIOLET};font-size:16px">${esc(copy.creator)} &rarr; ${esc(copy.url)}</a>
    </p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#444">${esc(copy.whatItIs)}</p>

    <p style="margin:0 0 6px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:${GOLD};font-weight:600">How to copy it</p>
    <ol style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.55;color:#333">${steps}</ol>

    <p style="margin:0 0 6px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:${GOLD};font-weight:600">Shot list</p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.5;color:#444">${shots}</ul>

    <p style="margin:0 0 6px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:${GOLD};font-weight:600">Text on screen</p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.5;color:#444">${text}</ul>

    <p style="margin:0 0 8px;font-size:14px;color:#444"><strong>Audio.</strong> ${esc(g.audio)}</p>
    <p style="margin:0 0 14px;font-size:14px;color:#444"><strong>Watch for.</strong> ${esc(g.watchFor)}</p>

    <p style="margin:0 0 8px;font-size:13px;color:#666">Caption for it:</p>
    ${copyBlock(fullCaption(g.caption))}

    ${also ? `<p style="margin:14px 0 6px;font-size:13px;color:#666">Also worth watching:</p><ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.5;color:#444">${also}</ul>` : ''}
  </td></tr>`;
}

const html = `<div style="background:#fff;padding:0;margin:0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <tr><td style="padding:32px 20px 28px">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:${GOLD};font-weight:600">Hair by Sha &middot; week of ${esc(pack.weekOf)}</p>
    <h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;color:${INK};font-weight:600">${esc(pack.title)}</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#444">
      Three posts and three videos, finished. Save each image, copy the caption under it, post it on the day listed. Nothing here posts itself.
    </p>
  </td></tr>

  <tr><td style="padding:0 20px">
    <div style="height:1px;background:#e3ded6;margin:0 0 32px"></div>
  </td></tr>

  <tr><td style="padding:0 20px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      ${pack.posts.map(postBlock).join('')}
    </table>
  </td></tr>

  <tr><td style="padding:8px 20px 28px">
    <div style="height:1px;background:#e3ded6;margin:0 0 28px"></div>
    <h2 style="margin:0 0 8px;font-size:22px;color:${INK};font-weight:600">The videos</h2>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#444">
      Each one points at a real video that already works in this niche. Open it, watch it twice, then film your own version of the same thing.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      ${pack.videoGuides.map(guideBlock).join('')}
    </table>
  </td></tr>

  <tr><td style="padding:0 20px 40px">
    <div style="height:1px;background:#e3ded6;margin:0 0 24px"></div>
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${GOLD};font-weight:600">This week</p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#444">${esc(pack.projection)}</p>
  </td></tr>

  <tr><td style="padding:0 20px 40px">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#999">
      Hair by Sha &middot; Camberwell VIC &middot; <a href="https://instagram.com/hairbysha_c" style="color:#999">@hairbysha_c</a>
    </p>
  </td></tr>
</table></div>`;

const subject = `Your week — ${pack.posts.length} posts, ${pack.videoGuides.length} videos (w/c ${pack.weekOf})`;

/* ---------- send ---------- */

if (dryRun) {
  const out = join(ROOT, 'data', 'send-preview.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`\n  ${green('dry run')} — nothing sent\n`);
  console.log(`  pack      ${pack.weekOf}  (${pack.posts.length} posts, ${pack.videoGuides.length} guides)`);
  console.log(`  subject   ${subject}`);
  console.log(`  to        ${TO || dim('SHA_EMAIL not set')}`);
  console.log(`  images    ${imageBase ? dim(imageBase) : red('unresolved')}`);
  console.log(`  preview   ${out}\n`);
  process.exit(0);
}

const missing = [];
if (!KEY) missing.push('COMPOSIO_API_KEY');
if (!GMAIL_ACCOUNT) missing.push('COMPOSIO_GMAIL_ACCOUNT_ID');
if (!TO) missing.push('SHA_EMAIL');
if (missing.length) {
  console.error(`\n  ${red('Cannot send')} — not set: ${missing.join(', ')}`);
  console.error('  Run node scripts/check-creds.mjs, and see .env.example.\n');
  process.exit(1);
}
if (!imageBase) {
  console.error(`\n  ${red('Cannot send')} — could not resolve the image URLs from git.`);
  console.error('  The cards must be pushed and publicly reachable before sending.\n');
  process.exit(1);
}

const res = await fetch(`${BASE}/api/v3/tools/execute/GMAIL_SEND_EMAIL`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-api-key': KEY },
  body: JSON.stringify({
    connected_account_id: GMAIL_ACCOUNT,
    user_id: USER,
    arguments: { recipient_email: TO, subject, body: html, is_html: true },
  }),
});

const payload = await res.json().catch(() => null);
if (!res.ok || payload?.successful === false || payload?.error) {
  const detail = payload?.error?.message ?? payload?.error ?? `HTTP ${res.status}`;
  console.error(`\n  ${red('Send failed')}: ${detail}\n`);
  process.exit(1);
}

console.log(`\n  ${green('Sent')} to ${TO} — "${subject}"\n`);
