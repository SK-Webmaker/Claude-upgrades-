import { POST_STATUS } from '../lib/store.js';
import { renderCaption } from '../platforms/instagram-composio.js';
import { voiceViolations } from '../lib/brand.js';

/**
 * The Critic.
 *
 * Nothing reaches Sha's review page, and nothing reaches the public, without
 * passing every blocking rule here.
 *
 * Two of these rules exist because both defects were found live on the account:
 *
 *   BARE_HASHTAG   — every published caption lost its "#" after the fifth tag.
 *                    Roughly half of each post's discovery surface was dead text.
 *   DRAFT_ARTIFACT — the top-performing post shipped with the literal words
 *                    "Alt caption (shorter, quieter tone)" in the live caption.
 *
 * Severity: 'block' stops the post. 'warn' is surfaced on the review page but
 * still lets Sha decide.
 */

const MAX_CAPTION = 2200;
const MIN_HASHTAGS = 3;
const MAX_HASHTAGS = 30;

// Leftovers from a drafting tool that must never reach a caption.
const DRAFT_ARTIFACT_PATTERNS = [
  /\balt(?:ernative)?\s+caption\b/i,
  /\boption\s+[a-d]\b/i,
  /\bversion\s+\d\b/i,
  /\b(?:shorter|longer|quieter|punchier)\s+(?:tone|version|option)\b/i,
  /\bdraft\s*\d*\s*:/i,
  /\[(?:insert|your|client|todo|tbd)[^\]]*\]/i,
  /\{\{.*?\}\}/,
  /\blorem ipsum\b/i,
  /\bTODO\b/,
  /\bas an ai\b/i,
];

// A CamelCase run like "MelbourneHairdresser" sitting loose in the text is an
// unhashed hashtag, not prose.
const BARE_TAG = /(?:^|\s)((?:[A-Z][a-z0-9]+){2,})(?=\s|$|[.,!?])/g;

const CTA_PATTERNS = [
  /link in bio/i,
  /\bdm\b/i,
  /book(?:ing|\s+(?:now|online|via|your))/i,
  /https?:\/\//i,
];

export function critique(post) {
  const violations = [];
  const add = (rule, severity, message) => violations.push({ rule, severity, message });

  const caption = post.caption ?? {};
  const body = typeof caption === 'string' ? caption : (caption.body ?? '');
  const cta = typeof caption === 'string' ? '' : (caption.cta ?? '');
  const hashtags = typeof caption === 'string' ? [] : (caption.hashtags ?? []);
  const rendered = renderCaption(caption);

  // --- caption content ---------------------------------------------------
  if (!body.trim()) {
    add('EMPTY_CAPTION', 'block', 'Caption body is empty');
  }

  if (rendered.length > MAX_CAPTION) {
    add(
      'CAPTION_TOO_LONG',
      'block',
      `Caption is ${rendered.length} characters, Instagram allows ${MAX_CAPTION}`,
    );
  }

  for (const pattern of DRAFT_ARTIFACT_PATTERNS) {
    const hit = `${body}\n${cta}`.match(pattern);
    if (hit) {
      add('DRAFT_ARTIFACT', 'block', `Drafting leftover in caption: "${hit[0].trim()}"`);
    }
  }

  // --- hashtag integrity -------------------------------------------------
  const bare = [...`${body}\n${cta}`.matchAll(BARE_TAG)].map((m) => m[1]);
  if (bare.length) {
    add(
      'BARE_HASHTAG',
      'block',
      `${bare.length} hashtag(s) missing their "#" and reaching nobody: ${bare.slice(0, 6).join(', ')}`,
    );
  }

  const malformed = hashtags.filter((t) => !/^#?[A-Za-z0-9_]+$/.test(t));
  if (malformed.length) {
    add('MALFORMED_HASHTAG', 'block', `Invalid hashtag(s): ${malformed.join(', ')}`);
  }

  const normalised = hashtags.map((t) => t.replace(/^#/, '').toLowerCase());
  const dupes = normalised.filter((t, i) => normalised.indexOf(t) !== i);
  if (dupes.length) {
    add('DUPLICATE_HASHTAG', 'warn', `Repeated hashtag(s): ${[...new Set(dupes)].join(', ')}`);
  }

  if (hashtags.length < MIN_HASHTAGS) {
    add('TOO_FEW_HASHTAGS', 'block', `Only ${hashtags.length} hashtags, want at least ${MIN_HASHTAGS}`);
  }
  if (hashtags.length > MAX_HASHTAGS) {
    add('TOO_MANY_HASHTAGS', 'block', `${hashtags.length} hashtags, Instagram caps at ${MAX_HASHTAGS}`);
  }

  // --- brand voice -------------------------------------------------------
  // Her register is understated. Hype language, shouting and emoji rows read as
  // someone else's account and undercut a luxury positioning.
  for (const hit of voiceViolations(`${body}\n${cta}`)) {
    add('OFF_BRAND_VOICE', 'warn', `"${hit.term}" — ${hit.why}`);
  }

  // --- conversion --------------------------------------------------------
  if (!CTA_PATTERNS.some((p) => p.test(`${body} ${cta}`))) {
    add('NO_CTA', 'block', 'No booking call to action — the post cannot convert');
  }

  // --- media -------------------------------------------------------------
  const media = post.media ?? [];
  if (!media.length) {
    add('NO_MEDIA', 'block', 'Post has no media attached');
  }
  for (const item of media) {
    if (!/^https:\/\//i.test(item.url ?? '')) {
      add('MEDIA_NOT_HTTPS', 'block', `Media must be a public HTTPS URL: ${item.url ?? '(missing)'}`);
    }
  }
  if (post.mediaType === 'CAROUSEL' && (media.length < 2 || media.length > 10)) {
    add('CAROUSEL_SIZE', 'block', `Carousels need 2-10 items, got ${media.length}`);
  }

  // --- authenticity ------------------------------------------------------
  // Real client results must be real. AI imagery is fine for title cards, promo
  // graphics, product shots and b-roll, but never as a hair result.
  const fakeResult = media.find((m) => m.origin === 'ai' && m.depicts === 'client_result');
  if (fakeResult) {
    add(
      'AI_RESULT_IMAGERY',
      'block',
      'AI-generated imagery cannot be presented as a real client result',
    );
  }

  const blocking = violations.filter((v) => v.severity === 'block');
  return { passed: blocking.length === 0, violations, blocking };
}

/**
 * Critic stage. Runs every draft through `critique`, plus a live fetch check on
 * media URLs when a platform adapter is available — a URL Meta cannot fetch is
 * the most common publish failure and it is cheap to catch here.
 */
export async function runCritic({ drafts = [], platform = null, store = null }) {
  const gated = [];

  for (const post of drafts) {
    const result = critique(post);
    const violations = [...result.violations];

    if (result.passed && platform) {
      for (const item of post.media ?? []) {
        const expect = post.mediaType === 'REELS' ? 'video' : 'image';
        const check = await platform.verifyMediaUrl(item.url, { expect });
        if (!check.ok) {
          violations.push({ rule: 'MEDIA_UNFETCHABLE', severity: 'block', message: check.reason });
        }
      }
    }

    const blocking = violations.filter((v) => v.severity === 'block');
    const passed = blocking.length === 0;
    const patch = {
      gate: { passed, violations, checkedAt: new Date().toISOString() },
      status: passed ? POST_STATUS.AWAITING_APPROVAL : POST_STATUS.BLOCKED,
    };

    if (store && post.id) store.patchPost(post.id, patch);
    gated.push({ ...post, ...patch });
  }

  return { gated };
}
