import { brand, system } from '../lib/config.js';
import { makeLogger } from '../lib/log.js';
import * as store from '../lib/store.js';
import { inventory } from './ingest.js';
import { FORMAT_LIBRARY } from './research.js';

const log = makeLogger('plan');

/**
 * Turn the trend brief plus whatever footage exists into a concrete week.
 *
 * The two rules that keep this honest:
 *   1. Never plan a slot the footage cannot support. A "reveal" with no after
 *      clip is a slot that will fail at cut time, and a plan that quietly
 *      fails is worse than a plan that admits it is short.
 *   2. Respect the mix. Left alone, a transformation-heavy account stops
 *      reaching anyone new, so education and personality slots are reserved
 *      before transformation gets to take what is left.
 */

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** How many slots each content type gets, largest-remainder so it sums exactly. */
export function allocateMix(total, mix) {
  const raw = Object.entries(mix).map(([type, share]) => ({
    type, exact: total * share, n: Math.floor(total * share),
  }));
  let assigned = raw.reduce((a, r) => a + r.n, 0);
  raw.sort((a, b) => (b.exact - b.n) - (a.exact - a.n));
  let i = 0;
  while (assigned < total) { raw[i % raw.length].n += 1; assigned += 1; i += 1; }
  return Object.fromEntries(raw.map((r) => [r.type, r.n]));
}

/** Can the footage on hand actually support this format? */
/**
 * Clips already committed to a post that has not been rejected.
 *
 * Footage is only marked `usedInPosts` once a post actually publishes, which
 * leaves a window where a clip is cut but not yet live. Without this, running
 * the week twice re-plans the same footage and produces duplicate posts — and
 * the gate's duplicate rule will not catch it, because that only compares
 * against posts that have already gone out.
 */
export function claimedClipIds(posts) {
  const dead = new Set(['rejected', 'failed']);
  const claimed = new Set();
  for (const p of posts) {
    if (dead.has(p.status)) continue;
    for (const id of p.clipIds || []) claimed.add(id);
  }
  return claimed;
}

export function matchFootage(format, sessions, clips, taken) {
  const available = clips.filter((c) => !taken.has(c.id) && !c.usedInPosts?.length);

  // Prefer clips from a single appointment so a before/after is the same head.
  for (const session of sessions) {
    const pool = available.filter((c) => session.clips.includes(c.id));
    const picked = pickForNeeds(format.needs, pool);
    if (picked) return { clips: picked, sessionId: session.id, complete: true };
  }

  const loose = pickForNeeds(format.needs, available);
  if (loose) return { clips: loose, sessionId: null, complete: true };

  // Partial match: enough to attempt, flagged so the gate knows.
  const partial = format.needs
    .map((need) => available.find((c) => c.tags.includes(need) || c.tags.includes('unsorted')))
    .filter(Boolean);
  if (partial.length) {
    return { clips: dedupe(partial), sessionId: null, complete: false, missing: format.needs.filter((n) => !partial.some((c) => c.tags.includes(n))) };
  }
  return null;
}

function pickForNeeds(needs, pool) {
  const out = [];
  const used = new Set();
  for (const need of needs) {
    const hit = pool.find((c) => !used.has(c.id) && c.tags.includes(need));
    if (!hit) return null;
    used.add(hit.id);
    out.push(hit);
  }
  return out;
}

function dedupe(arr) {
  const seen = new Set();
  return arr.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

/** Spread slots across the week at the configured best times. */
export function scheduleSlots(count, weekStart) {
  const igSlots = system.publishing.instagram.bestSlotsLocal;
  const days = [1, 2, 3, 4, 5, 6]; // Tue–Sun; Monday is the build day
  const out = [];
  for (let i = 0; i < count; i++) {
    const day = days[i % days.length];
    const time = igSlots[Math.floor(i / days.length) % igSlots.length];
    const [h, m] = time.split(':').map(Number);
    const when = new Date(weekStart);
    when.setDate(when.getDate() + day);
    when.setHours(h, m, 0, 0);
    out.push(when.toISOString());
  }
  return out.sort();
}

/**
 * Format hooks carry placeholders like {day} and {problem} so one template can
 * serve a whole season. They are resolved here, at plan time, because the slot
 * knows its own scheduled day and content type. An unresolved placeholder that
 * reaches a caption is a visible bug in a client's feed, so anything still
 * unfilled is stripped rather than shipped.
 */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function resolveHook(pattern, { scheduledFor, type } = {}) {
  if (!pattern) return '';
  const day = scheduledFor ? DAY_NAMES[new Date(scheduledFor).getDay()] : 'This week';
  const vars = {
    day,
    problem: 'with three years of box dye on the ends',
    detail: 'check the tone in daylight before she leaves',
    suburb: brand.business.suburb,
  };
  return pattern
    .replace(/\{(\w+)\}/g, (m, key) => vars[key] ?? '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildCaption(format, trendTags, slotMeta) {
  const core = brand.voice.coreHashtags;
  const extra = trendTags
    .filter((t) => t.kind === 'hashtag' && t.relevant)
    .slice(0, 3)
    .map((t) => t.value);
  const tags = dedupeStrings([...core, ...extra]).slice(0, brand.voice.hashtagCount.max);
  return {
    hook: resolveHook(format.hookPattern, slotMeta),
    hookPattern: format.hookPattern,
    body: null, // written at cut time against the actual footage
    cta: brand.cta.primary,
    hashtags: tags,
  };
}

function dedupeStrings(a) {
  return [...new Set(a.map((s) => s.toLowerCase()))].map((s) =>
    a.find((o) => o.toLowerCase() === s)
  );
}

export async function run({ weekOf = null } = {}) {
  log.start();
  try {
    const brief = store.read('trends', { items: [], formats: [] });
    const clips = store.read('footage', []);
    const inv = inventory();
    const weekStart = weekOf ? new Date(weekOf) : startOfWeek();
    const total = system.cadence.postsPerWeek;

    const allocation = allocateMix(total, system.mix);
    log.info(`allocating ${total} slots: ${Object.entries(allocation).map(([k, v]) => `${k} ${v}`).join(', ')}`);

    // Formats ranked by this salon's own results, falling back to the library.
    const ranked = (brief.formats?.length ? brief.formats : FORMAT_LIBRARY);
    const times = scheduleSlots(total, weekStart);

    const slots = [];
    // Start from footage already committed to in-flight posts, so re-running
    // the week is idempotent rather than duplicating everything.
    const existingPosts = store.read('posts', []);
    const taken = claimedClipIds(existingPosts);
    if (taken.size) log.info(`${taken.size} clip(s) already committed to in-flight posts`);
    let ti = 0;

    for (const [type, n] of Object.entries(allocation)) {
      const candidates = ranked.filter((f) => f.type === type);
      for (let i = 0; i < n; i++) {
        const format = candidates[i % Math.max(1, candidates.length)] || ranked[0];
        if (!format) continue;

        const match = matchFootage(format, inv.sessions, clips, taken);
        if (match) for (const c of match.clips) taken.add(c.id);

        const scheduledFor = times[ti++] || times[times.length - 1];

        slots.push({
          id: store.id('slot'),
          weekOf: weekStart.toISOString().slice(0, 10),
          type,
          formatId: format.id,
          formatName: format.name,
          why: format.why,
          beats: format.beats || [],
          confidence: format.confidence || 'untested',
          scheduledFor,
          clipIds: match?.clips.map((c) => c.id) || [],
          sessionId: match?.sessionId || null,
          footageComplete: Boolean(match?.complete),
          missingFootage: match?.missing || (match ? [] : format.needs),
          caption: buildCaption(format, brief.items || [], { scheduledFor, type }),
          status: match ? 'ready_to_cut' : 'blocked_no_footage',
          platforms: ['instagram', 'tiktok'],
        });
      }
    }

    const blocked = slots.filter((s) => s.status === 'blocked_no_footage');
    const plan = {
      weekOf: weekStart.toISOString().slice(0, 10),
      generatedAt: new Date().toISOString(),
      objective: brand.positioning.objective,
      allocation,
      slots,
      footageGaps: [...new Set(blocked.flatMap((s) => s.missingFootage))],
      shotList: buildShotList(blocked, slots),
    };

    store.write('plan', plan);
    log.done({
      slots: slots.length,
      ready: slots.length - blocked.length,
      blocked: blocked.length,
    });
    if (blocked.length) {
      log.warn(`${blocked.length} slot(s) need footage: ${plan.footageGaps.join(', ')}`);
    }
    return plan;
  } catch (err) {
    log.fail(err);
    throw err;
  }
}

/** Tell Sha exactly what to film to unblock next week. */
function buildShotList(blocked, allSlots) {
  const need = {};
  for (const s of [...blocked, ...allSlots.filter((x) => !x.footageComplete)]) {
    for (const m of s.missingFootage || []) need[m] = (need[m] || 0) + 1;
  }
  const guide = {
    before: 'A 5-second hold on the hair before you touch it. Good light, hair down, from behind and one side.',
    after: 'The reveal. 8 seconds, slow spin or a walk-away, natural light near the window.',
    process: '10 seconds of the actual work — foils going in, colour being painted, the rinse.',
    talking: 'Look at the lens and say one sentence about what you are doing and why.',
  };
  return Object.entries(need).map(([tag, count]) => ({
    tag, count, how: guide[tag] || 'Any usable footage of this stage.',
  }));
}

export default { run, allocateMix, matchFootage, scheduleSlots };
