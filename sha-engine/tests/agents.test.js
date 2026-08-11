import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AGENTS } from '../src/agents/registry.js';
import { resolveOrder, runPipeline } from '../src/agents/coordinator.js';
import { Store, POST_STATUS } from '../src/lib/store.js';
import { critique, runCritic } from '../src/stages/gate.js';
import { scoreFormats, FORMAT_LIBRARY } from '../src/stages/scout.js';
import { buildHashtags, draftCaption, runProducer } from '../src/stages/brief.js';
import { runPublisher, approvePost, rejectPost, publishApproved } from '../src/stages/ship.js';
import { scorePost, auditPublishedCaptions } from '../src/stages/learn.js';
import { runLibrarian, classify } from '../src/stages/ingest.js';
import { InstagramComposio, renderCaption } from '../src/platforms/instagram-composio.js';

const freshStore = () => new Store(mkdtempSync(join(tmpdir(), 'sha-')));

const goodCaption = {
  body: 'Same length. Same base. Completely different hair.\n\nA lowlight and gloss transformation.',
  cta: 'Book your consult — link in bio.',
  hashtags: ['HairBySha', 'CamberwellHair', 'MelbourneHairdresser', 'BalayageMelbourne'],
};

const goodPost = (over = {}) => ({
  id: 'p1',
  format: 'contrast_hook',
  mediaType: 'REELS',
  caption: goodCaption,
  media: [{ url: 'https://example.com/clip.mp4', kind: 'video', origin: 'real' }],
  status: POST_STATUS.DRAFTED,
  ...over,
});

// ---------------------------------------------------------------------------
describe('coordinator', () => {
  test('resolves a valid order from requires/produces', () => {
    const order = resolveOrder(AGENTS).map((a) => a.name);
    assert.equal(order.length, AGENTS.length);
    assert.ok(order.indexOf('Scout') > order.indexOf('Analyst'));
    assert.ok(order.indexOf('Producer') > order.indexOf('Scout'));
    assert.ok(order.indexOf('Producer') > order.indexOf('Librarian'));
    assert.ok(order.indexOf('Critic') > order.indexOf('Producer'));
    assert.ok(order.indexOf('Publisher') > order.indexOf('Critic'));
  });

  test('the retired Editor stage is not in the pipeline', () => {
    assert.equal(AGENTS.find((a) => a.name === 'Editor'), undefined);
  });

  test('rejects an unsatisfiable requirement', () => {
    const bad = [{ name: 'X', requires: ['ghost'], produces: ['y'], run: async () => ({ y: 1 }) }];
    assert.throws(() => resolveOrder(bad), /requires "ghost"/);
  });

  test('rejects two agents producing the same capability', () => {
    const bad = [
      { name: 'A', requires: [], produces: ['dup'], run: async () => ({ dup: 1 }) },
      { name: 'B', requires: [], produces: ['dup'], run: async () => ({ dup: 2 }) },
    ];
    assert.throws(() => resolveOrder(bad), /produced by both/);
  });

  test('detects a cycle', () => {
    const bad = [
      { name: 'A', requires: ['b'], produces: ['a'], run: async () => ({ a: 1 }) },
      { name: 'B', requires: ['a'], produces: ['b'], run: async () => ({ b: 1 }) },
    ];
    assert.throws(() => resolveOrder(bad), /Cycle in agent graph/);
  });

  test('halts the run when an agent throws, and reports where', async () => {
    const agents = [
      { name: 'A', requires: [], produces: ['a'], run: async () => ({ a: 1 }) },
      {
        name: 'B',
        requires: ['a'],
        produces: ['b'],
        run: async () => {
          throw new Error('boom');
        },
      },
    ];
    await assert.rejects(() => runPipeline(agents, {}), /B failed: boom/);
  });

  test('rejects an agent that does not return what it declared', async () => {
    const agents = [{ name: 'A', requires: [], produces: ['a'], run: async () => ({}) }];
    await assert.rejects(() => runPipeline(agents, {}), /declared "a" but did not return it/);
  });
});

// ---------------------------------------------------------------------------
describe('Critic — hashtag integrity', () => {
  test('blocks bare hashtags, the defect found live on the account', () => {
    // Exactly the pattern from the real feed: first tags carry "#", the rest lost it.
    const post = goodPost({
      caption: {
        ...goodCaption,
        body: 'Blonde refresh after 10 weeks. GlenIris KewHair BalwynHair SurreyHills',
      },
    });
    const { passed, violations } = critique(post);
    assert.equal(passed, false);
    const v = violations.find((x) => x.rule === 'BARE_HASHTAG');
    assert.ok(v, 'expected BARE_HASHTAG');
    assert.match(v.message, /GlenIris/);
  });

  test('passes normal prose with capitalised place names', () => {
    const post = goodPost({
      caption: { ...goodCaption, body: 'A quiet afternoon slot in Camberwell, Melbourne.' },
    });
    assert.equal(critique(post).passed, true);
  });

  test('blocks malformed hashtags', () => {
    const post = goodPost({
      caption: { ...goodCaption, hashtags: ['HairBySha', 'bad tag!', 'CamberwellHair', 'MelbHair'] },
    });
    const v = critique(post).violations.find((x) => x.rule === 'MALFORMED_HASHTAG');
    assert.ok(v);
  });

  test('blocks too few hashtags and warns on duplicates', () => {
    assert.ok(
      critique(goodPost({ caption: { ...goodCaption, hashtags: ['HairBySha'] } })).violations.find(
        (v) => v.rule === 'TOO_FEW_HASHTAGS',
      ),
    );
    const dup = critique(
      goodPost({
        caption: {
          ...goodCaption,
          hashtags: ['HairBySha', 'CamberwellHair', 'camberwellhair', 'MelbourneHair'],
        },
      }),
    );
    assert.ok(dup.violations.find((v) => v.rule === 'DUPLICATE_HASHTAG'));
    assert.equal(dup.passed, true, 'duplicates warn, they do not block');
  });

  test('buildHashtags never emits a bare or duplicated tag', () => {
    for (let seed = 0; seed < 8; seed += 1) {
      const tags = buildHashtags({ seed });
      assert.equal(new Set(tags).size, tags.length, 'no duplicates');
      assert.ok(tags.length >= 3 && tags.length <= 30);
      for (const tag of tags) assert.match(tag, /^[A-Za-z0-9_]+$/);
    }
  });
});

describe('Critic — draft artifacts', () => {
  test('blocks the exact leftover that shipped on the live top post', () => {
    const post = goodPost({
      caption: {
        ...goodCaption,
        body: 'Dimension, restored.\n\nAlt caption (shorter, quieter tone)\n\nSame base.',
      },
    });
    const { passed, violations } = critique(post);
    assert.equal(passed, false);
    assert.ok(violations.find((v) => v.rule === 'DRAFT_ARTIFACT'));
  });

  test('blocks other drafting leftovers', () => {
    for (const leak of [
      'Option A: go brighter',
      '[insert client name] loved it',
      'Version 2 of this caption',
      'TODO write hook',
      'As an AI language model, here is a caption',
      '{{client_name}} came in today',
    ]) {
      const post = goodPost({ caption: { ...goodCaption, body: leak } });
      assert.ok(
        critique(post).violations.find((v) => v.rule === 'DRAFT_ARTIFACT'),
        `expected DRAFT_ARTIFACT for: ${leak}`,
      );
    }
  });
});

describe('Critic — conversion, media and authenticity', () => {
  test('blocks a caption with no booking CTA', () => {
    const post = goodPost({ caption: { ...goodCaption, cta: 'Hope you like it!' , body: 'Nice hair.' } });
    assert.ok(critique(post).violations.find((v) => v.rule === 'NO_CTA'));
  });

  test('blocks non-HTTPS and missing media', () => {
    assert.ok(
      critique(goodPost({ media: [{ url: 'http://x.com/a.jpg' }] })).violations.find(
        (v) => v.rule === 'MEDIA_NOT_HTTPS',
      ),
    );
    assert.ok(critique(goodPost({ media: [] })).violations.find((v) => v.rule === 'NO_MEDIA'));
  });

  test('blocks a carousel outside 2-10 items', () => {
    const post = goodPost({
      mediaType: 'CAROUSEL',
      media: [{ url: 'https://x.com/a.jpg', kind: 'image' }],
    });
    assert.ok(critique(post).violations.find((v) => v.rule === 'CAROUSEL_SIZE'));
  });

  test('blocks AI imagery presented as a real client result', () => {
    const post = goodPost({
      media: [{ url: 'https://x.com/a.jpg', kind: 'image', origin: 'ai', depicts: 'client_result' }],
    });
    assert.ok(critique(post).violations.find((v) => v.rule === 'AI_RESULT_IMAGERY'));
  });

  test('allows AI imagery for a title card', () => {
    const post = goodPost({
      mediaType: 'IMAGE',
      media: [{ url: 'https://x.com/card.jpg', kind: 'image', origin: 'ai', depicts: 'title_card' }],
    });
    assert.equal(critique(post).passed, true);
  });

  test('blocks a caption over the 2200 character limit', () => {
    const post = goodPost({ caption: { ...goodCaption, body: 'x'.repeat(2300) } });
    assert.ok(critique(post).violations.find((v) => v.rule === 'CAPTION_TOO_LONG'));
  });

  test('runCritic marks passing posts awaiting approval and failing ones blocked', async () => {
    const { gated } = await runCritic({
      drafts: [goodPost(), goodPost({ id: 'p2', media: [] })],
    });
    assert.equal(gated[0].status, POST_STATUS.AWAITING_APPROVAL);
    assert.equal(gated[1].status, POST_STATUS.BLOCKED);
  });

  test('runCritic blocks media the platform cannot fetch', async () => {
    const platform = { verifyMediaUrl: async () => ({ ok: false, reason: 'HTTP 404' }) };
    const { gated } = await runCritic({ drafts: [goodPost()], platform });
    assert.equal(gated[0].status, POST_STATUS.BLOCKED);
    assert.ok(gated[0].gate.violations.find((v) => v.rule === 'MEDIA_UNFETCHABLE'));
  });
});

// ---------------------------------------------------------------------------
describe('the approval invariant', () => {
  let store;
  beforeEach(() => {
    store = freshStore();
  });

  test('Publisher queues without publishing anything', async () => {
    const post = store.addPost(goodPost({ gate: { passed: true, violations: [] } }));
    const { queued } = await runPublisher({ gated: [post], store });
    assert.equal(queued.length, 1);
    assert.equal(queued[0].status, POST_STATUS.AWAITING_APPROVAL);
    assert.equal(queued[0].approval.approvedAt, null);
    assert.ok(queued[0].approval.token);
  });

  test('Publisher refuses to queue a post the Critic blocked', async () => {
    const post = store.addPost(goodPost({ gate: { passed: false, violations: [] } }));
    const { queued } = await runPublisher({ gated: [post], store });
    assert.equal(queued.length, 0);
  });

  test('the adapter refuses to publish anything not approved', async () => {
    const ig = new InstagramComposio({ apiKey: 'k', fetchImpl: async () => {
      throw new Error('network must never be reached');
    } });
    for (const status of ['drafted', 'awaiting_approval', 'blocked', 'rejected']) {
      await assert.rejects(
        () => ig.publish(goodPost({ status })),
        /not approved by Sha/,
        `status "${status}" must not publish`,
      );
    }
  });

  test('an approved-looking post with no approval timestamp still cannot publish', async () => {
    const ig = new InstagramComposio({ apiKey: 'k', fetchImpl: async () => {
      throw new Error('network must never be reached');
    } });
    await assert.rejects(
      () => ig.publish(goodPost({ status: 'approved', approval: { approvedAt: null } })),
      /not approved by Sha/,
    );
  });

  test('approvePost is the only path to APPROVED, and rejects a bad token', () => {
    const post = store.addPost(
      goodPost({ status: POST_STATUS.AWAITING_APPROVAL, approval: { token: 'secret' } }),
    );
    assert.throws(() => approvePost(store, post.id, { token: 'wrong' }), /Invalid approval token/);
    const approved = approvePost(store, post.id, { token: 'secret' });
    assert.equal(approved.status, POST_STATUS.APPROVED);
    assert.ok(approved.approval.approvedAt);
  });

  test('a post cannot be approved twice', () => {
    const post = store.addPost(goodPost({ status: POST_STATUS.AWAITING_APPROVAL, approval: {} }));
    approvePost(store, post.id);
    assert.throws(() => approvePost(store, post.id), /not awaiting approval/);
  });

  test('rejected posts never publish', async () => {
    const post = store.addPost(goodPost({ status: POST_STATUS.AWAITING_APPROVAL, approval: {} }));
    rejectPost(store, post.id, { reason: 'wrong client' });
    const published = [];
    await publishApproved(store, { publish: async (p) => published.push(p.id) });
    assert.deepEqual(published, []);
  });

  test('publishApproved only publishes approved posts whose slot has arrived', async () => {
    const past = store.addPost(
      goodPost({
        status: POST_STATUS.APPROVED,
        slot: new Date(Date.now() - 3600e3).toISOString(),
        approval: { approvedAt: new Date().toISOString() },
      }),
    );
    store.addPost(
      goodPost({
        status: POST_STATUS.APPROVED,
        slot: new Date(Date.now() + 86400e3).toISOString(),
        approval: { approvedAt: new Date().toISOString() },
      }),
    );
    store.addPost(goodPost({ status: POST_STATUS.AWAITING_APPROVAL }));

    const seen = [];
    const results = await publishApproved(store, {
      publish: async (p) => {
        seen.push(p.id);
        return { mediaId: '123', permalink: 'https://instagram.com/p/x', containerId: 'c' };
      },
    });

    assert.deepEqual(seen, [past.id], 'only the due, approved post');
    assert.equal(results[0].ok, true);
    assert.equal(store.getPost(past.id).status, POST_STATUS.PUBLISHED);
  });

  test('a failed publish stays approved so the next run retries', async () => {
    const post = store.addPost(
      goodPost({
        status: POST_STATUS.APPROVED,
        approval: { approvedAt: new Date().toISOString() },
      }),
    );
    const results = await publishApproved(store, {
      publish: async () => {
        throw new Error('Meta 500');
      },
    });
    assert.equal(results[0].ok, false);
    assert.equal(store.getPost(post.id).status, POST_STATUS.APPROVED);
    assert.match(store.getPost(post.id).publish.error, /Meta 500/);
  });
});

// ---------------------------------------------------------------------------
describe('Composio adapter', () => {
  const okResponse = (data) => ({
    ok: true,
    status: 200,
    json: async () => ({ data, error: null, successful: true }),
  });

  test('calls the v3 execute endpoint with the api key header', async () => {
    const calls = [];
    const ig = new InstagramComposio({
      apiKey: 'test-key',
      connectedAccountId: 'instagram_x',
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return okResponse({ id: '1', account_type: 'BUSINESS', username: 'hairbysha_c' });
      },
    });
    const info = await ig.getAccountInfo();

    assert.match(calls[0].url, /\/api\/v3\/tools\/execute\/INSTAGRAM_GET_USER_INFO$/);
    assert.equal(calls[0].init.headers['x-api-key'], 'test-key');
    assert.equal(JSON.parse(calls[0].init.body).connected_account_id, 'instagram_x');
    assert.equal(info.canPublish, true);
  });

  test('reports a personal account as unable to publish', async () => {
    const ig = new InstagramComposio({
      apiKey: 'k',
      fetchImpl: async () => okResponse({ id: '1', account_type: 'PERSONAL' }),
    });
    assert.equal((await ig.getAccountInfo()).canPublish, false);
  });

  test('surfaces a Composio error rather than continuing', async () => {
    const ig = new InstagramComposio({
      apiKey: 'k',
      fetchImpl: async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'bad media url' }, successful: false }),
      }),
    });
    await assert.rejects(() => ig.getAccountInfo(), /bad media url/);
  });

  test('parses the quota list shape', async () => {
    const ig = new InstagramComposio({
      apiKey: 'k',
      fetchImpl: async () => okResponse({ data: [{ config: { quota_total: 100 }, quota_usage: 4 }] }),
    });
    assert.deepEqual(await ig.getPublishingQuota(), { used: 4, total: 100, remaining: 96 });
  });

  test('refuses to publish when quota is exhausted', async () => {
    const ig = new InstagramComposio({
      apiKey: 'k',
      fetchImpl: async () => okResponse({ data: [{ config: { quota_total: 25 }, quota_usage: 25 }] }),
    });
    await assert.rejects(
      () =>
        ig.publish(
          goodPost({ status: 'approved', approval: { approvedAt: new Date().toISOString() } }),
        ),
      /quota exhausted/,
    );
  });

  test('verifyMediaUrl rejects non-HTTPS, wrong content type and errors', async () => {
    const ig = new InstagramComposio({ apiKey: 'k', fetchImpl: async () => okResponse({}) });
    assert.equal((await ig.verifyMediaUrl('http://x.com/a.jpg')).ok, false);

    const html = new InstagramComposio({
      apiKey: 'k',
      fetchImpl: async () => ({ ok: true, headers: new Map([['content-type', 'text/html']]), status: 200 }),
    });
    const res = await html.verifyMediaUrl('https://x.com/share');
    assert.equal(res.ok, false);
    assert.match(res.reason, /text\/html/);
  });

  test('creates a container then publishes, in that order', async () => {
    const slugs = [];
    const ig = new InstagramComposio({
      apiKey: 'k',
      fetchImpl: async (url) => {
        const slug = url.split('/').pop();
        slugs.push(slug);
        if (slug === 'INSTAGRAM_GET_IG_USER_CONTENT_PUBLISHING_LIMIT') {
          return okResponse({ data: [{ config: { quota_total: 100 }, quota_usage: 0 }] });
        }
        if (slug === 'INSTAGRAM_POST_IG_USER_MEDIA') return okResponse({ id: 'container-1' });
        if (slug === 'INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH') return okResponse({ id: 'media-9' });
        return okResponse({ permalink: 'https://instagram.com/reel/abc' });
      },
    });

    const result = await ig.publish(
      goodPost({ status: 'approved', approval: { approvedAt: new Date().toISOString() } }),
    );

    assert.deepEqual(slugs.slice(0, 3), [
      'INSTAGRAM_GET_IG_USER_CONTENT_PUBLISHING_LIMIT',
      'INSTAGRAM_POST_IG_USER_MEDIA',
      'INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH',
    ]);
    assert.equal(result.mediaId, 'media-9');
    assert.equal(result.permalink, 'https://instagram.com/reel/abc');
  });

  test('renderCaption prefixes every hashtag', () => {
    const out = renderCaption({ body: 'B', cta: 'C', hashtags: ['One', '#Two'] });
    assert.match(out, /#One #Two/);
    assert.doesNotMatch(out, /(?:^|\s)One(?:\s|$)/);
  });
});

// ---------------------------------------------------------------------------
describe('Scout', () => {
  test('ranks every format and returns them sorted', () => {
    const ranked = scoreFormats({});
    assert.equal(ranked.length, FORMAT_LIBRARY.length);
    for (let i = 1; i < ranked.length; i += 1) {
      assert.ok(ranked[i - 1].score >= ranked[i].score);
    }
  });

  test('promotes a format that outperformed on her own account', () => {
    const insights = [
      { format: 'education_myth', score: 40 },
      { format: 'product_feature', score: 4 },
    ];
    const ranked = scoreFormats({ insights });
    const myth = ranked.find((f) => f.id === 'education_myth');
    const product = ranked.find((f) => f.id === 'product_feature');
    assert.ok(myth.score > myth.baseScore);
    assert.ok(product.score < product.baseScore);
  });

  test('applies a cooldown to a format used days ago', () => {
    const now = new Date('2026-08-11T00:00:00Z');
    const ranked = scoreFormats({
      recentFormats: [{ format: 'transformation_reveal', postedAt: '2026-08-10T00:00:00Z' }],
      now,
    });
    const format = ranked.find((f) => f.id === 'transformation_reveal');
    assert.ok(format.score < format.baseScore);
    assert.ok(format.reasons.some((r) => /cooldown/.test(r)));
  });

  test('every format in the library declares hooks and a shot list', () => {
    for (const format of FORMAT_LIBRARY) {
      assert.ok(format.hooks.length > 0, `${format.id} needs hooks`);
      assert.ok(format.shotList.length > 0, `${format.id} needs a shot list`);
      assert.ok(['REELS', 'IMAGE', 'CAROUSEL'].includes(format.mediaType));
    }
  });
});

// ---------------------------------------------------------------------------
describe('Producer', () => {
  test('every drafted caption passes the Critic', () => {
    for (const format of FORMAT_LIBRARY) {
      for (let i = 0; i < 4; i += 1) {
        const caption = draftCaption(format, { index: i });
        const post = goodPost({ caption, mediaType: format.mediaType === 'CAROUSEL' ? 'REELS' : format.mediaType });
        const { passed, violations } = critique(post);
        assert.equal(
          passed,
          true,
          `${format.id}#${i} failed: ${violations.map((v) => `${v.rule} ${v.message}`).join('; ')}`,
        );
      }
    }
  });

  test('schedules the requested cadence into the future', async () => {
    const now = new Date('2026-08-11T09:00:00Z');
    const library = Array.from({ length: 5 }, (_, i) => ({
      id: `a${i}`,
      mediaType: 'REELS',
      media: [{ url: `https://example.com/${i}.mp4`, kind: 'video', origin: 'real' }],
    }));
    const { drafts, brief } = await runProducer({
      formatRanking: scoreFormats({}),
      library,
      cadence: 3,
      now,
    });
    assert.equal(brief.cadence, 3);
    assert.equal(brief.shootList.length, 3);
    for (const post of drafts) assert.ok(new Date(post.slot) > now);
  });

  test('a slot with no media becomes a filming instruction, not a draft', async () => {
    const { drafts, brief } = await runProducer({
      formatRanking: scoreFormats({}),
      library: [],
      cadence: 3,
    });
    assert.equal(drafts.length, 0);
    assert.equal(brief.needsFilming, 3);
    assert.ok(brief.shootList.every((s) => s.status === 'NEEDS FILMING'));
  });
});

// ---------------------------------------------------------------------------
describe('Analyst', () => {
  test('weights saves and shares above likes', () => {
    const likes = scorePost({ id: '1', like_count: 10 }, { followers: 100 });
    const saves = scorePost({ id: '2', saved_count: 10 }, { followers: 100 });
    assert.ok(saves.score > likes.score);
  });

  test('scores relative to followers, not raw counts', () => {
    const small = scorePost({ id: '1', like_count: 40 }, { followers: 172 });
    const big = scorePost({ id: '2', like_count: 40 }, { followers: 100000 });
    assert.ok(small.engagementRate > big.engagementRate);
  });

  test('tolerates missing metric fields', () => {
    const s = scorePost({ id: '1' }, { followers: 10 });
    assert.equal(s.weighted, 0);
    assert.equal(Number.isFinite(s.score), true);
  });

  test('audits live captions for both known defects', () => {
    const findings = auditPublishedCaptions([
      { id: '1', caption: '#CamberwellHair GlenIris KewHair BalwynHair' },
      { id: '2', caption: 'Dimension, restored.\n\nAlt caption (shorter, quieter tone)' },
      { id: '3', caption: 'Clean caption. #HairBySha #CamberwellHair' },
    ]);
    assert.equal(findings.length, 2);
    assert.deepEqual(findings[0].bareHashtags, ['GlenIris', 'KewHair', 'BalwynHair']);
    assert.match(findings[1].draftArtifact, /Alt caption/i);
  });
});

// ---------------------------------------------------------------------------
describe('Librarian', () => {
  test('classifies media by extension', () => {
    assert.equal(classify('a.mp4').mediaType, 'REELS');
    assert.equal(classify('a.jpg').mediaType, 'IMAGE');
    assert.equal(classify('a.txt'), null);
  });

  test('builds public HTTPS URLs and defaults assets to real client work', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'uploads-'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'reveal.mp4'), 'x');
    writeFileSync(join(dir, 'reveal.json'), JSON.stringify({ format: 'contrast_hook', notes: 'n' }));

    const { library } = await runLibrarian({
      uploadsDir: dir,
      baseUrl: 'https://sha-engine.onrender.com',
    });

    assert.equal(library.length, 1);
    assert.equal(library[0].media[0].url, 'https://sha-engine.onrender.com/media/reveal.mp4');
    assert.equal(library[0].media[0].origin, 'real');
    assert.equal(library[0].format, 'contrast_hook');
  });

  test('refuses to build a media URL with no public base', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'uploads-'));
    writeFileSync(join(dir, 'a.jpg'), 'x');
    await assert.rejects(
      () => runLibrarian({ uploadsDir: dir, baseUrl: undefined }),
      /PUBLIC_BASE_URL/,
    );
  });
});

// ---------------------------------------------------------------------------
describe('full pipeline', () => {
  test('runs end to end and stops at awaiting approval', async () => {
    const store = freshStore();
    const dir = mkdtempSync(join(tmpdir(), 'uploads-'));
    for (let i = 0; i < 3; i += 1) writeFileSync(join(dir, `clip${i}.mp4`), 'x');

    const platform = {
      getAccountInfo: async () => ({ followers: 172, username: 'hairbysha_c' }),
      getRecentMedia: async () => [{ id: 'm1', like_count: 41, caption: 'Clean. #HairBySha' }],
      verifyMediaUrl: async () => ({ ok: true, contentType: 'video/mp4' }),
    };

    process.env.UPLOADS_DIR = dir;
    process.env.PUBLIC_BASE_URL = 'https://sha-engine.onrender.com';

    const result = await runPipeline(AGENTS, { store, platform, cadence: 3 });

    assert.equal(result.trace.every((t) => t.ok), true);
    assert.ok(result.queued.length > 0);
    for (const post of result.queued) {
      assert.equal(post.status, POST_STATUS.AWAITING_APPROVAL);
      assert.equal(post.approval.approvedAt, null);
    }
    assert.equal(
      store.posts((p) => p.status === POST_STATUS.PUBLISHED).length,
      0,
      'the pipeline must never publish on its own',
    );

    delete process.env.UPLOADS_DIR;
    delete process.env.PUBLIC_BASE_URL;
  });
});
