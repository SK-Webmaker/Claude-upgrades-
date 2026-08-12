import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Store } from '../src/lib/store.js';
import {
  attainment,
  verdictFor,
  nextTarget,
  buildTargets,
  scoreWeek,
  formatBiasFrom,
  runStrategist,
  GROWTH,
} from '../src/stages/goals.js';
import {
  BUSINESS,
  SERVICES,
  VOICE,
  allServices,
  serviceById,
  durationLabel,
  seasonFor,
  voiceViolations,
} from '../src/lib/brand.js';
import { buildPlaybook, buildShotPlan, audioGuidance } from '../src/lib/playbook.js';
import { STUDY_ACCOUNTS, LIVE_BROWSE, browseFor, accountsFor } from '../src/lib/references.js';
import { FORMAT_LIBRARY, scoreFormats } from '../src/stages/scout.js';
import { draftCaption } from '../src/stages/brief.js';
import { critique } from '../src/stages/gate.js';

const freshStore = () => new Store(mkdtempSync(join(tmpdir(), 'sha-goals-')));

// ---------------------------------------------------------------------------
describe('Strategist — weekly targets', () => {
  test('attainment and verdicts', () => {
    assert.equal(attainment(10, 10), 1);
    assert.equal(attainment(9, 10), 0.9);
    assert.equal(attainment(5, 0), null);
    assert.equal(verdictFor(1.2), 'hit');
    assert.equal(verdictFor(0.9), 'close');
    assert.equal(verdictFor(0.4), 'missed');
    assert.equal(verdictFor(null), 'untracked');
  });

  test('a week that hits grows the next target faster than one that misses', () => {
    const hit = nextTarget(100, 1.2);
    const missed = nextTarget(100, 0.3);
    assert.ok(hit > missed, 'hitting should accelerate');
    assert.ok(missed > 100, 'a miss still grows, just slower — never goes backwards');
  });

  test('never compounds a miss into an unreachable target', () => {
    let current = 172;
    for (let week = 0; week < 8; week += 1) {
      current = nextTarget(current, 0.2, { floor: GROWTH.minFollowerGain });
    }
    // Eight consecutive bad weeks should not produce a fantasy number.
    assert.ok(current < 172 * 1.6, `8 missed weeks compounded to ${current}`);
  });

  test('respects the absolute floor on a small account', () => {
    // 4% of 20 followers is under one person; the floor keeps the goal real.
    const target = nextTarget(20, 1.0, { rate: 0.04, floor: GROWTH.minFollowerGain });
    assert.ok(target >= 20 + GROWTH.minFollowerGain);
  });

  test('targets are labelled as projections, never measurements', () => {
    const targets = buildTargets({ baseline: { followers: 172 }, cadence: 3 });
    assert.equal(targets.projection, true);
    assert.equal(targets.posts, 3);
    assert.ok(targets.followers > 172);
  });
});

describe('Strategist — scoring and adjustment', () => {
  const targets = { followers: 180, reach: 600, engagementRate: 5, saves: 10, shares: 5, posts: 3 };

  test('a missed cadence blames cadence first, not the content', () => {
    const card = scoreWeek({
      targets,
      actual: { followers: 174, reach: 300, engagementRate: 4, saves: 3, shares: 1, posts: 1 },
    });
    assert.equal(card.scores.posts.verdict, 'missed');
    assert.equal(card.adjustments[0].lever, 'cadence');
    assert.match(card.adjustments[0].say, /filming slots/);
  });

  test('missed saves biases the mix toward saveable formats', () => {
    const card = scoreWeek({
      targets,
      actual: { followers: 185, reach: 700, engagementRate: 6, saves: 2, shares: 6, posts: 3 },
    });
    const bias = formatBiasFrom(card);
    assert.ok(bias.education_myth > 0);
    assert.ok(bias.maintenance_tips > 0);
  });

  test('missed shares biases toward high-contrast formats', () => {
    const card = scoreWeek({
      targets,
      actual: { followers: 185, reach: 700, engagementRate: 6, saves: 15, shares: 0, posts: 3 },
    });
    const bias = formatBiasFrom(card);
    assert.ok(bias.transformation_reveal > 0 || bias.client_reaction > 0);
  });

  test('good engagement but no follower growth is called out as a reach problem', () => {
    // Followers well short of target while engagement over-delivers: the content
    // works on people who already follow, but is not finding new ones.
    const card = scoreWeek({
      targets,
      actual: { followers: 140, reach: 700, engagementRate: 9, saves: 15, shares: 8, posts: 3 },
    });
    assert.equal(card.scores.followers.verdict, 'missed');
    assert.equal(card.scores.engagementRate.verdict, 'hit');
    assert.ok(card.adjustments.some((a) => a.lever === 'reach'));
  });

  test('a near-miss on followers is not treated as a reach failure', () => {
    const card = scoreWeek({
      targets,
      actual: { followers: 176, reach: 700, engagementRate: 9, saves: 15, shares: 8, posts: 3 },
    });
    assert.equal(card.scores.followers.verdict, 'close');
    assert.equal(card.adjustments.some((a) => a.lever === 'reach'), false);
  });

  test('a clean week holds the plan rather than inventing a change', () => {
    const card = scoreWeek({
      targets,
      actual: { followers: 190, reach: 800, engagementRate: 7, saves: 15, shares: 8, posts: 3 },
    });
    assert.equal(card.verdict, 'hit');
    assert.equal(card.adjustments[0].lever, 'hold');
  });

  test('format winners and losers feed back into the bias', () => {
    const card = scoreWeek({
      targets,
      actual: { followers: 190, reach: 800, engagementRate: 7, saves: 15, shares: 8, posts: 3 },
      formatResults: [
        { format: 'education_myth', score: 40 },
        { format: 'product_feature', score: 2 },
      ],
    });
    const bias = formatBiasFrom(card);
    assert.ok(bias.education_myth > 0);
    assert.ok(bias.product_feature < 0);
  });

  test('the bias actually moves the Scout ranking', () => {
    const plain = scoreFormats({});
    const biased = scoreFormats({ formatBias: { product_feature: 40 } });
    const before = plain.findIndex((f) => f.id === 'product_feature');
    const after = biased.findIndex((f) => f.id === 'product_feature');
    assert.ok(after < before, 'a positive bias should raise the format');
    assert.ok(biased[after].reasons.some((r) => /scorecard/.test(r)));
  });

  test('runStrategist opens a week and persists it', async () => {
    const store = freshStore();
    const { goals } = await runStrategist({
      account: { followers: 172 },
      insights: [{ saves: 3, shares: 1, engagementRate: 6 }],
      store,
      cadence: 3,
    });
    assert.ok(goals.week.targets.followers > 172);
    assert.equal(goals.week.baseline.followers, 172);
    assert.equal(store.state.weeks.length, 1);
  });
});

// ---------------------------------------------------------------------------
describe('brand', () => {
  test('business facts match what was read from her live profile and booking site', () => {
    assert.equal(BUSINESS.handle, 'hairbysha_c');
    assert.equal(BUSINESS.igUserId, '27461710323507831');
    assert.match(BUSINESS.bookingUrl, /^https:\/\//);
    assert.ok(BUSINESS.serviceSuburbs.includes('Camberwell'));
  });

  test('every service has a real price and duration', () => {
    for (const s of allServices()) {
      assert.ok(s.from > 0, `${s.name} needs a price`);
      assert.ok(s.minutes > 0, `${s.name} needs a duration`);
    }
    assert.equal(serviceById('full_blonde').from, 320);
    assert.equal(durationLabel(serviceById('full_blonde')), '3.5 hours');
    assert.ok(SERVICES.pricesReadAt, 'prices must carry a read date so staleness is visible');
  });

  test('seasons are southern hemisphere — the classic AU content mistake', () => {
    assert.equal(seasonFor(new Date('2026-01-15')).name, 'Summer');
    assert.equal(seasonFor(new Date('2026-07-15')).name, 'Winter');
    assert.equal(seasonFor(new Date('2026-10-15')).name, 'Spring');
  });

  test('voice check catches hype, shouting and emoji rows', () => {
    assert.ok(voiceViolations('This is STUNNING').length);
    assert.ok(voiceViolations('So good!!!').length);
    assert.ok(voiceViolations('✨🤍💕😍🔥 blonde').length);
    assert.equal(voiceViolations('Dimension that doesn’t scream for attention. 🤍').length, 0);
  });

  test('K18 and DM are not mistaken for shouting', () => {
    assert.equal(voiceViolations('K18 treatment in-chair. DM to book.').length, 0);
  });

  test('the Critic warns on off-brand voice without blocking the post', () => {
    const post = {
      id: 'p',
      mediaType: 'REELS',
      media: [{ url: 'https://x.com/a.mp4', kind: 'video', origin: 'real' }],
      caption: {
        body: 'This blonde is STUNNING!!!',
        cta: 'Book now — link in bio',
        hashtags: ['HairBySha', 'CamberwellHair', 'MelbourneHairdresser'],
      },
    };
    const { passed, violations } = critique(post);
    const voice = violations.filter((v) => v.rule === 'OFF_BRAND_VOICE');
    assert.ok(voice.length, 'expected a voice warning');
    assert.equal(passed, true, 'voice is a warning — Sha decides, it does not block');
  });
});

// ---------------------------------------------------------------------------
describe('playbook', () => {
  const format = FORMAT_LIBRARY.find((f) => f.id === 'transformation_reveal');

  test('shot plan puts the hook first and lands in the performing range', () => {
    const shots = buildShotPlan(format);
    assert.match(shots[0].role, /hook/);
    assert.equal(shots[0].seconds, 2);
    const total = shots.reduce((a, s) => a + s.seconds, 0);
    assert.ok(total >= 15 && total <= 30, `total ${total}s should sit in 15-30s`);
    assert.match(shots[shots.length - 1].role, /payoff/);
  });

  test('spoken formats get voice guidance, visual ones get trending audio', () => {
    assert.equal(audioGuidance({ id: 'education_myth' }).type, 'your voice');
    assert.equal(audioGuidance({ id: 'transformation_reveal' }).type, 'trending audio');
  });

  test('a full playbook carries everything needed to film without asking', () => {
    const caption = draftCaption(format, { index: 0 });
    const pb = buildPlaybook(format, { caption, slot: '2026-08-13T08:30:00.000Z', index: 0 });

    assert.ok(pb.hook.say);
    assert.ok(pb.hook.onScreen.length <= 42);
    assert.ok(pb.shots.length);
    assert.ok(pb.framing.light);
    assert.ok(pb.audio.how);
    assert.ok(pb.caption.pasteReady.includes('#'));
    assert.ok(pb.afterPosting.length >= 3);
    assert.ok(pb.study.accounts.length);
    assert.ok(pb.study.browse.length);
    assert.ok(pb.consent, 'a real-client format must carry a consent reminder');
  });

  test('paste-ready caption keeps every hashtag prefixed', () => {
    const caption = draftCaption(format, { index: 2 });
    const pb = buildPlaybook(format, { caption, index: 2 });
    const tagLine = pb.caption.pasteReady.split('\n\n').pop();
    for (const tag of tagLine.split(' ')) assert.match(tag, /^#[A-Za-z0-9_]+$/);
  });
});

// ---------------------------------------------------------------------------
describe('references', () => {
  test('every study account carries provenance and claims no view counts', () => {
    for (const a of STUDY_ACCOUNTS) {
      assert.match(a.url, /^https:\/\/www\.instagram\.com\//);
      assert.ok(a.sourcedFrom, `${a.handle} needs a source`);
      assert.equal(a.verified, false, 'nothing is claimed as verified');
      assert.ok(a.watchFor.length);
      assert.equal(/\b\d+[km]? (views|likes)\b/i.test(JSON.stringify(a)), false);
    }
  });

  test('browse URLs are constructed patterns, so they are live by definition', () => {
    assert.equal(
      LIVE_BROWSE.instagramTag('melbournehairdresser'),
      'https://www.instagram.com/explore/tags/melbournehairdresser/',
    );
    assert.equal(LIVE_BROWSE.tiktokTag('balayage'), 'https://www.tiktok.com/tag/balayage');
  });

  test('every format resolves to something to study', () => {
    for (const format of FORMAT_LIBRARY) {
      assert.ok(browseFor(format.id).length, `${format.id} needs browse links`);
      assert.ok(accountsFor(format.id).length, `${format.id} needs study accounts`);
    }
  });
});

// ---------------------------------------------------------------------------
describe('internal reasoning never reaches the audience', () => {
  test('no caption body contains the format’s internal "why"', () => {
    for (const format of FORMAT_LIBRARY) {
      for (let i = 0; i < 5; i += 1) {
        const caption = draftCaption(format, { index: i });
        assert.equal(
          caption.body.includes(format.why),
          false,
          `${format.id}#${i} leaked internal strategy copy into the caption`,
        );
      }
    }
  });

  test('no caption or playbook leaves an unfilled {template} variable', () => {
    for (const format of FORMAT_LIBRARY) {
      for (let i = 0; i < 5; i += 1) {
        const caption = draftCaption(format, { index: i });
        const pb = buildPlaybook(format, { caption, index: i });
        assert.doesNotMatch(caption.body, /\{[a-z]+\}/i, `${format.id}#${i} caption body`);
        assert.doesNotMatch(pb.hook.say, /\{[a-z]+\}/i, `${format.id}#${i} playbook hook`);
        assert.doesNotMatch(pb.caption.pasteReady, /\{[a-z]+\}/i, `${format.id}#${i} paste-ready`);
      }
    }
  });

  test('the shoot brief itself carries no unfilled template variable', async () => {
    // Regression: the shoot list re-filled hooks with an empty var map, so a
    // literal "{n}" rendered on the page Sha reads while filming.
    const { runProducer } = await import('../src/stages/brief.js');
    const { brief } = await runProducer({
      formatRanking: scoreFormats({}),
      library: [],
      cadence: 5,
    });
    for (const slot of brief.shootList) {
      assert.doesNotMatch(slot.hook, /\{[a-z]+\}/i, `${slot.format} shoot-list hook`);
    }
    for (const pb of brief.playbooks) {
      assert.doesNotMatch(JSON.stringify(pb), /\{[a-z]+\}/i, `${pb.format} playbook`);
    }
  });

  test('the playbook hook matches the caption’s opening line', () => {
    const format = FORMAT_LIBRARY[0];
    const caption = draftCaption(format, { index: 0 });
    const pb = buildPlaybook(format, { caption, index: 0 });
    assert.equal(pb.hook.say, caption.body.split('\n\n')[0]);
  });
});

describe('targets are withheld when nothing was measured', () => {
  test('no baseline produces no growth targets rather than a nonsense one', () => {
    const targets = buildTargets({ baseline: { followers: 0 }, cadence: 3 });
    assert.equal(targets.baselineKnown, false);
    assert.equal(targets.followers, undefined);
    assert.ok(targets.unavailable);
    assert.equal(targets.posts, 3, 'cadence is a decision, not a measurement — it survives');
  });

  test('a real baseline produces real targets above the current count', () => {
    const targets = buildTargets({ baseline: { followers: 172 }, cadence: 3 });
    assert.equal(targets.baselineKnown, true);
    assert.ok(targets.followers > 172);
    assert.equal(targets.unavailable, undefined);
  });
});

describe('expanded format library', () => {
  test('the new post types are present and well formed', () => {
    for (const id of [
      'seasonal_angle',
      'service_spotlight',
      'offer_promo',
      'new_client_welcome',
      'aftercare_routine',
    ]) {
      const format = FORMAT_LIBRARY.find((f) => f.id === id);
      assert.ok(format, `${id} missing`);
      assert.ok(format.hooks.length && format.shotList.length);
      assert.ok(['REELS', 'IMAGE', 'CAROUSEL'].includes(format.mediaType));
    }
  });

  test('every format still drafts a caption the Critic passes', () => {
    for (const format of FORMAT_LIBRARY) {
      for (let i = 0; i < 5; i += 1) {
        const caption = draftCaption(format, { index: i });
        const post = {
          id: `${format.id}-${i}`,
          mediaType: format.mediaType === 'CAROUSEL' ? 'REELS' : format.mediaType,
          media: [{ url: 'https://x.com/a.mp4', kind: 'video', origin: 'real' }],
          caption,
        };
        const { passed, violations } = critique(post);
        assert.equal(
          passed,
          true,
          `${format.id}#${i}: ${violations.filter((v) => v.severity === 'block').map((v) => `${v.rule} ${v.message}`).join('; ')}`,
        );
      }
    }
  });

  test('service posts quote a real price from her live menu', () => {
    const format = FORMAT_LIBRARY.find((f) => f.id === 'service_spotlight');
    const prices = allServices().map((s) => `$${s.from}`);
    let quoted = 0;
    for (let i = 0; i < SERVICES.colour.length; i += 1) {
      const caption = draftCaption(format, { index: i });
      const hit = prices.find((p) => caption.body.includes(p));
      if (hit) quoted += 1;
    }
    assert.ok(quoted > 0, 'a service post should quote a real price');
  });

  test('seasonal posts use the Melbourne season, not a northern one', () => {
    const format = FORMAT_LIBRARY.find((f) => f.id === 'seasonal_angle');
    const july = draftCaption(format, { index: 0, now: new Date('2026-07-15') });
    assert.match(july.body, /Winter/);
    const january = draftCaption(format, { index: 0, now: new Date('2026-01-15') });
    assert.match(january.body, /Summer/);
  });
});
