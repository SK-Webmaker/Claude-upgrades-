import { browseFor, accountsFor } from './references.js';

/**
 * The complete guide for one post.
 *
 * Sha films and edits natively, so the brief has to be precise enough to act on
 * without anyone explaining it: what to say, what to point the camera at, how
 * long each shot runs, what to type, when to post, and what to do in the half
 * hour after it goes live.
 *
 * Everything here is instruction, not automation. The engine's job is to remove
 * every decision except the ones only she can make.
 */

/** Shot durations that add up to a Reel in the performing range. */
const TIMING = {
  hookSeconds: 2,
  targetSeconds: 24,
  minSeconds: 15,
  maxSeconds: 30,
};

/**
 * Best posting slots, Melbourne time.
 *
 * These are starting positions, not claims about her audience. The Analyst
 * overwrites them once there is enough published history to see what actually
 * lands, which is why they are labelled as defaults.
 */
export const DEFAULT_SLOTS = {
  source: 'default',
  weekday: ['07:30', '12:15', '18:45'],
  weekend: ['09:00', '11:30', '19:00'],
};

/** Distributes a format's shot list across a target runtime. */
export function buildShotPlan(format, { targetSeconds = TIMING.targetSeconds } = {}) {
  const shots = format.shotList ?? [];
  if (!shots.length) return [];

  // The hook shot is fixed and short; the rest split what remains.
  const remaining = Math.max(targetSeconds - TIMING.hookSeconds, shots.length - 1);
  const per = remaining / Math.max(shots.length - 1, 1);

  return shots.map((shot, i) => ({
    n: i + 1,
    direction: shot,
    seconds: i === 0 ? TIMING.hookSeconds : Number(per.toFixed(1)),
    role: i === 0 ? 'hook — this decides the whole post' : i === shots.length - 1 ? 'payoff' : 'build',
  }));
}

/** Audio guidance. Trending audio has to be added in-app at post time. */
export function audioGuidance(format) {
  const spoken = ['education_myth', 'price_transparency', 'client_reaction'].includes(format.id);
  return spoken
    ? {
        type: 'your voice',
        how: 'Talk to camera. Record in a quiet moment — the salon dryer will bury you.',
        note: 'Add a quiet trending track underneath in-app, volume low enough that your voice stays clear.',
      }
    : {
        type: 'trending audio',
        how: 'Pick the track in the Instagram app when you post, not before. Tap the audio name on a reel you like to find it.',
        note: 'Trending audio measurably lifts reach, and it can only be added in-app — this is one reason to post these by hand rather than let the engine publish them.',
      };
}

/** What to do once it is live. Cheap, and it is where small accounts win. */
export const AFTER_POSTING = [
  'Reply to every comment in the first 30 minutes — this window matters more than anything you do later.',
  'Share the post to your story with a "book now" sticker pointing at the link.',
  'If someone DMs asking about price, answer with the price. Dodging it loses the booking.',
  'Do not delete and repost if it starts slow. It resets the post and you lose the early signal.',
];

/**
 * Builds the full playbook for one briefed slot.
 */
export function buildPlaybook(format, { caption, slot = null, index = 0, asset = null } = {}) {
  const shots = buildShotPlan(format);
  const total = shots.reduce((a, s) => a + s.seconds, 0);

  // Prefer the caption's already-filled hook. Reading the raw template would put
  // an unresolved "{n}" in front of Sha as the line to say on camera.
  const hook = caption.filledHook ?? format.hooks[index % format.hooks.length];

  return {
    format: format.id,
    label: format.label,
    whyThisWeek: format.why,
    reasons: format.reasons ?? [],

    hook: {
      say: hook,
      onScreen: hook.length > 42 ? `${hook.slice(0, 39)}…` : hook,
      rule: 'On screen within the first second. If someone reads only this, it still has to make them stop.',
    },

    shots,
    runtime: {
      targetSeconds: Number(total.toFixed(1)),
      acceptableRange: [TIMING.minSeconds, TIMING.maxSeconds],
      note: 'Under 30 seconds performs best. Cut the middle, never the payoff.',
    },

    framing: {
      orientation: 'Vertical, 9:16. Film in the Instagram camera or your phone camera at 4K — never screen-record.',
      light: 'Face the window. Overhead salon light alone makes blonde look yellow on camera.',
      stability: 'Prop the phone. Handheld shake reads as amateur even when the hair is perfect.',
    },

    audio: audioGuidance(format),

    caption: {
      body: caption.body,
      cta: caption.cta,
      hashtags: caption.hashtags.map((t) => `#${String(t).replace(/^#/, '')}`),
      pasteReady: [
        caption.body,
        caption.cta,
        caption.hashtags.map((t) => `#${String(t).replace(/^#/, '')}`).join(' '),
      ].join('\n\n'),
      rule: 'Paste exactly. Every hashtag needs its "#" — a tag without one is invisible.',
    },

    posting: {
      slot,
      slotSource: DEFAULT_SLOTS.source,
      locationTag: 'Tag the salon location. Local discovery depends on it.',
      alsoPostTo: 'Same file to TikTok and Facebook afterwards — caption copies across unchanged.',
    },

    afterPosting: AFTER_POSTING,

    study: {
      accounts: accountsFor(format.id),
      browse: browseFor(format.id),
      how: 'Watch three before you film. Look at how the first two seconds are built, not at the hair.',
    },

    consent:
      format.mediaOrigin === 'real'
        ? 'Get the client’s verbal OK before filming, and again before posting their face.'
        : null,

    mediaReady: Boolean(asset),
  };
}
