import { makeLogger } from '../lib/log.js';
import * as store from '../lib/store.js';
import instagramComposio from '../platforms/instagram-composio.js';
import { bareTags, draftArtifact } from './gate.js';

const log = makeLogger('review');

/**
 * Self-review.
 *
 * Goes back to Sha's actual Instagram account, reads how the published work did,
 * grades it, and says what to change. This is the part that closes the loop: the
 * engine marks its own homework against numbers it did not choose.
 *
 * Everything here is read from the API. Where a metric is unavailable it is
 * reported as unavailable rather than estimated.
 */

/**
 * Grade bands for engagement rate on a small local account.
 *
 * Published benchmarks for accounts under ~1k followers cluster around 3-6%;
 * these bands sit on that, and are stated as the working assumption rather than
 * a measured fact about her niche.
 */
export const BANDS = [
  { grade: 'A', min: 10, meaning: 'Exceptional for a local account. Do more of exactly this.' },
  { grade: 'B', min: 6, meaning: 'Strong. Above the typical range for this account size.' },
  { grade: 'C', min: 3, meaning: 'Normal. Working, not winning.' },
  { grade: 'D', min: 1.5, meaning: 'Underperforming. The hook or the format is the likely cause.' },
  { grade: 'F', min: 0, meaning: 'Not landing. Change the format before posting more like it.' },
];

export function gradeFor(engagementRate) {
  return BANDS.find((b) => engagementRate >= b.min) ?? BANDS[BANDS.length - 1];
}

/**
 * Scores one published post.
 *
 * Weighting is deliberately lopsided and matches the engine's existing view:
 * a save is a client deciding they want this on their own head, a share is reach
 * into a new local network, a like costs nothing and predicts nothing.
 */
export function scoreMedia(media, { followers = 1 } = {}) {
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const likes = n(media.like_count ?? media.total_like_count);
  const comments = n(media.comments_count ?? media.total_comments_count);
  const saves = n(media.saved_count);
  const shares = n(media.shares_count ?? media.reposts_count);
  const views = n(media.view_count ?? media.total_views_count);

  const weighted = likes + comments * 4 + saves * 6 + shares * 8;
  const base = Math.max(followers, 1);
  const engagementRate = Number(((weighted / base) * 100).toFixed(2));

  // Follow rate is only meaningful when reach is available; it usually is not
  // on a per-post basis without the insights permission, so it stays null
  // rather than being invented from likes.
  const reach = media.reach ?? null;
  const followRate = reach ? Number((((media.follows ?? 0) / reach) * 100).toFixed(2)) : null;

  const band = gradeFor(engagementRate);

  return {
    id: media.id,
    permalink: media.permalink,
    timestamp: media.timestamp,
    mediaType: media.media_product_type ?? media.media_type,
    likes,
    comments,
    saves,
    shares,
    views,
    reach,
    weighted,
    engagementRate,
    followRate,
    grade: band.grade,
    verdict: band.meaning,
  };
}

/** Audits what actually published for the two defects seen on the live feed. */
export function auditPublished(mediaItems) {
  const findings = [];
  for (const media of mediaItems) {
    const post = { caption: { body: media.caption ?? '' } };
    const bare = bareTags(post);
    const artifact = draftArtifact(post);
    if (bare.length || artifact) {
      findings.push({
        id: media.id,
        permalink: media.permalink,
        bareHashtags: bare,
        draftArtifact: artifact,
      });
    }
  }
  return findings;
}

/** Turns per-post grades into what to actually do next week. */
export function summarise(scored, { account = null } = {}) {
  if (!scored.length) {
    return { n: 0, averageEngagement: null, grade: null, best: null, worst: null, actions: [] };
  }

  const avg = Number(
    (scored.reduce((a, s) => a + s.engagementRate, 0) / scored.length).toFixed(2),
  );
  const ranked = [...scored].sort((a, b) => b.engagementRate - a.engagementRate);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const band = gradeFor(avg);

  const actions = [];

  if (best && worst && best.id !== worst.id) {
    const gap = Number((best.engagementRate - worst.engagementRate).toFixed(2));
    if (gap > 2) {
      actions.push(
        `Best post ran at ${best.engagementRate}% against ${worst.engagementRate}% for the weakest — a ${gap} point spread. Study the top one's first two seconds and repeat that opening.`,
      );
    }
  }

  const totalSaves = scored.reduce((a, s) => a + s.saves, 0);
  const totalShares = scored.reduce((a, s) => a + s.shares, 0);
  if (totalSaves === 0) {
    actions.push('Nothing was saved. Saves come from useful posts — run an education or aftercare format next.');
  }
  if (totalShares === 0) {
    actions.push('Nothing was shared. Shares come from contrast — lead with a bigger before/after.');
  }

  const noComments = scored.filter((s) => s.comments === 0).length;
  if (noComments / scored.length > 0.6) {
    actions.push(
      'Most posts got no comments. End captions on a real question rather than a statement, and reply to every comment within the first half hour.',
    );
  }

  if (!actions.length) {
    actions.push('Nothing obviously broken. Hold the current mix and let the target step up.');
  }

  return {
    n: scored.length,
    followers: account?.followers ?? null,
    averageEngagement: avg,
    grade: band.grade,
    verdict: band.meaning,
    best: best ? { permalink: best.permalink, engagementRate: best.engagementRate } : null,
    worst: worst ? { permalink: worst.permalink, engagementRate: worst.engagementRate } : null,
    actions,
  };
}

/**
 * Review stage. Reads the live account, grades it, records the result.
 */
export async function run({ limit = 25 } = {}) {
  log.start();
  try {
    if (!instagramComposio.isConfigured()) {
      log.warn('Composio is not configured — cannot read the account, so nothing is graded.');
      log.done({ reviewed: 0 });
      return { reviewed: 0, summary: null, unavailable: 'Composio not configured' };
    }

    const account = await instagramComposio.accountInfo();
    const media = await instagramComposio.recentMedia(limit);

    // Map published Instagram ids back to the format the engine chose.
    const byMediaId = new Map(
      store
        .read('posts', [])
        .filter((p) => p.results?.instagram?.id)
        .map((p) => [String(p.results.instagram.id), p.formatId]),
    );

    const scored = media.map((m) => ({
      ...scoreMedia(m, { followers: account.followers }),
      format: byMediaId.get(String(m.id)) ?? null,
    }));

    const summary = summarise(scored, { account });
    const captionIssues = auditPublished(media);

    store.write('scores', scored);
    store.write('review', { at: new Date().toISOString(), account, summary, captionIssues });

    log.info(`@${account.username}: ${account.followers} followers, ${scored.length} posts reviewed`);
    log.info(`Average engagement ${summary.averageEngagement}% — grade ${summary.grade}`);
    if (captionIssues.length) {
      log.warn(`${captionIssues.length} published caption(s) still carry a defect`);
    }
    log.done({ reviewed: scored.length, grade: summary.grade });

    return { reviewed: scored.length, account, scored, summary, captionIssues };
  } catch (err) {
    log.fail(err);
    throw err;
  }
}

export default { run, scoreMedia, summarise, auditPublished, gradeFor, BANDS };
