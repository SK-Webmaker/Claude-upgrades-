import { POST_STATUS } from '../lib/store.js';
import { buildPlaybook } from '../lib/playbook.js';
import { BUSINESS, SERVICES, seasonFor } from '../lib/brand.js';
import { bodyFor } from '../lib/copy.js';

/**
 * The Producer.
 *
 * Writes the weekly shoot brief — exactly what Sha films, shot by shot — and
 * drafts a caption for every slot. This is the only place that decides what the
 * week looks like; the engine tells her what to film, she films it natively.
 */

/**
 * Brand facts come from `lib/brand.js`, which was populated from her live
 * Instagram profile and her Kairo booking site — not from anything invented here.
 */
export const BRAND = {
  name: BUSINESS.name,
  suburb: 'Camberwell',
  city: 'Melbourne',
  bookingUrl: BUSINESS.bookingUrl,
  specialty: BUSINESS.positioning,
  nearbySuburbs: BUSINESS.serviceSuburbs.filter((s) => s !== 'Camberwell'),
};

/**
 * Hashtag pools. Every tag is stored WITHOUT the "#" and the renderer adds it —
 * that way a tag can never end up as bare text the way it did on the live account.
 *
 * The mix is deliberate: local tags are small enough for her to actually rank in,
 * niche tags reach intent, broad tags are a minority because a 172-follower
 * account does not win #hairtransformation.
 */
export const HASHTAG_POOLS = {
  local: [
    'CamberwellHair',
    'CamberwellHairdresser',
    'HawthornHair',
    'GlenIrisHair',
    'KewHair',
    'BalwynHair',
    'CanterburyHair',
    'SurreyHillsHair',
    'MelbourneHairdresser',
    'MelbourneHairSalon',
    'EastMelbourneHair',
  ],
  niche: [
    'BlondeSpecialist',
    'BalayageMelbourne',
    'FullHeadFoils',
    'CreamyBlonde',
    'DimensionalBlonde',
    'ColourCorrection',
    'ToneRefresh',
    'BrunetteBalayage',
    'HealthyBlonde',
    'K18Treatment',
  ],
  broad: ['HairTransformation', 'HairGoals', 'BlondeHair', 'HairColour'],
  branded: ['HairBySha'],
};

/**
 * Builds a hashtag set: local-weighted, deduped, capped.
 * Returns bare tags; `renderCaption` prefixes them.
 */
export function buildHashtags({ local = 6, niche = 5, broad = 2, seed = 0 } = {}) {
  const pick = (pool, n, offset) =>
    Array.from({ length: Math.min(n, pool.length) }, (_, i) => pool[(offset + i) % pool.length]);

  const tags = [
    ...HASHTAG_POOLS.branded,
    ...pick(HASHTAG_POOLS.local, local, seed),
    ...pick(HASHTAG_POOLS.niche, niche, seed),
    ...pick(HASHTAG_POOLS.broad, broad, seed),
  ];

  return [...new Set(tags.map((t) => t.replace(/^#/, '')))].slice(0, 30);
}

/**
 * Rotating CTAs so the feed does not read like a template.
 *
 * Written to her voice: understated, first person, the free consult named
 * because it is a real differentiator and it lowers the barrier to a first
 * booking. One emoji, never a row.
 */
const CTAS = [
  `Book your colour consult — link in bio. 📍 ${BRAND.suburb}, ${BRAND.city}`,
  `DM to book, or tap the link in bio. 📍 ${BRAND.suburb}`,
  `Consults are free — book via the link in bio. 📍 ${BRAND.suburb}, ${BRAND.city}`,
  `Booking now — link in bio. 📍 ${BRAND.suburb}`,
  `Free consult first, always. Link in bio. 📍 ${BRAND.suburb}`,
];

/** Cadence -> which weekdays to post on. */
const SCHEDULE = {
  2: [2, 5], // Tue, Fri
  3: [2, 4, 6], // Tue, Thu, Sat
  4: [1, 3, 5, 6],
  5: [1, 2, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

function nextSlots(count, { from = new Date(), hour = 18 } = {}) {
  const days = SCHEDULE[count] ?? SCHEDULE[3];
  const slots = [];
  const cursor = new Date(from);
  cursor.setHours(hour, 0, 0, 0);

  // Walk forward up to two weeks until we have enough future slots.
  for (let i = 0; i < 14 && slots.length < count; i += 1) {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() + i);
    if (days.includes(day.getDay()) && day > from) {
      slots.push(day.toISOString());
    }
  }
  return slots;
}

function fillHook(hook, vars) {
  return hook.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}

/**
 * Drafts the caption for one slot. Body carries the hook and the substance; the
 * CTA and hashtags are separate fields so the Critic can check each on its own.
 */
export function draftCaption(format, { asset = null, index = 0, now = new Date() } = {}) {
  const season = seasonFor(now);
  // Rotate through her real colour menu so a service post never invents a name.
  const service = SERVICES.colour[index % SERVICES.colour.length];

  const vars = {
    n: asset?.vars?.n ?? '8',
    before: asset?.vars?.before ?? 'grown-out',
    after: asset?.vars?.after ?? 'creamy blonde',
    day: asset?.vars?.day ?? 'Thursday',
    time: asset?.vars?.time ?? '2:30pm',
    season: asset?.vars?.season ?? season.name,
    service: asset?.vars?.service ?? service.name,
    month: asset?.vars?.month ?? now.toLocaleString('en-AU', { month: 'long' }),
    offer: asset?.vars?.offer ?? 'K18 included with any blonde transformation',
  };

  const hook = fillHook(format.hooks[index % format.hooks.length], vars);

  // Audience-facing copy comes from lib/copy.js. `format.why` is internal
  // ranking rationale and must never reach a caption.
  const detail = fillHook(bodyFor(format, { index, season, service, asset }), vars);

  return {
    body: `${hook}\n\n${detail}`,
    cta: CTAS[index % CTAS.length],
    hashtags: buildHashtags({ seed: index }),
    // Kept so the playbook can show the filled hook rather than the template.
    filledHook: hook,
  };
}

/**
 * Producer stage.
 *
 * Pairs the top-ranked formats with whatever media the Librarian has ready.
 * A slot with no matching asset still produces a brief entry — that is the
 * instruction to go film it — but it does not become a draft post, because there
 * is nothing to publish yet.
 */
export async function runProducer({
  formatRanking = [],
  library = [],
  store = null,
  cadence = Number(process.env.POSTS_PER_WEEK) || 3,
  now = new Date(),
}) {
  const slots = nextSlots(cadence, { from: now });
  const available = [...library];
  const drafts = [];
  const shootList = [];
  const playbooks = [];

  formatRanking.slice(0, cadence).forEach((format, i) => {
    const slot = slots[i] ?? null;

    const matchIdx = available.findIndex(
      (asset) => asset.format === format.id || asset.mediaType === format.mediaType,
    );
    const asset = matchIdx >= 0 ? available.splice(matchIdx, 1)[0] : null;

    const caption = draftCaption(format, { asset, index: i });
    // The playbook is produced whether or not media exists yet — an unfilmed
    // slot needs its guide most of all, since that guide is how it gets filmed.
    const playbook = buildPlaybook(format, { caption, slot, index: i, asset });
    playbooks.push(playbook);

    shootList.push({
      slot,
      format: format.id,
      label: format.label,
      score: format.score,
      reasons: format.reasons,
      // Use the caption's filled hook. Re-filling the template with an empty
      // var map leaves a literal "{n}" in the brief Sha reads off her phone.
      hook: caption.filledHook,
      shotList: format.shotList,
      mediaType: format.mediaType,
      // Research is consistent on both: the first 1-2 seconds decide the post,
      // and 15-45s (ideally under 30) is the performing range.
      spec:
        format.mediaType === 'REELS'
          ? 'Keep it 15-30s. The first 2 seconds decide it — lead with the reveal, not the setup.'
          : null,
      consent:
        format.mediaOrigin === 'real'
          ? 'Get the client’s verbal OK before filming, and again before posting their face.'
          : null,
      status: asset ? 'media ready' : 'NEEDS FILMING',
    });

    if (!asset) return;

    const post = {
      format: format.id,
      formatLabel: format.label,
      mediaType: format.mediaType,
      slot,
      media: asset.media,
      altText: asset.altText ?? null,
      coverUrl: asset.coverUrl ?? null,
      caption,
      playbook,
      status: POST_STATUS.DRAFTED,
    };

    drafts.push(store ? store.addPost(post) : { id: `draft-${i}`, ...post });
  });

  const brief = {
    weekOf: now.toISOString().slice(0, 10),
    cadence,
    shootList,
    playbooks,
    draftCount: drafts.length,
    needsFilming: shootList.filter((s) => s.status === 'NEEDS FILMING').length,
  };

  if (store) store.saveBrief(brief);

  return { drafts, brief };
}
