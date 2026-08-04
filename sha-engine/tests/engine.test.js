import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectSegments, predictDuration, buildFilterGraph } from '../src/stages/cut.js';
import { allocateMix, scheduleSlots, resolveHook } from '../src/stages/plan.js';
import { classify, groupIntoSessions } from '../src/stages/ingest.js';
import { parseTrends, scoreTrend } from '../src/stages/research.js';
import { scorePost, decayWeight } from '../src/stages/learn.js';
import { evaluate } from '../src/stages/gate.js';
import { buildAss, hexToAss } from '../src/lib/subtitles.js';
import { buildCaption as igCaption, preflight as igPreflight } from '../src/platforms/instagram.js';
import { resolveMode, preflight as ttPreflight } from '../src/platforms/tiktok.js';
import { resolveMediaUrl, isDue } from '../src/stages/ship.js';

const OPTS = {
  video: { targetSeconds: 24, minSeconds: 12, width: 1080, height: 1920 },
  cut: { minSegmentSeconds: 0.8, maxSegmentSeconds: 6, rampFactor: 1.6, rampAfterSecond: 6 },
  look: { safeAreaBottomPct: 20, captionFontSize: 52, captionPrimary: '#FFFFFF', captionOutline: '#12100E' },
};

test('selectSegments returns chronological, non-overlapping windows', () => {
  const motion = Array.from({ length: 80 }, (_, i) => ({ t: i * 0.25, energy: (i % 20) * 3 }));
  const segs = selectSegments(motion, [4, 9, 14], 20, OPTS);
  assert.ok(segs.length > 0);
  for (let i = 1; i < segs.length; i++) {
    assert.ok(segs[i].start >= segs[i - 1].end, 'segments must not overlap');
  }
  assert.ok(segs.every((s) => s.end > s.start));
});

test('selectSegments falls back gracefully with no motion data', () => {
  const segs = selectSegments([], [], 18, OPTS);
  assert.ok(segs.length > 0);
  assert.ok(segs.every((s) => s.end <= 18));
});

test('predictDuration suppresses the ramp when it would breach the minimum', () => {
  // 14s of footage: ramping would give 6 + 8/1.6 = 11s, under the 12s floor.
  const segs = [{ start: 0, end: 14 }];
  const pred = predictDuration(segs, OPTS);
  assert.equal(pred.ramped, false);
  assert.equal(pred.duration, 14);
});

test('predictDuration ramps when there is headroom', () => {
  const segs = [{ start: 0, end: 30 }];
  const pred = predictDuration(segs, OPTS);
  assert.equal(pred.ramped, true);
  assert.ok(pred.duration > OPTS.video.minSeconds);
  assert.ok(pred.duration < 30);
});

test('predictDuration matches what the filtergraph actually builds', () => {
  const segs = [{ start: 0, end: 30 }];
  const pred = predictDuration(segs, OPTS);
  const { graph } = buildFilterGraph(segs, {}, OPTS, null, pred);
  assert.ok(graph.includes('ramped'), 'ramp should appear in the graph');

  const short = [{ start: 0, end: 14 }];
  const predShort = predictDuration(short, OPTS);
  const { graph: g2 } = buildFilterGraph(short, {}, OPTS, null, predShort);
  assert.ok(!g2.includes('ramped'), 'ramp must be absent when suppressed');
});

test('filtergraph crops to vertical and ends on a single labelled output', () => {
  const { graph, outLabel } = buildFilterGraph([{ start: 0, end: 5 }], {}, OPTS, null);
  assert.ok(graph.includes('crop=1080:1920'));
  assert.ok(graph.includes('force_original_aspect_ratio=increase'));
  assert.equal(outLabel, '[vout]');
});

test('allocateMix distributes every slot with no rounding loss', () => {
  const mix = { transformation: 0.4, education: 0.25, personality: 0.2, offer: 0.15 };
  for (const total of [3, 4, 5, 7, 12]) {
    const alloc = allocateMix(total, mix);
    const sum = Object.values(alloc).reduce((a, b) => a + b, 0);
    assert.equal(sum, total, `mix must sum to ${total}`);
  }
});

test('scheduleSlots produces sorted future-ordered times', () => {
  const week = new Date('2026-08-03T00:00:00');
  const times = scheduleSlots(5, week);
  assert.equal(times.length, 5);
  const sorted = [...times].sort();
  assert.deepEqual(times, sorted);
});

test('resolveHook fills placeholders and leaves none behind', () => {
  const out = resolveHook('{day} just opened up.', { scheduledFor: '2026-08-04T07:30:00' });
  assert.ok(!out.includes('{'), 'no unresolved placeholder may survive');
  assert.ok(out.includes('Tuesday'));

  const unknown = resolveHook('Hello {nonexistent} there', {});
  assert.ok(!unknown.includes('{'));
});

test('classify reads intent from the filename', () => {
  assert.ok(classify('before-jane.mp4').includes('before'));
  assert.ok(classify('final-reveal.mov').includes('after'));
  assert.ok(classify('foils-going-in.mp4').includes('process'));
  assert.deepEqual(classify('IMG_4821.mp4'), ['unsorted']);
});

test('groupIntoSessions splits on a time gap', () => {
  const clips = [
    { id: 'a', shotAt: '2026-08-01T09:00:00Z' },
    { id: 'b', shotAt: '2026-08-01T09:20:00Z' },
    { id: 'c', shotAt: '2026-08-01T15:00:00Z' },
  ];
  const sessions = groupIntoSessions(clips, 90);
  assert.equal(sessions.length, 2);
  assert.deepEqual(sessions[0].clips, ['a', 'b']);
});

test('parseTrends extracts hashtags and dedupes', () => {
  const rows = parseTrends('#balayage #Balayage #gaming #hairtransformation', 'hashtags');
  const values = rows.map((r) => r.value.toLowerCase());
  assert.equal(new Set(values).size, values.length, 'must dedupe');
  assert.ok(rows.find((r) => r.value.toLowerCase() === '#balayage').relevant);
  assert.equal(rows.find((r) => r.value === '#gaming').relevant, false);
});

test('scoreTrend ranks hair-relevant trends above irrelevant ones', () => {
  const hair = scoreTrend({ kind: 'hashtag', value: '#balayage', relevant: true }, {});
  const other = scoreTrend({ kind: 'hashtag', value: '#gaming', relevant: false }, {});
  assert.ok(hair > other);
});

test('scorePost weights booking taps far above likes', () => {
  const base = { reach: 1000, durationSec: 20 };
  const withTaps = scorePost({ ...base, bookingLinkTaps: 10 });
  const withLikes = scorePost({ ...base, likes: 10 });
  assert.ok(withTaps > withLikes * 5, 'a booking tap must dominate a like');
});

test('scorePost rewards retention', () => {
  const low = scorePost({ reach: 1000, durationSec: 20, avgWatchTimeSec: 2 });
  const high = scorePost({ reach: 1000, durationSec: 20, avgWatchTimeSec: 18 });
  assert.ok(high > low);
});

test('decayWeight halves over the configured half-life', () => {
  const recent = decayWeight(new Date().toISOString(), 45);
  const old = decayWeight(new Date(Date.now() - 45 * 86400000).toISOString(), 45);
  assert.ok(Math.abs(recent - 1) < 0.01);
  assert.ok(Math.abs(old - 0.5) < 0.02);
});

const CTX = { posts: [], clips: [], consentPolicySet: true, bookingUrlSet: true };
const GOOD_POST = {
  id: 'p1', type: 'education', formatId: 'f1', clipIds: [],
  render: { width: 1080, height: 1920, durationSec: 22 },
  captions: [{ text: 'Your blonde went orange', start: 0.15, end: 3 }],
  caption: { hook: 'Your blonde went orange', cta: 'Book at the link in bio', hashtags: [] },
};

test('gate passes a well-formed post', () => {
  const r = evaluate(GOOD_POST, CTX);
  assert.equal(r.verdict, 'pass', JSON.stringify(r.blockers));
});

test('gate blocks landscape video', () => {
  const r = evaluate({ ...GOOD_POST, render: { width: 1920, height: 1080, durationSec: 22 } }, CTX);
  assert.ok(r.blockers.some((b) => b.id === 'vertical'));
});

test('gate blocks a post with no captions', () => {
  const r = evaluate({ ...GOOD_POST, captions: [] }, CTX);
  assert.ok(r.blockers.some((b) => b.id === 'captions'));
});

test('gate blocks when the booking URL is unset', () => {
  const r = evaluate(GOOD_POST, { ...CTX, bookingUrlSet: false });
  assert.ok(r.blockers.some((b) => b.id === 'booking-url'));
});

test('gate blocks when no consent policy is configured', () => {
  const r = evaluate(GOOD_POST, { ...CTX, consentPolicySet: false });
  assert.ok(r.blockers.some((b) => b.id === 'consent'));
});

test('gate warns on banned brand-voice words', () => {
  const post = { ...GOOD_POST, caption: { ...GOOD_POST.caption, hook: 'OBSESSED with this colour' } };
  const r = evaluate(post, CTX);
  assert.ok(r.warnings.some((w) => w.id === 'voice'));
});

test('gate catches a near-duplicate of a recent post', () => {
  const ctx = {
    ...CTX,
    posts: [{
      id: 'old', formatId: 'f1', clipIds: ['c1', 'c2'],
      publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    }],
  };
  const dup = { ...GOOD_POST, id: 'new', formatId: 'f1', clipIds: ['c1', 'c2'] };
  const r = evaluate(dup, ctx);
  assert.ok(r.blockers.some((b) => b.id === 'not-duplicate'));
});

test('every failing rule explains itself in words a human can act on', () => {
  const r = evaluate({ ...GOOD_POST, render: { width: 100, height: 50, durationSec: 1 } }, CTX);
  for (const b of r.blockers) {
    assert.equal(typeof b.reason, 'string');
    assert.ok(b.reason.length > 15, `reason too terse: ${b.reason}`);
  }
});

test('hexToAss converts to ASS BGR ordering', () => {
  assert.equal(hexToAss('#FFFFFF'), '&H00FFFFFF');
  assert.equal(hexToAss('#FF0000'), '&H000000FF'); // red → BGR
});

test('buildAss produces a parseable file with both styles', () => {
  const ass = buildAss({
    captions: [{ text: 'Line one', start: 0, end: 2, style: 'hook' }],
    look: OPTS.look,
    video: OPTS.video,
  });
  assert.ok(ass.includes('[Script Info]'));
  assert.ok(ass.includes('PlayResX: 1080'));
  assert.ok(ass.includes('Style: Caption,'));
  assert.ok(ass.includes('Style: Hook,'));
  assert.ok(ass.includes('Dialogue: 0,0:00:00.00,0:00:02.00,Hook'));
});

test('buildAss neutralises brace injection in caption text', () => {
  const ass = buildAss({
    captions: [{ text: 'evil {\\pos(0,0)} text', start: 0, end: 1 }],
    look: OPTS.look, video: OPTS.video,
  });
  const dialogue = ass.split('\n').find((l) => l.startsWith('Dialogue:'));
  assert.ok(!dialogue.includes('{'), 'override blocks must not survive');
});

test('instagram preflight rejects over-length and local-only media', () => {
  assert.equal(igPreflight({ render: { durationSec: 95, width: 1080, height: 1920 }, mediaUrl: 'https://x/y.mp4' }).ok, false);
  assert.equal(igPreflight({ render: { durationSec: 20, width: 1080, height: 1920 } }).ok, false);
  assert.equal(igPreflight({ render: { durationSec: 20, width: 1080, height: 1920 }, mediaUrl: 'https://x/y.mp4' }).ok, true);
});

test('instagram caption assembles hook, cta and hashtags within the limit', () => {
  const c = igCaption({ caption: { hook: 'Hook here', cta: 'Book now', hashtags: ['#a', '#b'] } });
  assert.ok(c.includes('Hook here'));
  assert.ok(c.includes('#a #b'));
  assert.ok(c.length <= 2200);
});

test('tiktok defaults to the inbox flow until the audit passes', () => {
  assert.equal(resolveMode(), 'inbox');
  const pre = ttPreflight({ render: { durationSec: 20 }, mediaUrl: 'https://x/y.mp4' });
  assert.equal(pre.ok, true);
  assert.equal(pre.mode, 'inbox');
});

test('ship will not invent a media URL it cannot serve', () => {
  assert.equal(resolveMediaUrl({ render: { outFile: '/tmp/a.mp4' } }), null);
  assert.equal(resolveMediaUrl({ mediaUrl: 'https://cdn/x.mp4' }), 'https://cdn/x.mp4');
});

test('isDue respects the schedule', () => {
  const past = new Date(Date.now() - 60000).toISOString();
  const future = new Date(Date.now() + 3600000).toISOString();
  assert.equal(isDue({ scheduledFor: past }), true);
  assert.equal(isDue({ scheduledFor: future }), false);
  assert.equal(isDue({}), true);
});
