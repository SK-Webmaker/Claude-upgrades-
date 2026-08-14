/**
 * Did she actually post it, and how did it do?
 *
 * Every week the system hands over three finished posts. Without this, the next
 * week has no idea which of them went up — and a system that cannot tell the
 * difference between "that format flopped" and "she never posted it" will keep
 * making the same wrong correction.
 *
 * The match is on the hook, not on an id. Instagram gives no way to tag a post
 * as ours, but the hook is a distinctive sentence we wrote and she pastes
 * verbatim, so a normalised substring match on the caption is reliable in
 * practice. Emoji, punctuation and case are stripped first because Instagram's
 * composer and her phone keyboard both alter them.
 */

/**
 * Lowercase, strip everything that is not a letter, digit or space, collapse
 * runs of whitespace. Emoji and curly quotes go; word order and spelling stay.
 */
export function normalise(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The longest distinctive slice of a caption to match on.
 *
 * The whole hook is best, but she sometimes trims a trailing clause when she
 * pastes. Falling back to the first eight words keeps the match working without
 * getting so short that it collides with an unrelated post.
 */
function needles(caption) {
  const hook = normalise(caption?.hook);
  const out = [];
  if (hook.length >= 12) out.push(hook);
  // Prefix, not the whole hook: she edits the tail of a line far more often
  // than the head. Six words is long enough to be unique on one account and
  // short enough to survive a trimmed clause.
  const words = hook.split(' ');
  if (words.length > 6) {
    const prefix = words.slice(0, 6).join(' ');
    if (prefix.length >= 20) out.push(prefix);
  }
  const body = normalise(caption?.body).split(' ').slice(0, 10).join(' ');
  if (body.length >= 24) out.push(body);
  return out;
}

/**
 * Match one authored post against the live media list.
 *
 * `media` items are whatever `review` scored — they carry caption, permalink,
 * timestamp and the engagement figures.
 */
export function matchPost(post, media = []) {
  const keys = needles(post.caption);
  for (const m of media) {
    const hay = normalise(m.caption);
    if (!hay) continue;
    if (keys.some((k) => hay.includes(k))) return m;
  }
  return null;
}

/**
 * Reconcile a whole pack against the account.
 *
 * Returns one row per authored post, plus the counts that matter: how many were
 * published, and how the published ones did against the account's own average
 * rather than against some external benchmark.
 */
export function reconcile(pack, { media = [], accountAverage = null } = {}) {
  const rows = (pack?.posts ?? []).map((post) => {
    const found = matchPost(post, media);
    if (!found) {
      return {
        id: post.id,
        title: post.title,
        type: post.type,
        published: false,
        // Never report this as a failed post. It is an unrun experiment, and
        // treating the two the same is how a good format gets abandoned.
        note: 'not found on the account — either not posted, or the caption was rewritten enough to miss the match',
      };
    }

    const rate = found.engagementRate ?? null;
    const lift =
      rate != null && accountAverage ? Number((rate - accountAverage).toFixed(2)) : null;

    return {
      id: post.id,
      title: post.title,
      type: post.type,
      published: true,
      permalink: found.permalink,
      postedAt: found.timestamp ?? null,
      mediaType: found.mediaType ?? null,
      likes: found.likes ?? 0,
      comments: found.comments ?? 0,
      engagementRate: rate,
      grade: found.grade ?? null,
      liftVsAverage: lift,
      // Instagram has consistently returned nothing for these on this account.
      // Carry the flag so nobody downstream reads a zero as a real zero.
      savesMeasured: found.savesMeasured ?? false,
      sharesMeasured: found.sharesMeasured ?? false,
      viewsMeasured: Boolean(found.views),
    };
  });

  const published = rows.filter((r) => r.published);
  const rated = published.filter((r) => r.engagementRate != null);

  return {
    weekOf: pack?.weekOf ?? null,
    authored: rows.length,
    publishedCount: published.length,
    rows,
    averageEngagement: rated.length
      ? Number((rated.reduce((n, r) => n + r.engagementRate, 0) / rated.length).toFixed(2))
      : null,
    best: rated.length ? rated.reduce((a, b) => (b.engagementRate > a.engagementRate ? b : a)) : null,
    worst: rated.length ? rated.reduce((a, b) => (b.engagementRate < a.engagementRate ? b : a)) : null,
  };
}

/**
 * One line per post, for reading in a terminal.
 */
export function summarise(result) {
  const lines = [];
  for (const r of result.rows) {
    if (!r.published) {
      lines.push(`  not posted   ${r.title}`);
      continue;
    }
    const lift =
      r.liftVsAverage == null
        ? ''
        : ` (${r.liftVsAverage >= 0 ? '+' : ''}${r.liftVsAverage} vs account average)`;
    lines.push(
      `  ${String(r.engagementRate ?? '—').padStart(6)}%  ${r.grade ?? '?'}  ${r.title}${lift}`,
    );
    lines.push(`               ${r.likes} likes, ${r.comments} comments — ${r.permalink}`);
  }
  lines.push('');
  lines.push(`  ${result.publishedCount} of ${result.authored} authored posts went up.`);
  return lines.join('\n');
}

export default { normalise, matchPost, reconcile, summarise };
