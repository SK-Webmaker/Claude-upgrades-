import { system, creds, capabilities } from '../lib/config.js';
import { makeLogger } from '../lib/log.js';
import * as store from '../lib/store.js';
import instagramGraph from '../platforms/instagram.js';
import instagramComposio from '../platforms/instagram-composio.js';
import tiktok from '../platforms/tiktok.js';

const log = makeLogger('ship');

/**
 * Instagram now publishes through Composio's OAuth connection when one is
 * configured. The old raw Graph API token path stays as the fallback so a
 * missing Composio key degrades rather than breaking the week.
 *
 * Both adapters expose the same surface — publish, preflight, quotaRemaining,
 * fetchInsights — so nothing downstream cares which one is live.
 */
export function instagramAdapter() {
  return instagramComposio.isConfigured() ? instagramComposio : instagramGraph;
}

const instagram = instagramAdapter();

const ADAPTERS = { instagram, tiktok };

/**
 * Publish approved posts to whichever platforms are due.
 *
 * Two things this deliberately does not do: it does not publish anything Sha
 * has not approved, and it does not silently swallow a failure. A post that
 * fails to ship is marked failed with the error attached and retried on the
 * next run, up to a limit — after that it needs a human, and says so.
 */

const MAX_ATTEMPTS = 3;

/** Media must be publicly fetchable — both platforms pull the file themselves. */
export function resolveMediaUrl(post) {
  if (post.mediaUrl) return post.mediaUrl;
  const base = creds.publicMediaBaseUrl;
  if (!base || !post.render?.outFile) return null;
  const name = post.render.outFile.split('/').pop();
  return `${base.replace(/\/$/, '')}/${name}`;
}

export function isDue(post, now = Date.now()) {
  if (!post.scheduledFor) return true;
  return new Date(post.scheduledFor).getTime() <= now;
}

export async function run({ dryRun = false, force = false } = {}) {
  log.start({ dryRun });
  try {
    const caps = capabilities();
    const posts = store.read('posts', []);

    const queue = posts.filter(
      (p) => p.status === 'approved' && (force || isDue(p)) && (p.attempts || 0) < MAX_ATTEMPTS
    );

    if (!queue.length) {
      log.info('nothing approved and due');
      log.done({ shipped: 0 });
      return { shipped: [], failed: [], skipped: 0 };
    }

    // Respect Instagram's rolling API cap rather than discovering it via errors.
    let igBudget = system.publishing.instagram.dailyApiCap;
    if (!dryRun && caps.instagramPublish) {
      const quota = await instagram.quotaRemaining();
      if (quota.known) {
        igBudget = quota.remaining;
        log.info(`Instagram quota: ${quota.used}/${quota.cap} used, ${quota.remaining} left`);
      }
    }

    const shipped = [];
    const failed = [];

    for (const post of queue) {
      post.mediaUrl = resolveMediaUrl(post);
      post.attempts = (post.attempts || 0) + 1;
      post.results = post.results || {};

      for (const platform of post.platforms || []) {
        const adapter = ADAPTERS[platform];
        if (!adapter) continue;
        if (post.results[platform]?.ok) continue; // already out on this platform
        if (!system.publishing[platform]?.enabled) {
          log.debug(`${platform} disabled in config, skipping`);
          continue;
        }

        if (platform === 'instagram' && igBudget <= 0) {
          log.warn('Instagram daily API budget exhausted — holding for tomorrow');
          continue;
        }

        try {
          const res = await adapter.publish(post, { dryRun });
          post.results[platform] = { ok: true, ...res, at: new Date().toISOString() };
          if (platform === 'instagram' && !dryRun) igBudget -= 1;
          log.ok(`${platform}: ${post.id} ${res.requiresTap ? '→ drafts, awaiting tap' : 'live'}`);
        } catch (err) {
          post.results[platform] = { ok: false, error: err.message, at: new Date().toISOString() };
          log.error(`${platform}: ${post.id} failed — ${err.message}`);
        }
      }

      const outcomes = Object.values(post.results);
      const anyOk = outcomes.some((r) => r.ok);
      const allOk = outcomes.length > 0 && outcomes.every((r) => r.ok);

      if (allOk) {
        post.status = 'published';
        post.publishedAt = new Date().toISOString();
        shipped.push(post);
        // Mark the footage consumed so the planner never reuses it.
        const clips = store.read('footage', []);
        for (const id of post.clipIds || []) {
          const c = clips.find((x) => x.id === id);
          if (c) c.usedInPosts = [...new Set([...(c.usedInPosts || []), post.id])];
        }
        store.write('footage', clips);
      } else if (post.attempts >= MAX_ATTEMPTS) {
        post.status = 'failed';
        failed.push(post);
        log.error(`${post.id} gave up after ${MAX_ATTEMPTS} attempts — needs a human`);
      } else if (anyOk) {
        post.status = 'partially_published';
      }

      store.upsert('posts', post);
    }

    log.done({ shipped: shipped.length, failed: failed.length, dryRun });
    return { shipped, failed, skipped: queue.length - shipped.length - failed.length };
  } catch (err) {
    log.fail(err);
    throw err;
  }
}

export default { run, resolveMediaUrl, isDue };
