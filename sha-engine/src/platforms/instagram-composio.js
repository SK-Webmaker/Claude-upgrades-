import { creds, brand } from '../lib/config.js';
import { makeLogger } from '../lib/log.js';

const log = makeLogger('instagram-composio');

/**
 * Instagram publishing through Composio's OAuth connection.
 *
 * Drop-in replacement for `instagram.js`, which assumed a raw Graph API access
 * token. Sha's account is connected through Composio (OAuth), so we never hold a
 * Meta token — Composio executes the Graph call on the connection's behalf.
 *
 * Same export surface as the adapter it replaces, so `ship.js` swaps one import
 * and nothing else changes.
 *
 * ---------------------------------------------------------------------------
 * What Composio exposes, and what it does not
 *
 *   INSTAGRAM_POST_IG_USER_MEDIA          -> creates a media *container*
 *   INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH  -> publishes that container
 *
 * There is no draft creation. A container is an invisible server-side staging
 * handle: it never appears in the Instagram app, Sha cannot see or tap it, and
 * it expires in ~24 hours. Meta's API has no save-to-drafts endpoint at all —
 * drafts are in-app only.
 *
 * This matters because the journal's "Current publishing posture" and the
 * Publisher's own log line (`requiresTap ? '→ drafts, awaiting tap'`) both
 * describe content landing in Sha's Instagram drafts. That works for TikTok,
 * which has a real inbox/draft API (journal entry 1). It does not exist for
 * Instagram. Publishing here is immediate and public, so the approval gate in
 * `ship.js` is the only thing standing between a draft and her audience.
 * `requiresTap` is therefore never returned by this adapter.
 *
 * ---------------------------------------------------------------------------
 * Platform limits still apply, whichever tool wraps the call
 *
 *   - Business or Creator account required. Verified live: BUSINESS.
 *   - The Facebook Page link is a *Facebook Login* requirement. This connection
 *     uses Instagram Login (calls resolve against graph.instagram.com), where
 *     the Page link is not required. Journal entry 8 lists it as mandatory;
 *     that holds for the old token path, not this one.
 *   - Media must be publicly fetchable by Meta — journal entry 8's trap is
 *     unchanged, so `preflight` still refuses a post with no public URL.
 *   - Containers are not ready the instant you create them. The publish tool
 *     polls internally; `maxWaitSeconds` sizes that wait.
 */

/**
 * Reels ceilings are Meta's published limits.
 *
 * `dailyPosts` is deliberately not a hardcoded 25. Read live from this account
 * on 2026-08-11: quota_total 100, quota_usage 0. The cap is account-specific, so
 * a constant here would be exactly the kind of unverified number this project
 * refuses to assert. `quotaRemaining()` is the source of truth; this value is
 * only the fallback when the live read fails, and it is marked as such.
 */
export const LIMITS = {
  dailyPostsFallback: 25,
  dailyPostsObserved: 100,
  maxDurationSec: 90,
  minDurationSec: 3,
  aspect: '9:16',
  maxCaptionChars: 2200,
  maxHashtags: 30,
};

const COMPOSIO_BASE = process.env.COMPOSIO_BASE_URL || 'https://backend.composio.dev';

function composioCreds() {
  return {
    apiKey: process.env.COMPOSIO_API_KEY || null,
    connectedAccountId: process.env.COMPOSIO_CONNECTED_ACCOUNT_ID || null,
    // "me" resolves the authenticated account, which avoids the mismatch between
    // the id GET_USER_INFO returns and the one the media edge pages against.
    igUserId: creds.instagram.userId || 'me',
  };
}

/** True when this adapter can actually reach Instagram. */
export function isConfigured() {
  const c = composioCreds();
  return Boolean(c.apiKey && creds.publicMediaBaseUrl);
}

/** POST /api/v3/tools/execute/{tool_slug} */
async function execute(toolSlug, args) {
  const { apiKey, connectedAccountId } = composioCreds();
  if (!apiKey) throw new Error('COMPOSIO_API_KEY is not set — cannot reach Instagram');

  const body = { arguments: args };
  if (connectedAccountId) body.connected_account_id = connectedAccountId;

  const res = await fetch(`${COMPOSIO_BASE}/api/v3/tools/execute/${toolSlug}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(body),
  });

  let payload;
  try {
    payload = await res.json();
  } catch {
    throw new Error(`${toolSlug}: non-JSON response (HTTP ${res.status})`);
  }

  if (!res.ok || payload.successful === false || payload.error) {
    const detail = payload?.error?.message ?? payload?.error ?? `HTTP ${res.status}`;
    throw new Error(`${toolSlug}: ${detail}`);
  }
  return payload.data;
}

export function buildCaption(post) {
  const c = post.caption || {};
  const parts = [];
  if (c.hook) parts.push(c.hook);
  if (c.body) parts.push(c.body);
  if (c.cta) {
    const url = brand.business.bookingUrl;
    parts.push(url && !url.startsWith('TODO') ? `${c.cta}\n${url}` : c.cta);
  }
  // Prefix defensively. A tag stored without "#" would otherwise publish as
  // plain text, which is how the live account lost half its discovery surface.
  const tags = (c.hashtags || [])
    .slice(0, LIMITS.maxHashtags)
    .map((t) => (String(t).startsWith('#') ? t : `#${t}`))
    .join(' ');
  if (tags) parts.push(tags);
  return parts.join('\n\n').slice(0, LIMITS.maxCaptionChars);
}

/** Video posts carry a render; photo posts do not. */
export function isVideoPost(post) {
  return Boolean(post.render?.durationSec) || post.mediaType === 'REELS';
}

/**
 * Preflight.
 *
 * Duration and aspect rules apply to video only. The Graph adapter applied them
 * unconditionally, which meant a photo post — with no `render` block, so
 * `durationSec` of 0 — always failed with "0.0s is below the 3s minimum". Since
 * the Editor was retired (journal entry 2), photo posts are the only thing the
 * Publisher still ships, so that check rejected everything it was left to do.
 */
export function preflight(post) {
  const problems = [];

  if (!post.mediaUrl) {
    problems.push('no public media URL — Meta fetches the file itself, it cannot read local disk');
  } else if (!/^https:\/\//i.test(post.mediaUrl)) {
    problems.push(`media URL must be HTTPS, got ${post.mediaUrl}`);
  }

  if (isVideoPost(post)) {
    const d = post.render?.durationSec || 0;
    if (d > LIMITS.maxDurationSec) {
      problems.push(`${d.toFixed(1)}s exceeds the ${LIMITS.maxDurationSec}s Reels limit`);
    }
    if (d < LIMITS.minDurationSec) {
      problems.push(`${d.toFixed(1)}s is below the ${LIMITS.minDurationSec}s minimum`);
    }
    if (post.render && post.render.height < post.render.width) problems.push('not vertical');
  }

  const caption = buildCaption(post);
  if (caption.length > LIMITS.maxCaptionChars) {
    problems.push(`caption is ${caption.length} characters, over the ${LIMITS.maxCaptionChars} limit`);
  }

  return { ok: problems.length === 0, problems };
}

/**
 * Confirms Meta can actually fetch the media before we spend a container on it.
 * Journal entry 8: a URL that isn't publicly reachable fails at the container
 * step with an error that doesn't explain itself.
 */
export async function verifyMediaUrl(url, { expect = 'image' } = {}) {
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (!res.ok || !res.headers.get('content-type')) {
      res = await fetch(url, { method: 'GET', headers: { range: 'bytes=0-1023' } });
    }
    if (!res.ok) return { ok: false, reason: `media URL returned HTTP ${res.status}` };

    const type = (res.headers.get('content-type') || '').toLowerCase();
    const wanted = expect === 'video' ? 'video/' : 'image/';
    if (!type.startsWith(wanted)) {
      return { ok: false, reason: `media URL served "${type || 'unknown'}", expected ${expect}` };
    }
    return { ok: true, contentType: type };
  } catch (err) {
    return { ok: false, reason: `media URL unreachable: ${err.message}` };
  }
}

/**
 * Publishes an approved post.
 *
 * `ship.js` already refuses anything not `status === 'approved'`. The same check
 * is repeated here so this adapter cannot be made to publish by a future caller
 * that forgets — the invariant should not depend on one call site.
 */
export async function publish(post, { dryRun = false, maxWaitSeconds = 180 } = {}) {
  const pre = preflight(post);
  if (!pre.ok) throw new Error(`Instagram preflight failed: ${pre.problems.join('; ')}`);

  if (post.status && post.status !== 'approved') {
    throw new Error(`refusing to publish ${post.id}: status is "${post.status}", not approved`);
  }

  const caption = buildCaption(post);
  const video = isVideoPost(post);

  if (dryRun || !isConfigured()) {
    log.warn(`dry run — would publish ${post.id} (${video ? 'reel' : 'photo'})`);
    return { dryRun: true, platform: 'instagram', caption, mediaUrl: post.mediaUrl };
  }

  const reachable = await verifyMediaUrl(post.mediaUrl, { expect: video ? 'video' : 'image' });
  if (!reachable.ok) throw new Error(`Instagram media check failed: ${reachable.reason}`);

  const { igUserId } = composioCreds();

  log.info(`creating container for ${post.id}`);
  const container = await execute('INSTAGRAM_POST_IG_USER_MEDIA', {
    ig_user_id: igUserId,
    caption,
    ...(video
      ? { media_type: 'REELS', video_url: post.mediaUrl, share_to_feed: true }
      : { image_url: post.mediaUrl, ...(post.altText ? { alt_text: post.altText } : {}) }),
  });

  if (!container?.id) throw new Error('container created but Composio returned no id');

  // Journal entry 8: the container is not ready the instant it is created. The
  // publish tool polls to FINISHED internally; images are near-instant, video
  // commonly needs 30-120s.
  log.info(`publishing container ${container.id}`);
  const published = await execute('INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH', {
    ig_user_id: igUserId,
    creation_id: container.id,
    max_wait_seconds: video ? maxWaitSeconds : 30,
  });

  if (!published?.id) throw new Error('publish returned no media id');

  let permalink = null;
  try {
    const media = await execute('INSTAGRAM_GET_IG_MEDIA', {
      ig_media_id: published.id,
      fields: 'id,permalink,media_type,timestamp',
    });
    permalink = media?.permalink ?? null;
  } catch (err) {
    // The post is already live; a missing permalink is cosmetic.
    log.warn(`published, but could not read permalink: ${err.message}`);
  }

  log.ok(`published ${published.id}${permalink ? ` — ${permalink}` : ''}`);
  return {
    platform: 'instagram',
    id: published.id,
    containerId: container.id,
    permalink,
    caption,
    // Instagram has no draft path. This is live the moment it returns.
    requiresTap: false,
  };
}

/**
 * How many API posts are left in the rolling window, read live.
 *
 * `ship.js` uses this to size the day's budget up front rather than discovering
 * the cap through errors. Shape matches the Graph adapter so nothing downstream
 * changes.
 */
export async function quotaRemaining() {
  if (!isConfigured()) return { known: false, remaining: null };
  try {
    const data = await execute('INSTAGRAM_GET_IG_USER_CONTENT_PUBLISHING_LIMIT', {
      ig_user_id: composioCreds().igUserId,
    });
    // Usage comes back as a list under data.data, not a flat object.
    const entry = Array.isArray(data?.data) ? data.data[0] : data;
    const used = entry?.quota_usage ?? 0;
    const cap = entry?.config?.quota_total ?? LIMITS.dailyPostsFallback;
    return { known: true, used, cap, remaining: Math.max(0, cap - used) };
  } catch (err) {
    log.warn(`could not read publishing quota: ${err.message}`);
    return { known: false, remaining: null };
  }
}

/** Per-post metrics for the Analyst. */
export async function fetchInsights(mediaId) {
  // Composio validates `metric` as an array — a comma-separated string fails.
  const metric = [
    'reach',
    'likes',
    'comments',
    'saved',
    'shares',
    'total_interactions',
    'ig_reels_video_view_total_time',
    'ig_reels_avg_watch_time',
  ];
  const data = await execute('INSTAGRAM_GET_IG_MEDIA_INSIGHTS', { ig_media_id: mediaId, metric });
  const rows = Array.isArray(data?.data) ? data.data : (data?.data?.data ?? []);
  const out = {};
  for (const row of rows) out[row.name] = row.values?.[0]?.value ?? 0;
  return out;
}

/** Recent published media with engagement, for the review stage. */
export async function recentMedia(limit = 25) {
  const data = await execute('INSTAGRAM_GET_IG_USER_MEDIA', {
    ig_user_id: composioCreds().igUserId,
    limit,
    fields:
      'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,view_count,saved_count,shares_count,total_like_count,total_comments_count',
  });
  // Items can be double-wrapped under data.data; parsing only the outer layer
  // looks like an empty account.
  const outer = data?.data;
  if (Array.isArray(outer)) return outer;
  if (Array.isArray(outer?.data)) return outer.data;
  return [];
}

/** Account identity and whether it can publish at all. */
export async function accountInfo() {
  const data = await execute('INSTAGRAM_GET_USER_INFO', { ig_user_id: composioCreds().igUserId });
  return {
    id: data.id,
    username: data.username,
    accountType: data.account_type,
    followers: data.followers_count,
    mediaCount: data.media_count,
    canPublish: data.account_type === 'BUSINESS' || data.account_type === 'CREATOR',
  };
}

export default {
  publish,
  preflight,
  buildCaption,
  quotaRemaining,
  fetchInsights,
  accountInfo,
  verifyMediaUrl,
  isConfigured,
  isVideoPost,
  recentMedia,
  LIMITS,
};
