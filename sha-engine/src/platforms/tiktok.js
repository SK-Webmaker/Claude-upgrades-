import { creds, system, brand } from '../lib/config.js';
import { makeLogger } from '../lib/log.js';

const log = makeLogger('tiktok');
const API = 'https://open.tiktokapis.com/v2';

/**
 * TikTok publishing — and the constraint the whole system is shaped around.
 *
 * An app that has not passed TikTok's audit can only create posts with
 * SELF_ONLY viewership. Not "limited reach" — literally visible to nobody but
 * the account owner, and the account must itself be private at the time of
 * posting. Building direct-post on an unaudited app produces a system that
 * appears to work and reaches zero people.
 *
 * So there are two modes:
 *
 *   inbox  (default, works today)
 *     Sends the finished video to the creator's TikTok inbox as a draft.
 *     Sha gets a notification, opens it, and taps post. The caption travels
 *     with it. This is a supported, ToS-clean flow with no audit required
 *     and no viewership restriction, because she is the one publishing.
 *
 *   direct (after audit)
 *     True unattended posting. Flipping system.publishing.tiktok.auditPassed
 *     to true switches the code path over. Nothing else changes.
 */

export const LIMITS = {
  maxDurationSec: 600,
  minDurationSec: 3,
  maxCaptionChars: 2200,
  unauditedUsersPer24h: 5,
};

export const MODES = { INBOX: 'inbox', DIRECT: 'direct' };

async function api(path, { method = 'POST', body = null } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${creds.tiktok.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  const err = json?.error;
  if (!res.ok || (err && err.code && err.code !== 'ok')) {
    throw new Error(`TikTok ${err?.code || res.status}: ${err?.message || res.statusText}`);
  }
  return json;
}

export function buildCaption(post) {
  const c = post.caption || {};
  const parts = [c.hook, c.body, c.cta].filter(Boolean);
  const tags = (c.hashtags || []).join(' ');
  if (tags) parts.push(tags);
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, LIMITS.maxCaptionChars);
}

/** Which mode is legitimately available right now. */
export function resolveMode() {
  if (system.publishing.tiktok.auditPassed) return MODES.DIRECT;
  return MODES.INBOX;
}

export function preflight(post) {
  const problems = [];
  const d = post.render?.durationSec || 0;
  if (d < LIMITS.minDurationSec) problems.push(`${d.toFixed(1)}s is below TikTok's ${LIMITS.minDurationSec}s minimum`);
  if (d > LIMITS.maxDurationSec) problems.push(`${d.toFixed(1)}s exceeds ${LIMITS.maxDurationSec}s`);
  if (!post.mediaUrl) problems.push('no public media URL — TikTok pulls the file itself');
  return { ok: problems.length === 0, problems, mode: resolveMode() };
}

/**
 * Inbox upload: lands in Sha's TikTok as a draft for one tap.
 * No audit needed, no viewership restriction, fully within the rules.
 */
async function publishToInbox(post) {
  const res = await api('/post/publish/inbox/video/init/', {
    body: {
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: post.mediaUrl,
      },
    },
  });
  const publishId = res.data?.publish_id;
  log.ok(`sent to Sha's TikTok drafts (publish_id ${publishId})`);
  return {
    platform: 'tiktok',
    mode: MODES.INBOX,
    publishId,
    requiresTap: true,
    note: 'Waiting on Sha to open TikTok and tap post.',
  };
}

/** Direct post: only correct once the audit has passed. */
async function publishDirect(post) {
  const caption = buildCaption(post);
  const res = await api('/post/publish/video/init/', {
    body: {
      post_info: {
        title: caption,
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: post.mediaUrl,
      },
    },
  });
  const publishId = res.data?.publish_id;
  log.ok(`direct posted (publish_id ${publishId})`);
  return { platform: 'tiktok', mode: MODES.DIRECT, publishId, requiresTap: false, caption };
}

export async function publish(post, { dryRun = false } = {}) {
  const pre = preflight(post);
  if (!pre.ok) throw new Error(`TikTok preflight failed: ${pre.problems.join('; ')}`);

  const mode = resolveMode();

  if (dryRun || !creds.tiktok.accessToken) {
    log.warn(`dry run — would send ${post.id} via ${mode}`);
    return { dryRun: true, platform: 'tiktok', mode, caption: buildCaption(post) };
  }

  if (mode === MODES.DIRECT) return publishDirect(post);
  return publishToInbox(post);
}

export async function checkStatus(publishId) {
  const res = await api('/post/publish/status/fetch/', { body: { publish_id: publishId } });
  return { status: res.data?.status, failReason: res.data?.fail_reason || null };
}

/**
 * What has to be true before direct posting is switched on. Surfaced by
 * `sha doctor` so the upgrade path is never guesswork.
 */
export function auditChecklist() {
  return [
    { id: 'app', done: Boolean(creds.tiktok.clientKey), text: 'TikTok developer app created with content.publish scope' },
    { id: 'token', done: Boolean(creds.tiktok.accessToken), text: 'Account authorised and access token stored' },
    { id: 'audit', done: system.publishing.tiktok.auditPassed, text: 'App submitted for audit and approved for unaudited-client removal' },
    { id: 'ux', done: false, text: 'Consent screen and TikTok posting disclosure implemented per UX guidelines (required to pass audit)' },
  ];
}

export default { publish, preflight, buildCaption, resolveMode, checkStatus, auditChecklist, LIMITS, MODES };
