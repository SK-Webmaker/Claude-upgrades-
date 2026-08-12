import { test } from 'node:test';
import assert from 'node:assert/strict';

import { groupWords, buildKaraokeLine, buildKaraokeAss, remapWords } from '../src/lib/karaoke.js';
import { cropExpression } from '../src/lib/analyse.js';
import { resolveOrder, explain } from '../src/agents/coordinator.js';
import { AGENTS, getAgent } from '../src/agents/registry.js';
import tiktok from '../src/platforms/tiktok.js';

const LOOK = {
  safeAreaBottomPct: 20, safeAreaTopPct: 14, captionFontSize: 52,
  captionPrimary: '#FFFFFF', captionOutline: '#12100E', accent: '#B07C33',
};
const VIDEO = { width: 1080, height: 1920 };

const WORDS = [
  { word: 'Your', start: 0.20, end: 0.42 }, { word: 'blonde', start: 0.45, end: 0.85 },
  { word: 'went', start: 0.88, end: 1.10 }, { word: 'orange.', start: 1.13, end: 1.62 },
  { word: 'Here', start: 2.20, end: 2.45 }, { word: 'is', start: 2.48, end: 2.60 },
  { word: 'why.', start: 2.63, end: 3.00 },
];

test('groupWords breaks lines on natural speech pauses', () => {
  const lines = groupWords(WORDS);
  assert.equal(lines.length, 2, 'the 0.58s pause should start a new line');
  assert.equal(lines[0].text, 'Your blonde went orange.');
  assert.equal(lines[1].text, 'Here is why.');
});

test('groupWords respects the character ceiling', () => {
  const long = Array.from({ length: 12 }, (_, i) => ({
    word: 'wordy', start: i * 0.2, end: i * 0.2 + 0.15,
  }));
  const lines = groupWords(long, { maxChars: 20 });
  assert.ok(lines.length > 1);
  for (const l of lines) assert.ok(l.text.length <= 24, `line too long: ${l.text}`);
});

test('karaoke line pads gaps so highlighting stays in sync', () => {
  const line = groupWords(WORDS)[0];
  const built = buildKaraokeLine(line, { highlight: '&H00337CB0' });
  assert.ok(built.includes('\\kf'), 'must use kf sweep timing');
  assert.ok(built.includes('\\k3'), 'inter-word gaps must be padded');
  // Total karaoke time must match the line duration, or captions drift.
  const total = [...built.matchAll(/\\kf?(\d+)/g)].reduce((a, m) => a + Number(m[1]), 0);
  const expected = Math.round((line.end - line.start) * 100);
  assert.ok(Math.abs(total - expected) <= 3, `karaoke total ${total} vs line ${expected}`);
});

test('karaoke ASS carries both styles and a secondary colour', () => {
  const ass = buildKaraokeAss({
    lines: groupWords(WORDS), fixed: [{ text: 'Hook', start: 0, end: 2 }],
    look: LOOK, video: VIDEO,
  });
  assert.ok(ass.includes('Style: Karaoke,'));
  assert.ok(ass.includes('Style: Hook,'));
  assert.ok(ass.includes('\\2c'), 'needs the pre-highlight colour');
  assert.equal(ass.split('\n').filter((l) => l.startsWith('Dialogue')).length, 3);
});

test('remapWords drops words outside kept segments and rebases the rest', () => {
  const out = remapWords(WORDS, [{ start: 2.0, end: 3.5 }], { ramped: false });
  assert.equal(out.length, 3, 'only the second sentence survives');
  assert.ok(Math.abs(out[0].start - 0.20) < 0.01, 'first kept word rebases to ~0.2s');
  assert.ok(out.every((w) => w.start >= 0));
});

test('remapWords compresses timings when the clip is speed-ramped', () => {
  const words = [{ word: 'late', start: 10, end: 10.5 }];
  const plain = remapWords(words, [{ start: 0, end: 20 }], { ramped: false });
  const ramp = remapWords(words, [{ start: 0, end: 20 }], {
    ramped: true, rampAfterSecond: 6, rampFactor: 2,
  });
  assert.ok(ramp[0].start < plain[0].start, 'ramped timing must pull earlier');
  assert.ok(Math.abs(ramp[0].start - 8) < 0.01, '6 + (10-6)/2 = 8');
});

test('cropExpression stays static for a still subject', () => {
  const r = cropExpression(
    { ok: true, recommendStatic: true, meanCentre: 0.5, track: [] },
    { sourceWidth: 1920, cropWidth: 1080 }
  );
  assert.equal(r.animated, false);
  assert.equal(r.expr, '420'); // 0.5*1920 - 540
});

test('cropExpression follows a moving subject and stays in bounds', () => {
  const track = [{ t: 0, centre: 0.2 }, { t: 1, centre: 0.5 }, { t: 2, centre: 0.9 }];
  const r = cropExpression(
    { ok: true, recommendStatic: false, meanCentre: 0.5, track },
    { sourceWidth: 1920, cropWidth: 1080 }
  );
  assert.equal(r.animated, true);
  assert.ok(r.expr.startsWith('if(lt(t,'));
  for (const m of r.expr.matchAll(/,(\d+)[,)]/g)) {
    const x = Number(m[1]);
    assert.ok(x >= 0 && x <= 1920 - 1080, `crop x ${x} out of bounds`);
  }
});

test('cropExpression falls back to centre when analysis failed', () => {
  const r = cropExpression({ ok: false, meanCentre: 0.5 }, { sourceWidth: 1080, cropWidth: 1080 });
  assert.equal(r.expr, '0');
  assert.equal(r.animated, false);
});

test('coordinator orders agents so requirements come first', () => {
  const order = resolveOrder().map((a) => a.id);
  const before = (a, b) => order.indexOf(a) < order.indexOf(b);
  // The Editor is retired — video is filmed and posted natively by Sha, so
  // the chain runs brief → gate → publish rather than brief → cut → gate.
  assert.ok(before('producer', 'critic'), 'brief before gating');
  assert.ok(before('critic', 'publisher'), 'gate before publishing');
  assert.ok(before('publisher', 'analyst'), 'publish before scoring');
  assert.equal(order.length, AGENTS.length);
});

test('coordinator detects a circular dependency instead of hanging', () => {
  const cyclic = [
    { id: 'a', name: 'A', produces: ['x'], requires: ['y'], optional: [], run: async () => {} },
    { id: 'b', name: 'B', produces: ['y'], requires: ['x'], optional: [], run: async () => {} },
  ];
  assert.throws(() => resolveOrder(cyclic), /Circular dependency/);
});

test('every agent declares an escalation message a human can act on', () => {
  for (const a of AGENTS) {
    assert.ok(a.escalate && a.escalate.length > 20, `${a.id} needs a real escalation message`);
    assert.equal(typeof a.critical, 'boolean');
    assert.ok(Array.isArray(a.produces) && a.produces.length);
  }
});

test('critical agents are exactly the ones that block a week', () => {
  const critical = AGENTS.filter((a) => a.critical).map((a) => a.id).sort();
  assert.deepEqual(critical, ['critic', 'producer']);
});

test('explain reports degraded capabilities without running anything', () => {
  const rows = explain();
  assert.equal(rows.length, AGENTS.length);
  assert.ok(rows.every((r) => Array.isArray(r.degraded)));
});

test('getAgent resolves by id', () => {
  assert.equal(getAgent('producer').name, 'Producer');
  assert.equal(getAgent('scout').name, 'Scout');
  assert.equal(getAgent('editor'), null, 'the Editor was retired with the cut stage');
  assert.equal(getAgent('nope'), null);
});

test('tiktok prefers the broker route so posts reach a public audience', () => {
  assert.equal(tiktok.resolveMode(), 'broker');
  assert.equal(tiktok.BROKER.supportsDirectPost, true);
});

test('broker preflight enforces the real media limits', () => {
  const ok = tiktok.brokerPreflight({ render: { durationSec: 22, width: 1080, height: 1920, sizeBytes: 9e6 } });
  assert.equal(ok.ok, true);

  const short = tiktok.brokerPreflight({ render: { durationSec: 2, width: 1080, height: 1920, sizeBytes: 1e6 } });
  assert.equal(short.ok, false);

  const tiny = tiktok.brokerPreflight({ render: { durationSec: 20, width: 200, height: 300, sizeBytes: 1e6 } });
  assert.ok(tiny.problems.some((p) => p.includes('360')));

  const huge = tiktok.brokerPreflight({ render: { durationSec: 20, width: 1080, height: 1920, sizeBytes: 2e9 } });
  assert.ok(huge.problems.some((p) => p.includes('1 GB')));
});

test('broker payload declares AIGC and branded content honestly', () => {
  const p = tiktok.brokerPayload({
    render: { durationSec: 22, width: 1080, height: 1920, sizeBytes: 9e6, outFile: '/x/a.mp4' },
    caption: { hook: 'Hook', cta: 'Book', hashtags: ['#a'] },
  });
  // Sha's own footage of her own work is neither AI-generated nor branded
  // content for a third party; misdeclaring either breaches TikTok's terms.
  assert.equal(p.is_aigc, false);
  assert.equal(p.commercial_content_disclosure.enabled, false);
  assert.equal(p.privacy_level, 'PUBLIC_TO_EVERYONE');
  assert.ok(p.title.length <= 150);
});

test('claimedClipIds keeps in-flight footage out of a re-plan', async () => {
  const { claimedClipIds } = await import('../src/stages/plan.js');
  const posts = [
    { status: 'awaiting_approval', clipIds: ['c1', 'c2'] },
    { status: 'cut', clipIds: ['c3'] },
    { status: 'published', clipIds: ['c4'] },
    { status: 'rejected', clipIds: ['c5'] },   // freed for reuse
    { status: 'failed', clipIds: ['c6'] },     // freed for reuse
  ];
  const claimed = claimedClipIds(posts);
  // Without this, running the week twice duplicates every post.
  assert.ok(claimed.has('c1') && claimed.has('c2') && claimed.has('c3') && claimed.has('c4'));
  assert.ok(!claimed.has('c5'), 'rejected footage should be reusable');
  assert.ok(!claimed.has('c6'), 'failed footage should be reusable');
  assert.equal(claimed.size, 4);
});
