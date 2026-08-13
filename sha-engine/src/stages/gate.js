import { brand, system, capabilities } from '../lib/config.js';
import { voiceViolations } from '../lib/brand.js';
import { makeLogger } from '../lib/log.js';
import * as store from '../lib/store.js';

const log = makeLogger('gate');

/**
 * The stage that stops slop reaching a client.
 *
 * Two tiers. Automated rules catch the mechanical failures — wrong aspect,
 * missing captions, no consent, a near-duplicate of something posted a
 * fortnight ago. Anything that survives goes to Sha as a batch preview, and
 * her rejection reason is fed back into pattern memory so the planner stops
 * producing that kind of slot.
 *
 * Every rule returns a reason a human can act on. "Failed validation" helps
 * nobody at 6pm on a Monday.
 */

export const RULES = [
  {
    id: 'vertical',
    severity: 'blocker',
    check: (post) => post.render?.width && post.render.height >= post.render.width,
    fail: 'Not vertical. Reels and TikTok both need 9:16 or it gets letterboxed into irrelevance.',
  },
  {
    id: 'resolution',
    severity: 'blocker',
    check: (post) => (post.render?.width || 0) >= system.gate.minResolutionWidth,
    fail: (post) => `Only ${post.render?.width}px wide. Below ${system.gate.minResolutionWidth}px looks soft on a phone.`,
  },
  {
    id: 'duration',
    severity: 'blocker',
    check: (post) => {
      const d = post.render?.durationSec || 0;
      return d >= system.video.minSeconds && d <= system.video.hardMaxSeconds;
    },
    fail: (post) => `Runs ${post.render?.durationSec?.toFixed(1)}s. Needs to sit between ${system.video.minSeconds}s and ${system.video.hardMaxSeconds}s.`,
  },
  {
    id: 'captions',
    severity: 'blocker',
    check: (post) => !system.gate.requireCaptions || (post.captions?.length > 0),
    fail: 'No captions burned in. Most of the feed watches on mute.',
  },
  {
    id: 'hook-length',
    severity: 'warning',
    check: (post) => {
      const first = post.captions?.[0];
      return !first || first.start <= system.gate.maxHookSeconds;
    },
    fail: `Hook lands later than ${system.gate.maxHookSeconds}s. The scroll decision is already made by then.`,
  },
  {
    id: 'consent',
    severity: 'blocker',
    check: (post, ctx) => {
      if (!system.gate.requireConsent) return true;
      if (!ctx.consentPolicySet) return false;
      if (brand.consent.policy === 'blanket_at_booking') return true;
      return (post.clipIds || []).every((id) => {
        const clip = ctx.clips.find((c) => c.id === id);
        return clip?.consent === true;
      });
    },
    fail: (post, ctx) => ctx.consentPolicySet
      ? 'A clip in this post has no recorded client consent.'
      : 'No consent policy configured yet — set brand.consent.policy before anything with a client in it ships.',
  },
  {
    id: 'booking-url',
    severity: 'blocker',
    check: (post, ctx) => !post.caption?.cta || ctx.bookingUrlSet,
    fail: 'The call to action points at a booking link that has not been set.',
  },
  {
    id: 'not-duplicate',
    severity: 'blocker',
    check: (post, ctx) => {
      const cutoff = Date.now() - system.gate.duplicateWindowDays * 86400000;
      const recent = ctx.posts.filter(
        (p) => p.id !== post.id && p.publishedAt && new Date(p.publishedAt).getTime() > cutoff
      );
      return !recent.some(
        (p) => p.formatId === post.formatId && overlapRatio(p.clipIds, post.clipIds) > system.gate.duplicateSimilarityThreshold
      );
    },
    fail: `Too close to something posted in the last ${system.gate.duplicateWindowDays} days.`,
  },
  {
    id: 'voice',
    severity: 'warning',
    // Delegates to brand.voiceViolations, which matches on word boundaries.
    // A bare substring test flagged any caption containing "water", "later" or
    // "generate", because "ate" is on the avoid list.
    check: (post) => voiceViolations(voiceText(post)).length === 0,
    fail: (post) => {
      const [first] = voiceViolations(voiceText(post));
      return `Caption uses "${first.term}" — ${first.why}.`;
    },
  },
  {
    // Found live on the account: every published caption lost its "#" after the
    // fifth tag, so the rest published as plain words reaching nobody. A
    // CamelCase run sitting loose in the text is an unhashed hashtag, not prose.
    id: 'bare-hashtag',
    severity: 'blocker',
    check: (post) => bareTags(post).length === 0,
    fail: (post) => {
      const bare = bareTags(post);
      return `${bare.length} hashtag(s) lost their "#" and will reach nobody: ${bare.slice(0, 6).join(', ')}`;
    },
  },
  {
    // Found live on the account: her best-performing post published with the
    // literal text "Alt caption (shorter, quieter tone)" in it.
    id: 'draft-artifact',
    severity: 'blocker',
    check: (post) => !draftArtifact(post),
    fail: (post) => `Drafting leftover in the caption: "${draftArtifact(post)}"`,
  },
  {
    id: 'hashtag-count',
    severity: 'warning',
    check: (post) => {
      const n = (post.caption?.hashtags || []).length;
      const { min, max } = brand.voice.hashtagCount;
      return n === 0 || (n >= min && n <= max);
    },
    fail: (post) => {
      const n = (post.caption?.hashtags || []).length;
      const { min, max } = brand.voice.hashtagCount;
      return `${n} hashtags — brand config asks for ${min}-${max}.`;
    },
  },
  {
    id: 'cta-frequency',
    severity: 'warning',
    check: (post, ctx) => {
      if (post.type !== 'offer') return true;
      const recent = ctx.posts.filter((p) => p.publishedAt).slice(-10);
      if (recent.length < 5) return true;
      const offers = recent.filter((p) => p.type === 'offer').length;
      return offers / recent.length <= brand.cta.frequencyCap;
    },
    fail: 'Too many offer posts recently. The feed starts reading as an ad channel.',
  },
];

/** Caption text as one string, for the text-level rules. */
function captionText(post) {
  return [post.caption?.hook, post.caption?.body, post.caption?.cta].filter(Boolean).join('\n');
}

/** Caption plus anything burned onto the video — voice applies to both. */
function voiceText(post) {
  return [captionText(post), ...(post.captions || []).map((c) => c.text)].filter(Boolean).join('\n');
}

/** CamelCase runs loose in the text — hashtags that lost their "#". */
const BARE_TAG = /(?:^|\s)((?:[A-Z][a-z0-9]+){2,})(?=\s|$|[.,!?])/g;

export function bareTags(post) {
  return [...captionText(post).matchAll(BARE_TAG)].map((m) => m[1]);
}

/** Scaffolding a drafting tool leaves behind and must never publish. */
const DRAFT_ARTIFACT_PATTERNS = [
  /\balt(?:ernative)?\s+caption\b/i,
  /\boption\s+[a-d]\b/i,
  /\bversion\s+\d\b/i,
  /\b(?:shorter|longer|quieter|punchier)\s+(?:tone|version|option)\b/i,
  /\bdraft\s*\d*\s*:/i,
  /\[(?:insert|your|client|todo|tbd)[^\]]*\]/i,
  /\{\{.*?\}\}/,
  /\{[a-z]+\}/,
  /\blorem ipsum\b/i,
  /\bTODO\b/,
  /\bas an ai\b/i,
  // Cross-platform caption leaks: a caption written for another network,
  // pasted in whole. Live example on /reel/DYMTLSPzFOP/ — "TikTok caption:".
  /\b(?:tiktok|instagram|facebook|reels?)\s+caption\s*:/i,
  // A literal "Hashtags:" label — scaffolding, not something she would write.
  /^\s*hashtags\s*:/im,
];

export function draftArtifact(post) {
  const text = captionText(post);
  for (const pattern of DRAFT_ARTIFACT_PATTERNS) {
    const hit = text.match(pattern);
    if (hit) return hit[0].trim();
  }
  return null;
}

function overlapRatio(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const shared = b.filter((x) => setA.has(x)).length;
  return shared / Math.max(a.length, b.length);
}

export function evaluate(post, ctx) {
  const results = RULES.map((rule) => {
    let passed;
    try {
      passed = Boolean(rule.check(post, ctx));
    } catch {
      passed = false;
    }
    return {
      id: rule.id,
      severity: rule.severity,
      passed,
      reason: passed ? null : (typeof rule.fail === 'function' ? rule.fail(post, ctx) : rule.fail),
    };
  });

  const blockers = results.filter((r) => !r.passed && r.severity === 'blocker');
  const warnings = results.filter((r) => !r.passed && r.severity === 'warning');

  return {
    results,
    blockers,
    warnings,
    verdict: blockers.length ? 'blocked' : warnings.length ? 'needs_review' : 'pass',
  };
}

export async function run() {
  log.start();
  try {
    const caps = capabilities();
    const posts = store.read('posts', []);
    const clips = store.read('footage', []);
    const ctx = { posts, clips, ...caps };

    const pending = posts.filter((p) => p.status === 'cut' || p.status === 'gated');
    if (!pending.length) {
      log.info('nothing waiting at the gate');
      log.done({ checked: 0 });
      return { checked: 0, awaitingApproval: [], blocked: [] };
    }

    const awaitingApproval = [];
    const blocked = [];

    for (const post of pending) {
      const report = evaluate(post, ctx);
      post.gate = { ...report, checkedAt: new Date().toISOString() };
      post.status = report.verdict === 'blocked' ? 'blocked' : 'awaiting_approval';
      store.upsert('posts', post);

      if (report.verdict === 'blocked') {
        blocked.push(post);
        log.warn(`blocked ${post.id}: ${report.blockers.map((b) => b.reason).join(' | ')}`);
      } else {
        awaitingApproval.push(post);
        const w = report.warnings.length ? ` (${report.warnings.length} warning)` : '';
        log.info(`ready for Sha: ${post.id} · ${post.formatName}${w}`);
      }
    }

    log.done({ checked: pending.length, awaitingApproval: awaitingApproval.length, blocked: blocked.length });
    return { checked: pending.length, awaitingApproval, blocked };
  } catch (err) {
    log.fail(err);
    throw err;
  }
}

/** Called from the dashboard when Sha taps approve or reject. */
export function decide(postId, decision, reason = null) {
  const posts = store.read('posts', []);
  const post = posts.find((p) => p.id === postId);
  if (!post) throw new Error(`No post ${postId}`);

  post.status = decision === 'approve' ? 'approved' : 'rejected';
  post.decision = { by: 'sha', decision, reason, at: new Date().toISOString() };
  store.upsert('posts', post);

  // A rejection is training data — demote the format so the planner learns.
  if (decision === 'reject' && post.formatId) {
    store.rememberPattern('formats', post.formatId, -1);
    log.info(`noted rejection of ${post.formatId}${reason ? `: ${reason}` : ''}`);
  }
  return post;
}

export default { run, evaluate, decide, RULES, bareTags, draftArtifact };
