import { brand, system } from '../lib/config.js';
import { makeLogger } from '../lib/log.js';
import * as store from '../lib/store.js';
import { rankFormats, CRAFT_RULES } from './scout.js';
import { allocateMix, scheduleSlots, resolveHook } from './plan.js';

const log = makeLogger('brief');

/**
 * Write the week's shoot brief.
 *
 * This replaces the cut stage. The engine no longer renders video, because
 * moving footage off a phone onto a machine proved to be the thing that
 * actually broke the workflow. Instead it produces instructions precise enough
 * that Sha can film and post natively from her phone in a few minutes, with a
 * reference video to watch first.
 *
 * Photo posts are the exception and stay fully automated: images are small
 * enough to send without friction, and both platforms accept photo posts
 * through their APIs, so those still go through the approval-then-publish path.
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Caption written for the post, ready to paste. */
function writeCaption(format, scheduledFor) {
  const tags = [...brand.voice.coreHashtags].slice(0, brand.voice.hashtagCount.max);
  const hook = resolveHook(format.hook, { scheduledFor });
  return {
    hook,
    // Audience-facing copy only. `format.why` is internal ranking rationale —
    // wiring it in here published "capped at 15% of slots so the feed never
    // reads as an ad channel" straight to her followers.
    body: format.says ?? '',
    cta: brand.cta.primary,
    bookingUrl: brand.business.bookingUrl,
    hashtags: tags,
    full: [hook, format.says, `${brand.cta.primary}\n${brand.business.bookingUrl}`, tags.join(' ')]
      .filter(Boolean)
      .join('\n\n'),
  };
}

export async function run({ weekOf = null, force = false } = {}) {
  log.start();
  try {
    // An authored plan wins.
    //
    // When someone has actually read the account and written this week's slots
    // — via POST /api/plan — regenerating would silently replace that judgement
    // with the default rotation. The generator is the fallback, not the
    // authority. Pass force to override deliberately.
    const existing = store.read('plan', null);
    const thisWeek = (weekOf ? new Date(weekOf) : startOfWeek()).toISOString().slice(0, 10);
    if (!force && existing?.authoredBy && existing.weekOf === thisWeek && existing.slots?.length) {
      log.info(`keeping the authored plan for ${thisWeek} (${existing.slots.length} slots, by ${existing.authoredBy})`);
      log.done({ slots: existing.slots.length, authored: true });
      return existing;
    }

    const memory = store.recallPatterns();
    const formats = rankFormats(memory);
    const weekStart = weekOf ? new Date(weekOf) : startOfWeek();
    const total = system.cadence.postsPerWeek;

    const allocation = allocateMix(total, system.mix);
    const times = scheduleSlots(total, weekStart);
    log.info(`allocating ${total} slots: ${Object.entries(allocation).map(([k, v]) => `${k} ${v}`).join(', ')}`);

    const slots = [];
    let ti = 0;

    for (const [type, n] of Object.entries(allocation)) {
      const candidates = formats.filter((f) => f.type === type);
      for (let i = 0; i < n; i++) {
        const format = candidates[i % Math.max(1, candidates.length)];
        if (!format) continue;
        const scheduledFor = times[ti++] || times[times.length - 1];

        slots.push({
          id: store.id('slot'),
          weekOf: weekStart.toISOString().slice(0, 10),
          day: DAY_NAMES[new Date(scheduledFor).getDay()],
          scheduledFor,
          type,
          formatId: format.id,
          formatName: format.name,
          medium: 'video',
          hook: resolveHook(format.hook, { scheduledFor }),
          why: format.why,
          films: format.films,
          lengthSec: format.lengthSec,
          reference: format.reference,
          referenceNote: format.referenceNote,
          evidence: format.evidence,
          verified: format.verified,
          servicePush: format.servicePush,
          confidence: format.confidence,
          caption: writeCaption(format, scheduledFor),
          // Video is filmed and posted by Sha on her phone; the engine
          // publishes nothing it did not produce.
          publishedBy: 'sha',
          status: 'briefed',
        });
      }
    }

    const plan = {
      weekOf: weekStart.toISOString().slice(0, 10),
      generatedAt: new Date().toISOString(),
      objective: brand.positioning.objective,
      allocation,
      slots,
      craftRules: CRAFT_RULES,
      totalFilmingMinutes: estimateFilmingTime(slots),
    };

    store.write('plan', plan);
    log.ok(`${slots.length} briefs written, ~${plan.totalFilmingMinutes} min of filming`);
    log.done({ slots: slots.length });
    return plan;
  } catch (err) {
    log.fail(err);
    throw err;
  }
}

/**
 * Honest estimate of what this costs Sha in time.
 *
 * Filming a 20-second clip takes far longer than 20 seconds — setup, a couple
 * of takes, and posting. Roughly four minutes per video is realistic; claiming
 * otherwise sets her up to feel behind in week one.
 */
function estimateFilmingTime(slots) {
  return slots.length * 4;
}

export default { run };
