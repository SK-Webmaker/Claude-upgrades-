import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  attainment,
  verdictFor,
  nextTarget,
  buildTargets,
  scoreWeek,
  formatBiasFrom,
  planWeek,
  GROWTH,
} from '../src/stages/goals.js';
import {
  BUSINESS,
  VOICE,
  allServices,
  heroServices,
  durationLabel,
  priceLabel,
  seasonFor,
  voiceViolations,
} from '../src/lib/brand.js';
import { scoreMedia, summarise, auditPublished, gradeFor, BANDS } from '../src/stages/review.js';
import { RULES, evaluate, bareTags, draftArtifact } from '../src/stages/gate.js';
import instagramComposio from '../src/platforms/instagram-composio.js';
import { instagramAdapter } from '../src/stages/ship.js';

// ---------------------------------------------------------------------------
describe('Strategist — weekly targets', () => {
  test('attainment and verdicts', () => {
    assert.equal(attainment(10, 10), 1);
    assert.equal(attainment(5, 0), null);
    assert.equal(verdictFor(1.2), 'hit');
    assert.equal(verdictFor(0.9), 'close');
    assert.equal(verdictFor(0.4), 'missed');
  });

  test('a week that hits grows the next target faster than one that misses', () => {
    assert.ok(nextTarget(100, 1.2) > nextTarget(100, 0.3));
    assert.ok(nextTarget(100, 0.3) > 100, 'a miss still grows, never goes backwards');
  });

  test('eight missed weeks never compound into an unreachable target', () => {
    let current = 172;
    for (let i = 0; i < 8; i += 1) {
      current = nextTarget(current, 0.2, { floor: GROWTH.minFollowerGain });
    }
    assert.ok(current < 172 * 1.6, `compounded to ${current}`);
  });

  test('no measured baseline withholds targets instead of inventing one', () => {
    const t = buildTargets({ baseline: { followers: 0 }, cadence: 3 });
    assert.equal(t.baselineKnown, false);
    assert.equal(t.followers, undefined);
    assert.ok(t.unavailable);
    assert.equal(t.posts, 3, 'cadence is a decision, not a measurement');
  });

  test('a real baseline produces targets above the current count', () => {
    const t = buildTargets({ baseline: { followers: 172 }, cadence: 3 });
    assert.equal(t.baselineKnown, true);
    assert.ok(t.followers > 172);
    assert.equal(t.projection, true, 'targets must never read as measurements');
  });

  test('planWeek is pure and needs no store', () => {
    const out = planWeek({ account: { followers: 172 }, insights: [], cadence: 3 });
    assert.ok(out.week.targets.followers > 172);
    assert.equal(out.week.baseline.followers, 172);
  });
});

describe('Strategist — scoring drives next week', () => {
  const targets = { followers: 180, reach: 600, engagementRate: 5, saves: 10, shares: 5, posts: 3 };

  test('a missed cadence blames cadence first', () => {
    const card = scoreWeek({
      targets,
      actual: { followers: 174, reach: 300, engagementRate: 4, saves: 3, shares: 1, posts: 1 },
    });
    assert.equal(card.adjustments[0].lever, 'cadence');
  });

  test('missed saves biases toward saveable formats', () => {
    const card = scoreWeek({
      targets,
      actual: { followers: 185, reach: 700, engagementRate: 6, saves: 2, shares: 6, posts: 3 },
    });
    assert.ok(formatBiasFrom(card).education_myth > 0);
  });

  test('good engagement with missed followers is called a reach problem', () => {
    const card = scoreWeek({
      targets,
      actual: { followers: 140, reach: 700, engagementRate: 9, saves: 15, shares: 8, posts: 3 },
    });
    assert.equal(card.scores.followers.verdict, 'missed');
    assert.ok(card.adjustments.some((a) => a.lever === 'reach'));
  });

  test('a near-miss is not treated as a failure', () => {
    const card = scoreWeek({
      targets,
      actual: { followers: 176, reach: 700, engagementRate: 9, saves: 15, shares: 8, posts: 3 },
    });
    assert.equal(card.scores.followers.verdict, 'close');
    assert.equal(card.adjustments.some((a) => a.lever === 'reach'), false);
  });

  test('a clean week holds rather than inventing a change', () => {
    const card = scoreWeek({
      targets,
      actual: { followers: 190, reach: 800, engagementRate: 7, saves: 15, shares: 8, posts: 3 },
    });
    assert.equal(card.adjustments[0].lever, 'hold');
  });
});

// ---------------------------------------------------------------------------
describe('brand adapter reads config/brand.json', () => {
  test('business facts come from the config, not from hardcoded copies', () => {
    assert.equal(BUSINESS.handle, 'hairbysha_c');
    assert.equal(BUSINESS.operator, 'Shamalka');
    assert.match(BUSINESS.bookingUrl, /^https:\/\//);
    assert.equal(BUSINESS.timezone, 'Australia/Melbourne');
  });

  test('every service carries a real price and duration', () => {
    for (const s of allServices()) {
      assert.ok(s.price > 0, `${s.name} needs a price`);
      assert.ok(s.minutes > 0, `${s.name} needs a duration`);
    }
  });

  test('hero services are the colour packages the price anchor points at', () => {
    const heroes = heroServices();
    assert.ok(heroes.length);
    for (const h of heroes) assert.ok(h.price >= 240, `${h.name} is below the money band`);
  });

  test('price and duration format the way her captions read', () => {
    const full = allServices().find((s) => s.name === 'Full Blonde');
    assert.equal(priceLabel(full), 'from $320');
    assert.equal(durationLabel(full), '3.5 hours');
  });

  test('seasons are southern hemisphere', () => {
    assert.equal(seasonFor(new Date('2026-01-15')).name, 'Summer');
    assert.equal(seasonFor(new Date('2026-07-15')).name, 'Winter');
  });

  test('voice rules come from the config avoid list', () => {
    assert.ok(VOICE.avoid.includes('slay'));
    assert.equal(VOICE.emojiMax, 2);
    assert.ok(voiceViolations('this is going to slay').length);
    assert.ok(voiceViolations('so good!!!').length);
    assert.ok(voiceViolations('✨🤍💕😍🔥').length, 'more emoji than the cap');
    assert.equal(voiceViolations('Dimension that does not shout. 🤍').length, 0);
  });

  test('K18 and DM are not mistaken for shouting', () => {
    assert.equal(voiceViolations('K18 treatment in-chair. DM to book.').length, 0);
  });
});

// ---------------------------------------------------------------------------
describe('Critic — the two defects found on the live account', () => {
  const base = {
    id: 'p1',
    formatId: 'f',
    clipIds: [],
    render: { width: 1080, height: 1920, durationSec: 24 },
    captions: [{ text: 'hi', start: 0.5 }],
    caption: { hook: 'Hook', body: 'Body', hashtags: ['#a', '#b', '#c', '#d'] },
  };
  const ctx = { posts: [], clips: [], bookingUrlSet: true, consentPolicySet: true };

  test('bare hashtags block the post', () => {
    const post = {
      ...base,
      caption: { ...base.caption, body: 'Blonde refresh. GlenIris KewHair BalwynHair' },
    };
    assert.deepEqual(bareTags(post), ['GlenIris', 'KewHair', 'BalwynHair']);
    const res = evaluate(post, ctx);
    const rule = res.results.find((r) => r.id === 'bare-hashtag');
    assert.equal(rule.passed, false);
    assert.equal(rule.severity, 'blocker');
  });

  test('normal prose with place names is not flagged', () => {
    const post = { ...base, caption: { ...base.caption, body: 'A quiet afternoon in Camberwell.' } };
    assert.deepEqual(bareTags(post), []);
  });

  test('the exact leftover that shipped live is blocked', () => {
    const post = {
      ...base,
      caption: { ...base.caption, body: 'Dimension, restored.\n\nAlt caption (shorter, quieter tone)' },
    };
    assert.match(draftArtifact(post), /Alt caption/i);
    assert.equal(evaluate(post, ctx).results.find((r) => r.id === 'draft-artifact').passed, false);
  });

  test('other drafting leftovers are blocked too', () => {
    for (const leak of ['Option A: brighter', '[insert client name]', 'TODO write hook', '{n} years']) {
      const post = { ...base, caption: { ...base.caption, body: leak } };
      assert.ok(draftArtifact(post), `expected a hit for: ${leak}`);
    }
  });

  test('hashtag count is checked against the brand config band', () => {
    const many = { ...base, caption: { ...base.caption, hashtags: Array(14).fill('#x') } };
    const rule = evaluate(many, ctx).results.find((r) => r.id === 'hashtag-count');
    assert.equal(rule.passed, false);
    assert.equal(rule.severity, 'warning', 'count is a warning, not a blocker');
  });

  test('both new rules are registered as blockers', () => {
    for (const id of ['bare-hashtag', 'draft-artifact']) {
      assert.equal(RULES.find((r) => r.id === id).severity, 'blocker');
    }
  });
});

// ---------------------------------------------------------------------------
describe('self-review against the live account', () => {
  test('saves and shares outweigh likes', () => {
    const likes = scoreMedia({ id: '1', like_count: 10 }, { followers: 100 });
    const saves = scoreMedia({ id: '2', saved_count: 10 }, { followers: 100 });
    assert.ok(saves.engagementRate > likes.engagementRate);
  });

  test('scored relative to followers, not raw counts', () => {
    const small = scoreMedia({ id: '1', like_count: 40 }, { followers: 172 });
    const big = scoreMedia({ id: '2', like_count: 40 }, { followers: 100000 });
    assert.ok(small.engagementRate > big.engagementRate);
  });

  test('grades map onto the published bands', () => {
    assert.equal(gradeFor(12).grade, 'A');
    assert.equal(gradeFor(4).grade, 'C');
    assert.equal(gradeFor(0.2).grade, 'F');
    assert.equal(BANDS[BANDS.length - 1].min, 0, 'the bottom band must catch everything');
  });

  test('follow rate stays null when reach is unavailable rather than guessed', () => {
    assert.equal(scoreMedia({ id: '1', like_count: 5 }, { followers: 100 }).followRate, null);
  });

  test('missing metrics do not produce NaN', () => {
    const s = scoreMedia({ id: '1' }, { followers: 10 });
    assert.equal(s.weighted, 0);
    assert.ok(Number.isFinite(s.engagementRate));
  });

  test('summary names the spread and what to do about it', () => {
    const scored = [
      scoreMedia({ id: '1', like_count: 41, comments_count: 6 }, { followers: 172 }),
      scoreMedia({ id: '2', like_count: 5 }, { followers: 172 }),
    ];
    const out = summarise(scored, { account: { followers: 172 } });
    assert.equal(out.n, 2);
    assert.ok(out.grade);
    assert.ok(out.actions.length);
    assert.ok(out.actions.some((a) => /saved/i.test(a)), 'zero saves should be called out');
  });

  test('an empty account summarises without throwing', () => {
    const out = summarise([], {});
    assert.equal(out.n, 0);
    assert.equal(out.averageEngagement, null);
  });

  test('audits published captions for both live defects', () => {
    const findings = auditPublished([
      { id: '1', caption: '#CamberwellHair GlenIris KewHair' },
      { id: '2', caption: 'Alt caption (shorter, quieter tone)' },
      { id: '3', caption: 'Clean. #HairBySha #CamberwellHair' },
    ]);
    assert.equal(findings.length, 2);
  });
});

// ---------------------------------------------------------------------------
describe('Composio adapter', () => {
  test('is not configured without a key, so ship falls back to Graph', async () => {
    assert.equal(instagramComposio.isConfigured(), false);
    assert.equal(instagramAdapter(), (await import('../src/platforms/instagram.js')).default);
  });

  test('photo posts pass preflight — the bug the Graph adapter had', () => {
    const photo = { id: 'p', mediaUrl: 'https://x.com/a.jpg', caption: { body: 'b' } };
    assert.equal(instagramComposio.preflight(photo).ok, true);
    assert.equal(instagramComposio.isVideoPost(photo), false);
  });

  test('video posts still get duration and orientation checks', () => {
    const tooLong = {
      id: 'v',
      mediaUrl: 'https://x.com/a.mp4',
      render: { durationSec: 200, width: 1080, height: 1920 },
      caption: { body: 'b' },
    };
    const res = instagramComposio.preflight(tooLong);
    assert.equal(res.ok, false);
    assert.ok(res.problems.some((p) => /90s/.test(p)));
  });

  test('a post with no public URL is refused', () => {
    const res = instagramComposio.preflight({ id: 'p', caption: { body: 'b' } });
    assert.ok(res.problems.some((p) => /public media URL/.test(p)));
  });

  test('buildCaption prefixes every hashtag', () => {
    const out = instagramComposio.buildCaption({
      caption: { hook: 'H', body: 'B', hashtags: ['One', '#Two'] },
    });
    assert.match(out, /#One #Two/);
  });

  test('the daily cap is a labelled fallback, not an asserted fact', () => {
    assert.ok(instagramComposio.LIMITS.dailyPostsFallback);
    assert.equal(instagramComposio.LIMITS.dailyPosts, undefined);
  });
});
