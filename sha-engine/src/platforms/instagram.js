import { creds, system, brand } from '../lib/config.js';
import { makeLogger } from '../lib/log.js';

const log = makeLogger('instagram');
const GRAPH = 'https://graph.facebook.com/v21.0';

/**
 * Instagram Reels publishing.
 *
 * This is the one platform in the stack that genuinely publishes end to end
 * with no human in the loop. Three steps, and the middle one is the trap:
 * the container is not ready the instant you create it, and publishing an
 * unfinished container fails with an error that does not explain itself.
 *
 * Hard limits, verified against the 2026 API:
 *   - 25 API-published posts per rolling 24h (Reels and Stories share it)
 *   - Reels max 90 seconds
 *   - Requires an Instagram Business account linked to a Facebook Page
 *   - video_url must be publicly reachable by Meta's fetchers — a localhost
 *     path or a signed URL that expires in 60s will fail at the container step
 */

export const LIMITS = {
  dailyPosts: 25,
  maxDurationSec: 90,
  minDurationSec: 3,
  aspect: '9:16',
  maxCaptionChars: 2200,
  maxHashtags: 30,
};

async function graph(path, { method = 'GET', params = {} } = {}) {
  const url = new URL(`${GRAPH}/${path}`);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (method === 'GET') url.searchParams.set(k, String(v));
    else body.set(k, String(v));
  }
  if (method === 'GET') url.searchParams.set('access_token', creds.instagram.accessToken);
  else body.set('access_token', creds.instagram.accessToken);

  const res = await fetch(url, {
    method,
    ...(method === 'POST' ? { body } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    throw new Error(`IG ${e.code || res.status}: ${e.message || res.statusText}${e.error_user_msg ? ` — ${e.error_user_msg}` : ''}`);
  }
  return json;
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
  const tags = (c.hashtags || []).slice(0, LIMITS.maxHashtags).join(' ');
  if (tags) parts.push(tags);
  return parts.join('\n\n').slice(0, LIMITS.maxCaptionChars);
}

export function preflight(post) {
  const problems = [];
  const d = post.render?.durationSec || 0;
  if (d > LIMITS.maxDurationSec) problems.push(`${d.toFixed(1)}s exceeds the ${LIMITS.maxDurationSec}s Reels limit`);
  if (d < LIMITS.minDurationSec) problems.push(`${d.toFixed(1)}s is below the ${LIMITS.minDurationSec}s minimum`);
  if (!post.mediaUrl) problems.push('no public media URL — Meta fetches the file itself, it cannot read local disk');
  if (post.render && post.render.height < post.render.width) problems.push('not vertical');
  return { ok: problems.length === 0, problems };
}

/** Poll until Meta finishes transcoding. Publishing early is the usual failure. */
async function waitForContainer(containerId, { timeoutMs = 5 * 60 * 1000, intervalMs = 5000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const res = await graph(containerId, { params: { fields: 'status_code,status' } });
    last = res.status_code;
    if (last === 'FINISHED') return res;
    if (last === 'ERROR' || last === 'EXPIRED') {
      throw new Error(`Container ${containerId} ended as ${last}: ${res.status || 'no detail given'}`);
    }
    log.debug(`container ${containerId}: ${last}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Container ${containerId} still ${last} after ${timeoutMs / 1000}s`);
}

export async function publish(post, { dryRun = false } = {}) {
  const pre = preflight(post);
  if (!pre.ok) throw new Error(`Instagram preflight failed: ${pre.problems.join('; ')}`);

  const caption = buildCaption(post);

  if (dryRun || !creds.instagram.accessToken) {
    log.warn(`dry run — would publish ${post.id} (${post.render?.durationSec?.toFixed(1)}s)`);
    return { dryRun: true, platform: 'instagram', caption, mediaUrl: post.mediaUrl };
  }

  log.info(`creating container for ${post.id}`);
  const container = await graph(`${creds.instagram.userId}/media`, {
    method: 'POST',
    params: {
      media_type: 'REELS',
      video_url: post.mediaUrl,
      caption,
      share_to_feed: true,
    },
  });

  log.info(`waiting on transcode for container ${container.id}`);
  await waitForContainer(container.id);

  log.info('publishing');
  const published = await graph(`${creds.instagram.userId}/media_publish`, {
    method: 'POST',
    params: { creation_id: container.id },
  });

  log.ok(`published ${published.id}`);
  return { platform: 'instagram', id: published.id, containerId: container.id, caption };
}

/** How many API posts are left in the rolling window, straight from Meta. */
export async function quotaRemaining() {
  if (!creds.instagram.accessToken) return { known: false, remaining: null };
  try {
    const res = await graph(`${creds.instagram.userId}/content_publishing_limit`, {
      params: { fields: 'config,quota_usage' },
    });
    const used = res.data?.[0]?.quota_usage ?? 0;
    const cap = res.data?.[0]?.config?.quota_total ?? LIMITS.dailyPosts;
    return { known: true, used, cap, remaining: Math.max(0, cap - used) };
  } catch (err) {
    log.warn(`could not read publishing quota: ${err.message}`);
    return { known: false, remaining: null };
  }
}

export async function fetchInsights(mediaId) {
  const metrics = 'plays,reach,likes,comments,saved,shares,total_interactions,ig_reels_video_view_total_time,ig_reels_avg_watch_time';
  const res = await graph(`${mediaId}/insights`, { params: { metric: metrics } });
  const out = {};
  for (const row of res.data || []) out[row.name] = row.values?.[0]?.value ?? 0;
  return out;
}

export default { publish, preflight, buildCaption, quotaRemaining, fetchInsights, LIMITS };
