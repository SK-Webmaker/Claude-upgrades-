/**
 * The Analyst.
 *
 * Scores what already shipped so the Scout ranks the next week on real numbers
 * rather than assumptions.
 *
 * Engagement rate is measured against followers, not raw likes — on a small
 * local account a post with 40 likes on 172 followers is a genuinely strong
 * result, and raw counts would hide that.
 */

/**
 * Weighted score. Saves and shares matter more than likes: a save is intent to
 * come back, a share is reach into a new local network. A like is a reflex.
 */
export function scorePost(media, { followers = 1 } = {}) {
  const likes = num(media.like_count ?? media.total_like_count);
  const comments = num(media.comments_count ?? media.total_comments_count);
  const saves = num(media.saved_count);
  const shares = num(media.shares_count ?? media.reposts_count);
  const views = num(media.view_count ?? media.total_views_count);

  const weighted = likes + comments * 4 + saves * 6 + shares * 8;
  const base = Math.max(followers, 1);

  return {
    id: media.id,
    permalink: media.permalink,
    timestamp: media.timestamp,
    likes,
    comments,
    saves,
    shares,
    views,
    weighted,
    engagementRate: Number(((weighted / base) * 100).toFixed(2)),
    score: Number(((weighted / base) * 100).toFixed(2)),
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Audits published captions for the two defects found on the live account.
 * Runs against what actually shipped, so regressions surface even if they came
 * from somewhere other than this engine.
 */
export function auditPublishedCaptions(mediaItems) {
  const bareTag = /(?:^|\s)((?:[A-Z][a-z0-9]+){2,})(?=\s|$|[.,!?])/g;
  const findings = [];

  for (const media of mediaItems) {
    const caption = media.caption ?? '';
    const bare = [...caption.matchAll(bareTag)].map((m) => m[1]);
    const artifact = caption.match(/\balt(?:ernative)?\s+caption\b/i);

    if (bare.length || artifact) {
      findings.push({
        id: media.id,
        permalink: media.permalink,
        bareHashtags: bare,
        draftArtifact: artifact ? artifact[0] : null,
      });
    }
  }
  return findings;
}

/**
 * Analyst stage. Pulls recent media through the platform adapter, scores it, and
 * maps each published post back to the format that produced it so the Scout can
 * weight formats by outcome.
 */
export async function runAnalyst({ platform = null, store = null, followers = null }) {
  if (!platform) return { insights: [] };

  let account = null;
  try {
    account = await platform.getAccountInfo();
  } catch {
    // Fall through — scoring still works with the follower count we were given.
  }

  const base = followers ?? account?.followers ?? 1;
  const media = await platform.getRecentMedia(25);

  // Map published Instagram media ids back to the format the engine used.
  const byMediaId = new Map(
    (store?.state.posts ?? [])
      .filter((p) => p.publish?.mediaId)
      .map((p) => [String(p.publish.mediaId), p.format]),
  );

  const insights = media.map((item) => ({
    ...scorePost(item, { followers: base }),
    format: byMediaId.get(String(item.id)) ?? null,
  }));

  const captionIssues = auditPublishedCaptions(media);
  if (store) store.saveInsights(insights);

  return { insights, captionIssues, account };
}
