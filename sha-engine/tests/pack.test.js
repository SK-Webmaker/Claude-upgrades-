import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import pack, { checkCaption, fullCaption, weekOf } from '../src/lib/pack.js';

describe('the week pack', () => {
  test('every shipped pack passes the Critic', () => {
    // forWeek throws if any caption in the pack trips a blocker, so the call
    // itself is the assertion. This is the guard that stops a hand-written
    // pack reaching the console with an unhashed tag or a drafting leftover.
    const week = pack.current();
    assert.ok(week, 'no pack found for the current week');
    assert.ok(week.posts.length >= 3, 'a week owes Sha three finished posts');
    assert.ok(week.videoGuides.length >= 2, 'a week owes Sha at least two video guides');
  });

  test('finished means the image exists, not just the caption', () => {
    const week = pack.current();
    assert.equal(week.missingImages.length, 0, `unrendered: ${week.missingImages.join(', ')}`);
    assert.equal(week.complete, true);
  });

  test('every post and guide carries a caption that can be pasted as-is', () => {
    const week = pack.current();
    for (const item of [...week.posts, ...week.videoGuides]) {
      assert.match(item.caption.full, /#/, `${item.id} has no hashtags in the assembled caption`);
      assert.ok(item.caption.full.includes(item.caption.hook), `${item.id} lost its hook`);
    }
  });

  test('an unhashed tag is caught', () => {
    const problems = checkCaption({
      hook: 'Purple shampoo is not fixing your brass.',
      body: 'MelbourneHairdresser',
      cta: 'Book at the link in bio',
      hashtags: ['#a', '#b', '#c', '#d'],
    });
    assert.ok(problems.some((p) => p.includes('MelbourneHairdresser')));
  });

  test('a drafting leftover is caught', () => {
    const problems = checkCaption({
      hook: 'A hook.',
      body: 'Alt caption (shorter, quieter tone)',
      cta: 'Book at the link in bio',
      hashtags: ['#a', '#b', '#c', '#d'],
    });
    assert.ok(problems.some((p) => p.includes('drafting leftover')));
  });

  test('too few hashtags is caught', () => {
    const problems = checkCaption({ hook: 'A hook.', body: 'Body.', hashtags: ['#one'] });
    assert.ok(problems.some((p) => p.includes('1 hashtags')));
  });

  test('a word that merely contains a banned word is not flagged', () => {
    // "ate" is on the avoid list, and a substring test flags "water", "later"
    // and "generate" with it. Every aftercare caption she will ever write
    // contains the word water.
    const problems = checkCaption({
      hook: 'The toner leaves with the water.',
      body: 'Wash it later, at a moderate temperature.',
      hashtags: ['#a', '#b', '#c', '#d'],
    });
    assert.deepEqual(problems, []);
  });

  test('the booking link only appears when there is a call to action', () => {
    const withCta = fullCaption({ hook: 'H', body: 'B', cta: 'Book', hashtags: ['#a'] }, 'https://book');
    const without = fullCaption({ hook: 'H', body: 'B', hashtags: ['#a'] }, 'https://book');
    assert.ok(withCta.includes('https://book'));
    assert.ok(!without.includes('https://book'));
  });

  test('weekOf snaps to Monday', () => {
    assert.equal(weekOf(new Date('2026-08-13T04:00:00Z')), '2026-08-10'); // Thursday
    assert.equal(weekOf(new Date('2026-08-10T00:00:00Z')), '2026-08-10'); // Monday
    assert.equal(weekOf(new Date('2026-08-16T23:00:00Z')), '2026-08-10'); // Sunday
  });
});
