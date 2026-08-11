import { randomBytes } from 'node:crypto';
import { POST_STATUS } from '../lib/store.js';

/**
 * The Publisher.
 *
 * Queues gated posts for Sha's review and publishes the ones she taps through.
 *
 * The invariant: nothing becomes public without her explicit approval. It is
 * enforced in three places, deliberately —
 *   1. here, when moving a post to the publish path
 *   2. in `publishApproved`, which only ever selects APPROVED posts
 *   3. inside the adapter's `publish`, which re-checks before calling Instagram
 * Any one of them alone would be a single point of failure.
 */

/**
 * Publisher stage. Takes gated posts and puts the passing ones into the review
 * queue with an approval token. It publishes nothing itself — publishing happens
 * only after Sha taps, via `publishApproved`.
 */
export async function runPublisher({ gated = [], store = null }) {
  const queued = [];

  for (const post of gated) {
    if (!post.gate?.passed) continue;

    const patch = {
      status: POST_STATUS.AWAITING_APPROVAL,
      approval: {
        token: randomBytes(16).toString('hex'),
        requestedAt: new Date().toISOString(),
        approvedAt: null,
        approvedBy: null,
      },
    };

    if (store && post.id) store.patchPost(post.id, patch);
    queued.push({ ...post, ...patch });
  }

  return { queued };
}

/** Records Sha's tap. This is the only way a post becomes publishable. */
export function approvePost(store, postId, { by = 'sha', token = null } = {}) {
  const post = store.getPost(postId);
  if (!post) throw new Error(`No such post: ${postId}`);
  if (post.status !== POST_STATUS.AWAITING_APPROVAL) {
    throw new Error(`Post ${postId} is "${post.status}", not awaiting approval`);
  }
  if (token && post.approval?.token && token !== post.approval.token) {
    throw new Error('Invalid approval token');
  }

  return store.patchPost(postId, {
    status: POST_STATUS.APPROVED,
    approval: { ...post.approval, approvedAt: new Date().toISOString(), approvedBy: by },
  });
}

export function rejectPost(store, postId, { reason = null } = {}) {
  const post = store.getPost(postId);
  if (!post) throw new Error(`No such post: ${postId}`);
  return store.patchPost(postId, {
    status: POST_STATUS.REJECTED,
    rejection: { reason, rejectedAt: new Date().toISOString() },
  });
}

/**
 * Publishes approved posts whose scheduled slot has arrived.
 *
 * Run from the cron. A post with no slot publishes as soon as it is approved;
 * a post with a future slot waits for it.
 */
export async function publishApproved(store, platform, { now = new Date() } = {}) {
  const due = store.posts(
    (p) =>
      p.status === POST_STATUS.APPROVED &&
      p.approval?.approvedAt &&
      (!p.slot || new Date(p.slot) <= now),
  );

  const results = [];

  for (const post of due) {
    try {
      const result = await platform.publish(post);
      store.patchPost(post.id, { status: POST_STATUS.PUBLISHED, publish: result });
      results.push({ id: post.id, ok: true, permalink: result.permalink });
    } catch (err) {
      // Leave the post APPROVED so the next cron run retries it. A transient
      // Meta error should not need Sha to approve the same post twice.
      store.patchPost(post.id, {
        publish: { error: err.message, failedAt: new Date().toISOString() },
      });
      results.push({ id: post.id, ok: false, error: err.message });
    }
  }

  return results;
}
