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

export const MODES = { INBOX: 'inbox', DIRECT: 'direct', BROKER: 'broker' };

/**
 * The broker route.
 *
 * A third option exists and is better than both: publish through an
 * already-audited partner app (Higgsfield's TikTok connector) instead of
 * getting our own app audited. Its client has passed TikTok's review, so
 * DIRECT_POST at PUBLIC_TO_EVERYONE works on day one — no audit wait, no
 * SELF_ONLY restriction — and it can attach a Commercial Music Library track,
 * which the raw API cannot do for a draft at all.
 *
 * The handoff is deliberate: this engine owns everything up to a finished,
 * approved MP4 plus caption, and the broker owns the last hop. Publishing
 * therefore happens through MCP tool calls rather than an HTTP client here,
 * so what this module does is mark a post broker-ready and record the exact
 * payload the broker needs.
 *
 * Broker quotas (enforced before TikTok is called): 5 posts/minute and
 * 13 posts/24h rolling. Media: MP4/WebM/MOV, ≤1 GB, 3-600s, ≥360px both
 * sides, 23-60 fps.
 */
export const BROKER = {
  name: 'higgsfield',
  auditedByPartner: true,
  supportsDirectPost: true,
  supportsCommercialMusic: true,
  quotas: { perMinute: 5, per24h: 13 },
  media: { maxBytes: 1073741824, minSec: 3, maxSec: 600, minEdgePx: 360, minFps: 23, maxFps: 60 },
  steps: [
    'tiktok_accounts — confirm the account is active',
    'media_upload_widget or media_import_url — host the render on Higgsfield (TikTok requires a verified source domain)',
    'tiktok_music_trending — optional, pick a licensed track (DIRECT_POST only)',
    'tiktok_prepare_publish — validates media, returns required confirmations',
    'tiktok_publish — mode DIRECT_POST, privacy PUBLIC_TO_EVERYONE',
    'tiktok_publish_status — confirm it landed',
  ],
};

/** Does this render satisfy the broker's media rules? Checked before handoff. */
export function brokerPreflight(post) {
  const problems = [];
  const r = post.render || {};
  const d = r.durationSec || 0;
  if (d < BROKER.media.minSec) problems.push(`${d.toFixed(1)}s is under the ${BROKER.media.minSec}s minimum`);
  if (d > BROKER.media.maxSec) problems.push(`${d.toFixed(1)}s exceeds ${BROKER.media.maxSec}s`);
  if (r.sizeBytes > BROKER.media.maxBytes) problems.push('over the 1 GB limit');
  if (Math.min(r.width || 0, r.height || 0) < BROKER.media.minEdgePx) {
    problems.push(`shortest edge under ${BROKER.media.minEdgePx}px`);
  }
  return { ok: problems.length === 0, problems, route: MODES.BROKER };
}

/** Everything the broker needs, so the handoff carries no guesswork. */
export function brokerPayload(post) {
  return {
    route: BROKER.name,
    mode: 'DIRECT_POST',
    privacy_level: 'PUBLIC_TO_EVERYONE',
    media_type: 'VIDEO',
    title: buildCaption(post).slice(0, 150),
    description: buildCaption(post),
    localFile: post.render?.outFile || null,
    // Sha's own footage of her own work: not AI-generated, not branded content
    // for a third party. Both declarations matter to TikTok.
    is_aigc: false,
    commercial_content_disclosure: { enabled: false, your_brand: false, branded_content: false },
    preflight: brokerPreflight(post),
  };
}

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
  // Broker first: it reaches a public audience today, where our own unaudited
  // app cannot reach anyone at all.
  if (system.publishing.tiktok.route === MODES.BROKER) return MODES.BROKER;
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

export default {
  publish, preflight, buildCaption, resolveMode, checkStatus, auditChecklist,
  brokerPreflight, brokerPayload, LIMITS, MODES, BROKER,
};
