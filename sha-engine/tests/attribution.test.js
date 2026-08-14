import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, matchPost, reconcile, summarise } from '../src/lib/attribution.js';

const PACK = {
  weekOf: '2026-08-10',
  posts: [
    {
      id: 'w1-price',
      title: 'What a full head of foils actually costs',
      type: 'offer',
      caption: {
        hook: 'A full head of foils at my chair is $320.',
        body: 'That is three and a half hours: foils root to end, a toner to finish, and a blow wave.',
      },
    },
    {
      id: 'w1-myth',
      title: 'Purple shampoo does not fix brass',
      type: 'education',
      caption: {
        hook: 'Purple shampoo is not fixing your brass.',
        body: 'It deposits violet pigment on the outside of the hair.',
      },
    },
  ],
};

describe('did she actually post it', () => {
  test('matches a caption she pasted verbatim', () => {
    const media = [{
      permalink: 'https://instagram.com/p/AAA/',
      caption: 'A full head of foils at my chair is $320.\n\nThat is three and a half hours…',
      engagementRate: 9.1, likes: 16, comments: 2, grade: 'A',
    }];
    const hit = matchPost(PACK.posts[0], media);
    assert.equal(hit?.permalink, 'https://instagram.com/p/AAA/');
  });

  test('survives an emoji and a changed dash', () => {
    // She adds emoji on her phone and Instagram swaps quotes. The text is the
    // same post; a naive equality check would call it unpublished.
    const media = [{
      permalink: 'https://instagram.com/p/BBB/',
      caption: '✨ A full head of foils at my chair is $320 ✨ — three and a half hours',
      engagementRate: 5,
    }];
    assert.ok(matchPost(PACK.posts[0], media));
  });

  test('matches when she trims the tail of the hook', () => {
    // She edits the end of a line far more often than the start.
    const post = {
      caption: { hook: 'Four things quietly costing you weeks of colour this winter.', body: '' },
    };
    const media = [{ permalink: 'x', caption: 'Four things quietly costing you weeks 🤍' }];
    assert.ok(matchPost(post, media));
  });

  test('a six-word prefix is still specific enough to not collide', () => {
    const post = { caption: { hook: 'Four things quietly costing you weeks of colour.', body: '' } };
    const media = [{ permalink: 'x', caption: 'Three things worth knowing before you book a balayage' }];
    assert.equal(matchPost(post, media), null);
  });

  test('does not match an unrelated post', () => {
    const media = [{ permalink: 'x', caption: 'Blonde refresh after 10 weeks. Booked for spring.' }];
    assert.equal(matchPost(PACK.posts[0], media), null);
  });

  test('an unposted post is reported as unrun, not as a failure', () => {
    const out = reconcile(PACK, { media: [], accountAverage: 7.48 });
    assert.equal(out.publishedCount, 0);
    assert.equal(out.rows[0].published, false);
    assert.match(out.rows[0].note, /not posted|not found/i);
    // No engagement figure at all, rather than a zero that would drag averages
    // down and make a format look like it failed.
    assert.equal(out.rows[0].engagementRate, undefined);
  });

  test('lift is measured against the account, not an outside benchmark', () => {
    const media = [{
      permalink: 'https://instagram.com/p/AAA/',
      caption: 'A full head of foils at my chair is $320.',
      engagementRate: 10.48, likes: 18, comments: 1, grade: 'A',
      savesMeasured: false, sharesMeasured: false,
    }];
    const out = reconcile(PACK, { media, accountAverage: 7.48 });
    assert.equal(out.publishedCount, 1);
    assert.equal(out.rows[0].liftVsAverage, 3);
    assert.equal(out.rows[0].savesMeasured, false);
  });

  test('summary names both what went up and what did not', () => {
    const media = [{
      permalink: 'https://instagram.com/p/AAA/',
      caption: 'A full head of foils at my chair is $320.',
      engagementRate: 10.48, likes: 18, comments: 1, grade: 'A',
    }];
    const text = summarise(reconcile(PACK, { media, accountAverage: 7.48 }));
    assert.match(text, /not posted   Purple shampoo/);
    assert.match(text, /1 of 2 authored posts went up/);
  });

  test('normalise strips emoji and punctuation but keeps words', () => {
    assert.equal(normalise('✨ Purple shampoo — is NOT fixing your brass! ✨'),
      'purple shampoo is not fixing your brass');
  });
});

describe('the review carries what attribution needs', () => {
  test('scoreMedia keeps the caption', async () => {
    // Regression: it did not, so every authored post reconciled as "not
    // posted" no matter what was on the account.
    const { scoreMedia } = await import('../src/stages/review.js');
    const scored = scoreMedia(
      { id: '1', permalink: 'p', timestamp: 't', caption: 'A full head of foils is $320.', like_count: 10 },
      { followers: 176 },
    );
    assert.equal(scored.caption, 'A full head of foils is $320.');
  });

  test('a scored post flows straight into reconcile', async () => {
    const { scoreMedia } = await import('../src/stages/review.js');
    const media = [scoreMedia(
      { id: '1', permalink: 'p', timestamp: 't', caption: 'Purple shampoo is not fixing your brass. Here is why.', like_count: 20 },
      { followers: 176 },
    )];
    const out = reconcile(PACK, { media, accountAverage: 7.48 });
    assert.equal(out.publishedCount, 1);
    assert.equal(out.rows[1].published, true);
  });
});
