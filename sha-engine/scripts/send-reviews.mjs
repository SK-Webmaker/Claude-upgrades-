#!/usr/bin/env node
/**
 * Email the seven Facebook review posts to Sha.
 *
 *   node scripts/send-reviews.mjs --dry-run    # render to disk, send nothing
 *   node scripts/send-reviews.mjs              # actually send
 *
 * Written for someone who is not technical and is reading it on a phone. That
 * drives most of the choices here: every instruction is a numbered step naming
 * the thing she taps, the caption sits in its own block so a long-press selects
 * the caption and nothing else, and each post carries the date it goes up rather
 * than "week 2".
 *
 * Images embed from raw.githubusercontent.com pinned to a commit SHA, same as
 * send-week.mjs — a branch URL dies when the branch merges, and an email that
 * breaks a fortnight after it is sent is worse than no email. These are staged
 * over three weeks, so that matters more here than usual.
 *
 * Captions deliberately carry no hashtag block. Facebook hashtags do very little
 * for reach and a wall of Instagram tags on a Facebook post reads as copy-paste.
 * The Critic flags that as a hashtag-count warning on all seven; it is a warning,
 * not a blocker, and it is the intended state.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
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

const dryRun = process.argv.includes('--dry-run');

const red = (m) => `\x1b[31m${m}\x1b[0m`;
const green = (m) => `\x1b[32m${m}\x1b[0m`;
const dim = (m) => `\x1b[2m${m}\x1b[0m`;

const data = JSON.parse(readFileSync(join(ROOT, 'content', 'social-proof', 'review-posts.json'), 'utf8'));

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
const imageBase =
  sha && slug ? `https://raw.githubusercontent.com/${slug}/${sha}/sha-engine/content/social-proof` : null;

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

/** A block she can long-press and copy on a phone without picking up stray text. */
function copyBlock(text) {
  return `<pre style="white-space:pre-wrap;word-wrap:break-word;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.65;color:${INK};background:${CREAM};border-left:3px solid ${GOLD};padding:18px 20px;margin:0">${esc(text)}</pre>`;
}

function postBlock(p, i) {
  const img = `<img src="${imageBase}/${encodeURIComponent(p.image)}" alt="${esc(p.who)}" width="520" style="width:100%;max-width:520px;height:auto;display:block;margin:0 0 18px;border:1px solid #e3ded6">`;

  const pinStep = p.pin
    ? `<li style="margin:0 0 10px"><strong>Then pin it.</strong> On the post you just made, tap the three dots <strong>&middot;&middot;&middot;</strong> in the top right corner, then tap <strong>Pin to top of Page</strong>. This is a separate step and it is the one people forget — without it the post slides down and nobody sees it.</li>`
    : '';

  const note = p.note
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#555;background:#fbf9f5;border-left:3px solid ${VIOLET};padding:12px 16px">${esc(p.note)}</p>`
    : '';

  return `
  <tr><td style="padding:0 0 8px">
    <div style="height:1px;background:#e3ded6;margin:0 0 30px"></div>
    <p style="margin:0 0 6px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:${GOLD};font-weight:700">
      Post ${i + 1} of ${data.posts.length} &nbsp;&middot;&nbsp; ${esc(p.day)}
    </p>
    <h2 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${INK};font-weight:600">${esc(p.who)}${p.pin ? ' &mdash; pin this one' : ''}</h2>
    ${note}
    ${img}
    <p style="margin:0 0 8px;font-size:14px;color:#555"><strong>The words to go with it</strong> — copy everything in the box:</p>
    ${copyBlock(p.caption)}
    <ol style="margin:16px 0 34px;padding-left:22px;font-size:15px;line-height:1.6;color:#333">
      <li style="margin:0 0 10px">Press and hold the picture above until a menu appears, then tap <strong>Save</strong> or <strong>Download</strong>.</li>
      <li style="margin:0 0 10px">Press and hold inside the grey box, choose <strong>Select all</strong>, then <strong>Copy</strong>.</li>
      <li style="margin:0 0 10px">Open Facebook and go to your <strong>Hair by Sha</strong> page.</li>
      <li style="margin:0 0 10px">Tap where it says <strong>What's on your mind</strong>, then tap <strong>Photo</strong> and pick the picture you just saved.</li>
      <li style="margin:0 0 10px">Paste the words in, check it looks right, and tap <strong>Post</strong>.</li>
      ${pinStep}
    </ol>
  </td></tr>`;
}

const html = `<div style="background:#fff;padding:0;margin:0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">

  <tr><td style="padding:32px 20px 10px">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:${GOLD};font-weight:700">Hair by Sha &middot; Facebook</p>
    <h1 style="margin:0 0 16px;font-size:27px;line-height:1.25;color:${INK};font-weight:600">Your review posts, ready to go</h1>
  </td></tr>

  <tr><td style="padding:0 20px 24px">
    <div style="background:#FBF0E8;border:2px solid ${GOLD};padding:20px 22px">
      <p style="margin:0 0 10px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#8C4A3A;font-weight:700">Please read this bit first</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:${INK}">
        <strong>Read every post over before you put it up, and change anything that is not right.</strong>
        Prices, opening hours and the way you word things do change, and I may not have the latest.
        You know the business better than this email does &mdash; if something reads wrong, trust yourself and fix it.
      </p>
      <p style="margin:0;font-size:15px;line-height:1.65;color:${INK}">
        The one thing not to change is <strong>what the clients themselves wrote</strong>. Those are copied
        word for word from your website, spelling and all. Tidying someone's review is what makes it start
        to look like the salon wrote it.
      </p>
    </div>
  </td></tr>

  <tr><td style="padding:0 20px 26px">
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#333">
      These are seven posts for your <strong>Facebook page</strong> &mdash; one to sit at the top permanently,
      and six real reviews from your website turned into pictures.
    </p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#333">
      <strong>Two a week, on Wednesdays and Thursdays.</strong> Those are your quiet days at the moment,
      and a good review landing on a quiet day is what nudges someone to book into it. Putting all six up
      at once makes it look like an advert; spread out, it just looks like a business people keep liking.
    </p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#333">
      Each one below has the picture, the words, and the steps. Nothing posts by itself &mdash; you are in
      control of all of it.
    </p>
  </td></tr>

  <tr><td style="padding:0 20px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      ${data.posts.map(postBlock).join('')}
    </table>
  </td></tr>

  <tr><td style="padding:0 20px 34px">
    <div style="height:1px;background:#e3ded6;margin:0 0 24px"></div>
    <p style="margin:0 0 6px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:${GOLD};font-weight:700">One thing you might notice is missing</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#333">
      There is no post saying <strong>&ldquo;5 stars on Google&rdquo;</strong>, and that is on purpose. You do not
      have a Google business listing yet, so there is no star rating for anyone to go and check. If a post
      claims one and somebody taps through and finds nothing, that does more damage than the post does good.
    </p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#333">
      Setting up a free Google listing is about an hour and it is the single most valuable thing left on the
      list &mdash; especially now you are open Sundays, because almost nobody searching
      <em>&ldquo;hairdresser open Sunday near me&rdquo;</em> around Camberwell gets a result. Worth doing when
      you have a quiet afternoon.
    </p>
  </td></tr>

  <tr><td style="padding:0 20px 40px">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#999">
      Hair by Sha &middot; Camberwell VIC &middot; <a href="https://instagram.com/hairbysha_c" style="color:#999">@hairbysha_c</a>
    </p>
  </td></tr>
</table></div>`;

const subject = 'Your Facebook review posts — 7 ready, 2 a week from Wednesday';

/* ---------- send ---------- */

if (dryRun) {
  const out = join(ROOT, 'data', 'send-reviews-preview.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`\n  ${green('dry run')} — nothing sent\n`);
  console.log(`  posts     ${data.posts.length}`);
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
  process.exit(1);
}
if (!imageBase) {
  console.error(`\n  ${red('Cannot send')} — could not resolve the image URLs from git.`);
  console.error('  The cards must be committed and pushed before sending.\n');
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
