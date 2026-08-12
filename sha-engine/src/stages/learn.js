import { system, brand, capabilities } from '../lib/config.js';
import { makeLogger } from '../lib/log.js';
import * as store from '../lib/store.js';
import instagram from '../platforms/instagram.js';

const log = makeLogger('learn');

/**
 * Close the loop.
 *
 * The weighting is the opinionated part. Likes are nearly worthless to a
 * salon — they cost nothing and predict nothing. A save is somebody deciding
 * they want this done to their own head, and a tap on the booking link is the
 * only number that pays rent. So the score is deliberately lopsided toward
 * intent rather than reach, which is what makes the system optimise for a
 * full chair instead of a big follower count.
 */

export function scorePost(metrics, weights = system.scoring.weights) {
  const m = {
    bookingLinkTaps: metrics.bookingLinkTaps ?? metrics.website_clicks ?? 0,
    saves: metrics.saves ?? metrics.saved ?? 0,
    profileVisits: metrics.profileVisits ?? metrics.profile_visits ?? 0,
    shares: metrics.shares ?? 0,
    comments: metrics.comments ?? 0,
    likes: metrics.likes ?? 0,
    reach: metrics.reach ?? metrics.plays ?? 0,
  };

  // Normalise engagement against reach so a small account is not punished for
  // being small — we care about rate, not raw volume.
  const denom = Math.max(1, m.reach);
  let score = 0;
  score += (m.bookingLinkTaps / denom) * 1000 * weights.bookingLinkTaps;
  score += (m.saves / denom) * 1000 * weights.saves;
  score += (m.profileVisits / denom) * 1000 * weights.profileVisits;
  score += (m.shares / denom) * 1000 * weights.shares;
  score += (m.comments / denom) * 1000 * weights.comments;
  score += (m.likes / denom) * 1000 * weights.likes;
  score += Math.log10(1 + m.reach) * weights.reach;

  // Retention: did people actually watch it, or scroll at the hook?
  if (metrics.avgWatchTimeSec && metrics.durationSec) {
    const retention = Math.min(1, metrics.avgWatchTimeSec / metrics.durationSec);
    score += retention * 100 * system.scoring.retentionWeight;
  }

  return Math.round(score * 100) / 100;
}

/** Older results should not outvote what is working now. */
export function decayWeight(publishedAt, halfLifeDays = system.scoring.decayHalfLifeDays) {
  const ageDays = (Date.now() - new Date(publishedAt).getTime()) / 86400000;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

async function collectMetrics(post) {
  const caps = capabilities();
  const igId = post.results?.instagram?.id;

  if (caps.instagramPublish && igId) {
    try {
      const raw = await instagram.fetchInsights(igId);
      return {
        source: 'instagram_api',
        reach: raw.reach ?? raw.plays ?? 0,
        likes: raw.likes ?? 0,
        comments: raw.comments ?? 0,
        saves: raw.saved ?? 0,
        shares: raw.shares ?? 0,
        avgWatchTimeSec: (raw.ig_reels_avg_watch_time ?? 0) / 1000,
        durationSec: post.render?.durationSec ?? 0,
        bookingLinkTaps: post.manualMetrics?.bookingLinkTaps ?? 0,
        profileVisits: post.manualMetrics?.profileVisits ?? 0,
      };
    } catch (err) {
      log.warn(`could not read Instagram insights for ${post.id}: ${err.message}`);
    }
  }

  // Sha can type numbers off her phone if the API is not connected yet.
  if (post.manualMetrics) return { source: 'manual', durationSec: post.render?.durationSec ?? 0, ...post.manualMetrics };
  return null;
}

export async function run({ since = null } = {}) {
  log.start();
  try {
    const posts = store.read('posts', []);
    const cutoff = since ? new Date(since).getTime() : Date.now() - 60 * 86400000;

    const published = posts.filter(
      (p) => p.status === 'published' && p.publishedAt && new Date(p.publishedAt).getTime() > cutoff
    );

    if (!published.length) {
      log.info('nothing published in the window to learn from');
      log.done({ scored: 0 });
      return { scored: 0, leaderboard: [], gaps: [] };
    }

    const scored = [];
    for (const post of published) {
      const metrics = await collectMetrics(post);
      if (!metrics) {
        log.debug(`no metrics available for ${post.id} yet`);
        continue;
      }
      const score = scorePost(metrics);
      post.metrics = metrics;
      post.score = score;
      post.scoredAt = new Date().toISOString();
      store.upsert('posts', post);
      scored.push(post);
    }

    if (!scored.length) {
      log.warn('no metrics available yet — connect Instagram insights or enter numbers manually');
      log.done({ scored: 0 });
      return { scored: 0, leaderboard: [], gaps: ['metrics'] };
    }

    // Update pattern memory, weighted so recent results dominate.
    const mean = scored.reduce((a, p) => a + p.score, 0) / scored.length;
    for (const post of scored) {
      const delta = (post.score - mean) / Math.max(1, mean) * decayWeight(post.publishedAt);
      if (post.formatId) store.rememberPattern('formats', post.formatId, delta);
      if (post.caption?.hook) store.rememberPattern('hooks', post.caption.hook, delta);
      if (post.sound) store.rememberPattern('sounds', post.sound, delta);
      const hour = new Date(post.publishedAt).getHours();
      store.rememberPattern('postingTimes', String(hour), delta);
    }

    const leaderboard = [...scored]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((p) => ({
        id: p.id, format: p.formatName, type: p.type,
        score: p.score, publishedAt: p.publishedAt,
        saves: p.metrics?.saves ?? 0, reach: p.metrics?.reach ?? 0,
      }));

    const memory = store.recallPatterns();
    const proven = Object.entries(memory.formats || {})
      .filter(([, v]) => v.n >= system.scoring.minPostsBeforeTrust)
      .sort((a, b) => b[1].avg - a[1].avg);

    log.ok(`scored ${scored.length} posts, mean ${mean.toFixed(1)}`);
    if (proven.length) {
      log.info(`proven formats: ${proven.slice(0, 3).map(([k, v]) => `${k} (${v.avg.toFixed(2)})`).join(', ')}`);
    }

    const report = {
      ranAt: new Date().toISOString(),
      scored: scored.length,
      meanScore: Math.round(mean * 100) / 100,
      leaderboard,
      provenFormats: proven.map(([id, v]) => ({ id, avg: Math.round(v.avg * 100) / 100, n: v.n })),
    };
    store.write('scores', report);

    log.done(report);
    return report;
  } catch (err) {
    log.fail(err);
    throw err;
  }
}

export default { run, scorePost, decayWeight };
