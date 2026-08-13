import { system } from '../lib/config.js';
import { makeLogger } from '../lib/log.js';
import * as store from '../lib/store.js';

const log = makeLogger('goals');

/**
 * The Strategist.
 *
 * Owns the weekly number. Sets a target before the week starts, scores what
 * actually happened when it ends, and moves the next target based on the result
 * — so growth compounds instead of drifting.
 *
 * Design rule: targets are projections and are labelled as such. Measured values
 * come from Instagram; nothing here asserts a number it did not read.
 */

/**
 * Weekly growth model.
 *
 * A local service account with a few hundred followers grows very differently
 * from a large one — percentage targets on a small base are volatile, so the
 * model floors every target in absolute terms too.
 */
export const GROWTH = {
  baseFollowerRate: 0.04, // 4% per week when targets are being met
  minFollowerGain: 4, // never ask for less than this
  accelerate: 1.15, // multiplier after a week that hit
  consolidate: 0.5, // multiplier after a week that clearly missed
  hitThreshold: 1.0,
  partialThreshold: 0.8,
};

/** Metrics the Strategist steers on, and what each one is actually for. */
export const TRACKED = [
  { key: 'followers', label: 'Followers', why: 'The compounding asset. Everything else feeds it.' },
  { key: 'reach', label: 'Accounts reached', why: 'How many people saw anything at all.' },
  { key: 'engagementRate', label: 'Engagement rate', why: 'Whether the content earns a reaction.' },
  { key: 'saves', label: 'Saves', why: 'Intent to come back. Best leading signal for bookings.' },
  { key: 'shares', label: 'Shares', why: 'Reach into new local networks — the growth lever.' },
  { key: 'posts', label: 'Posts published', why: 'The input. Nothing else moves if this does not.' },
];

/**
 * Scores one metric: how close the actual came to the target.
 * Returns attainment as a ratio, so 1.0 is exactly on target.
 */
export function attainment(actual, target) {
  if (!target || target <= 0) return null;
  return Number((actual / target).toFixed(3));
}

export function verdictFor(ratio) {
  if (ratio === null) return 'untracked';
  if (ratio >= GROWTH.hitThreshold) return 'hit';
  if (ratio >= GROWTH.partialThreshold) return 'close';
  return 'missed';
}

/**
 * Moves a target for next week.
 *
 * Hit it → grow faster. Nearly hit → keep the same pace. Clearly missed → grow
 * slower rather than compounding a miss into a target she can never reach, which
 * is how goal systems stop being believed.
 */
export function nextTarget(current, ratio, { rate = GROWTH.baseFollowerRate, floor = 0 } = {}) {
  let applied = rate;
  if (ratio !== null) {
    if (ratio >= GROWTH.hitThreshold) applied = rate * GROWTH.accelerate;
    else if (ratio < GROWTH.partialThreshold) applied = rate * GROWTH.consolidate;
  }
  const grown = current * (1 + applied);
  return Math.max(Math.ceil(grown), current + floor);
}

/**
 * Builds this week's targets from last week's outcome.
 * With no history, sets an opening baseline off current account state.
 */
export function buildTargets({ baseline, lastWeek = null, cadence = 3 }) {
  const followers = baseline.followers ?? 0;
  const followerRatio = lastWeek
    ? attainment(lastWeek.actual?.followers, lastWeek.targets?.followers)
    : null;

  // With no measured baseline there is no honest target to set. Emitting one
  // anyway produces nonsense — a follower goal of "4" for an account that
  // already has 172 — so those targets are withheld and the reason is stated.
  // `posts` survives because cadence is a decision, not a measurement.
  const measured = followers > 0;

  return {
    projection: true, // never let a target be mistaken for a measurement
    baselineKnown: measured,
    ...(measured
      ? {
          followers: nextTarget(followers, followerRatio, {
            rate: GROWTH.baseFollowerRate,
            floor: GROWTH.minFollowerGain,
          }),
          reach: nextTarget(baseline.reach ?? followers * 3, followerRatio, {
            rate: 0.08,
            floor: 50,
          }),
          engagementRate: Number(
            Math.max(baseline.engagementRate ?? 4, (baseline.engagementRate ?? 4) * 1.05).toFixed(2),
          ),
          saves: nextTarget(baseline.saves ?? 5, followerRatio, { rate: 0.15, floor: 3 }),
          shares: nextTarget(baseline.shares ?? 2, followerRatio, { rate: 0.15, floor: 2 }),
        }
      : {
          unavailable:
            'No account metrics were read this cycle, so no growth targets were set. Connect Composio and re-run to get them.',
        }),
    posts: cadence,
  };
}

/**
 * Scores a finished week and says, in plain words, what changes next week.
 * The adjustments are the whole point — a scorecard nobody acts on is a report.
 */
export function scoreWeek({ targets, actual, formatResults = [] }) {
  const scores = {};
  for (const { key } of TRACKED) {
    const ratio = attainment(actual[key] ?? 0, targets[key]);
    scores[key] = { target: targets[key], actual: actual[key] ?? 0, ratio, verdict: verdictFor(ratio) };
  }

  const tracked = Object.values(scores).filter((s) => s.ratio !== null);
  const overall = tracked.length
    ? Number((tracked.reduce((a, s) => a + s.ratio, 0) / tracked.length).toFixed(3))
    : null;

  const adjustments = [];

  if (scores.posts?.verdict === 'missed') {
    adjustments.push({
      lever: 'cadence',
      say: `Only ${scores.posts.actual} of ${scores.posts.target} posts went out. Everything else is downstream of this — the filming slots are the fix, not the content.`,
    });
  }

  if (scores.saves?.verdict === 'missed' && scores.posts?.verdict !== 'missed') {
    adjustments.push({
      lever: 'format',
      say: 'Saves came in under target. Shift the mix toward educational and maintenance posts — those are what people save.',
      formatBias: { education_myth: 12, maintenance_tips: 12, price_transparency: 8 },
    });
  }

  if (scores.shares?.verdict === 'missed' && scores.posts?.verdict !== 'missed') {
    adjustments.push({
      lever: 'format',
      say: 'Shares came in under target. Lead with bigger visual contrast — transformations and reaction moments get sent to a friend.',
      formatBias: { transformation_reveal: 10, client_reaction: 10, contrast_hook: 8 },
    });
  }

  if (scores.engagementRate?.verdict === 'hit' && scores.followers?.verdict === 'missed') {
    adjustments.push({
      lever: 'reach',
      say: 'The content is landing with people who already follow, but it is not reaching new ones. Push local hashtags and location tagging harder.',
    });
  }

  // Format-level winners and losers from the Analyst.
  const ranked = [...formatResults].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  if (ranked.length >= 2) {
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if (best.format && best.format !== worst.format) {
      adjustments.push({
        lever: 'format',
        say: `"${best.format}" outperformed "${worst.format}" this week. Running more of the first, less of the second.`,
        formatBias: { [best.format]: 10, [worst.format]: -10 },
      });
    }
  }

  if (!adjustments.length) {
    adjustments.push({
      lever: 'hold',
      say: 'Targets met across the board. Holding the plan and letting the next target step up.',
    });
  }

  return {
    overall,
    verdict: overall === null ? 'untracked' : verdictFor(overall),
    scores,
    adjustments,
  };
}

/** Merges every adjustment's format bias into one map the Scout can apply. */
export function formatBiasFrom(scorecard) {
  const bias = {};
  for (const adj of scorecard?.adjustments ?? []) {
    for (const [format, delta] of Object.entries(adj.formatBias ?? {})) {
      bias[format] = (bias[format] ?? 0) + delta;
    }
  }
  return bias;
}

/**
 * Strategist stage.
 *
 * Runs before the Scout so this week's targets and last week's lessons are
 * available to rank formats against.
 */
export async function run({
  insights = null,
  account = null,
  cadence = null,
  now = new Date(),
} = {}) {
  log.start();
  try {
    const scores = insights ?? store.read('scores', []);
    const history = store.read('weeks', []);
    const lastWeek = history[0] ?? null;
    const perWeek = cadence ?? system.cadence.postsPerWeek;

    // Baseline from measured values only.
    const totals = scores.reduce(
      (acc, i) => ({
        saves: acc.saves + (i.saves ?? 0),
        shares: acc.shares + (i.shares ?? 0),
        engagement: acc.engagement + (i.engagementRate ?? 0),
      }),
      { saves: 0, shares: 0, engagement: 0 },
    );

    // `.start` runs review immediately before this, so the follower count is
    // already on disk. Without this fall-back the target came out "unavailable"
    // on a cycle where the account had just been read successfully.
    const storedReview = store.read('review', null);
    const knownFollowers =
      account?.followers ?? storedReview?.account?.followers ?? lastWeek?.actual?.followers ?? 0;

    const baseline = {
      followers: knownFollowers,
      saves: totals.saves,
      shares: totals.shares,
      engagementRate: scores.length ? Number((totals.engagement / scores.length).toFixed(2)) : null,
      reach: account?.reach ?? null,
      measuredAt: now.toISOString(),
    };

    // Close out last week before opening this one.
    //
    // Only a week that has actually ended can be scored. Without this guard a
    // second run on the same day scores the current week as finished and reports
    // "0 of 5 posts went out" for a week that has barely started.
    const weekOfToday = now.toISOString().slice(0, 10);
    const lastWeekEnded = lastWeek && lastWeek.weekOf < weekOfToday;

    let scorecard = lastWeek?.scorecard ?? null;
    if (lastWeekEnded && !lastWeek.scorecard) {
      const published = store
        .read('posts', [])
        .filter((p) => p.publishedAt && new Date(p.publishedAt) >= new Date(lastWeek.weekOf));
      scorecard = scoreWeek({
        targets: lastWeek.targets,
        actual: { ...baseline, posts: published.length },
        formatResults: scores,
      });
      lastWeek.scorecard = scorecard;
      lastWeek.actual = { ...baseline, posts: published.length };
    }

    const targets = buildTargets({
      baseline,
      lastWeek: lastWeekEnded ? lastWeek : null,
      cadence: perWeek,
    });
    const weekOf = weekOfToday;

    let week = history.find((w) => w.weekOf === weekOf);
    if (!week) {
      week = { weekOf, baseline, targets, actual: { posts: 0 }, scorecard: null };
      history.unshift(week);
    } else {
      week.targets = targets;
      week.baseline = baseline;
    }

    store.write('weeks', history.slice(0, 52));

    log.done({
      weekOf,
      targetFollowers: targets.followers ?? 'n/a',
      lastVerdict: scorecard?.verdict ?? 'none',
    });

    return { goals: { week, lastScorecard: scorecard, formatBias: formatBiasFrom(scorecard) } };
  } catch (err) {
    log.fail(err);
    throw err;
  }
}

/** Kept for direct use and tests: pure planning with an injected state bag. */
export function planWeek({
  insights = [],
  account = null,
  history = [],
  cadence = 3,
  now = new Date(),
}) {
  const lastWeek = history[0] ?? null;

  const totals = insights.reduce(
    (acc, i) => ({
      saves: acc.saves + (i.saves ?? 0),
      shares: acc.shares + (i.shares ?? 0),
      engagement: acc.engagement + (i.engagementRate ?? 0),
    }),
    { saves: 0, shares: 0, engagement: 0 },
  );

  const baseline = {
    followers: account?.followers ?? lastWeek?.actual?.followers ?? 0,
    saves: totals.saves,
    shares: totals.shares,
    engagementRate: insights.length
      ? Number((totals.engagement / insights.length).toFixed(2))
      : null,
    reach: account?.reach ?? null,
    measuredAt: now.toISOString(),
  };

  const targets = buildTargets({ baseline, lastWeek, cadence });
  const scorecard = lastWeek?.scorecard ?? null;

  return {
    week: { weekOf: now.toISOString().slice(0, 10), baseline, targets, actual: { posts: 0 }, scorecard: null },
    lastScorecard: scorecard,
    formatBias: formatBiasFrom(scorecard),
  };
}

export default { run, planWeek, buildTargets, scoreWeek, formatBiasFrom, attainment, nextTarget, GROWTH, TRACKED };
