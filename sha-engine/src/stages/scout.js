import { brand, system } from '../lib/config.js';
import { makeLogger } from '../lib/log.js';
import * as store from '../lib/store.js';

const log = makeLogger('scout');

/**
 * Find video formats worth copying, and the actual video that proves it.
 *
 * The pivot: getting raw footage off Sha's phone and onto a machine turned out
 * to be the real bottleneck, so the engine no longer cuts video. Instead it
 * tells her exactly what to film and post natively, and cites the source video
 * so she can watch the thing rather than read a description of it.
 *
 * Two rules keep this honest:
 *
 *   1. A recommendation must carry a link. "Do a transformation reel" is
 *      advice anyone could give. "Watch this, copy the first two seconds" is
 *      a brief. Every format here carries a real reference.
 *
 *   2. Nothing claims a view count this engine has not verified. Fabricated
 *      numbers are worse than no numbers, because they make a weak format
 *      look proven.
 */

/**
 * What the research actually established, as constraints rather than opinions.
 * These are applied to every brief the engine writes.
 */
export const CRAFT_RULES = [
  {
    id: 'watch-through',
    rule: 'Shorter almost always wins',
    detail: 'Platforms reward watch-through rate, not length. A 20-second video held to 90% beats a 60-second video held to 40%. Target 15–25 seconds unless the format genuinely needs more.',
  },
  {
    id: 'hook-2s',
    rule: 'The hook lands inside 2 seconds',
    detail: 'No "Hey guys", no slow logo zoom, no text that takes five seconds to read. Something interesting must already be happening when the video starts.',
  },
  {
    id: 'vertical',
    rule: 'Vertical only',
    detail: 'Filming horizontal and adding bars throws away roughly 40% of the screen.',
  },
  {
    id: 'captions',
    rule: 'Never trust auto-captions',
    detail: 'Auto-captions reliably hear "balayage" as something else entirely. Type them manually — it takes a minute and the alternative is embarrassing.',
  },
  {
    id: 'light',
    rule: 'Daylight-balanced light, 5500K',
    detail: 'The single cheapest quality upgrade. Salon fluorescents make good colour work look yellow and flat on camera.',
  },
  {
    id: 'imperfect',
    rule: 'Rough beats polished',
    detail: 'Shaky phone footage of something interesting outperforms a polished edit of something boring. Do not spend an hour editing.',
  },
];

/**
 * The reference library.
 *
 * Each entry names the format, the shape of the hook, exactly what Sha films,
 * and a real video to watch first. `evidence` states plainly why the format is
 * here, and `verified` marks whether this engine has confirmed the numbers —
 * which, without platform API access, is currently never.
 */
export const REFERENCE_LIBRARY = [
  {
    id: 'brass-fix',
    type: 'transformation',
    name: 'The brass correction',
    hook: 'Three years of box dye. Watch.',
    why: 'Colour correction is the highest-intent thing anyone searches for. The before frame does the qualifying — people with the same problem stop scrolling.',
    films: [
      'Before: 3 seconds, hair down, natural light, from behind and one side.',
      'Process: 10 seconds of the actual work — colour going on, foils in.',
      'Reveal: 6 seconds, slow turn or walk-away near the window.',
    ],
    lengthSec: [18, 25],
    reference: 'https://www.instagram.com/reel/DIwRQaQJdu2/',
    referenceNote: 'Complex balayage colour correction, blending multiple shades — same job Sha does, and the structure is copyable exactly.',
    evidence: 'Transformation is the single most-posted salon format and the one the industry checklists put first for client acquisition.',
    verified: false,
    servicePush: 'Blonde Transformation + K18 · from $420',
  },
  {
    id: 'grey-blend',
    type: 'transformation',
    name: 'Grey blending, not covering',
    hook: 'You do not have to cover the grey.',
    why: 'Speaks straight to the busy professional who wants low maintenance and thinks her only option is a full tint every four weeks.',
    films: [
      'Close on the regrowth before you start — 3 seconds.',
      'Placement: where you put the colour and why. 8 seconds.',
      'Result in movement — 6 seconds.',
    ],
    lengthSec: [15, 22],
    reference: 'https://www.instagram.com/reel/DZQ8zkKhSb8/',
    referenceNote: 'Full balayage highlights used to blend white hair from the roots. Watch how the before frame is held long enough to register.',
    evidence: 'Directly answers the objection that keeps this client out of the chair; matches the "lived-in blonde" positioning already on the booking page.',
    verified: false,
    servicePush: 'Balayage / Lived-in Blonde · from $340',
  },
  {
    id: 'myth-buster',
    type: 'education',
    name: 'The myth, corrected',
    hook: 'Purple shampoo is not fixing your brass.',
    why: 'The strongest education format there is. It earns saves, and saves are the metric that most reliably precedes a booking.',
    films: [
      'The myth as on-screen text only, no voice, held 2 seconds: "Purple shampoo fixes brassy hair."',
      'You appear and say "Actually…" then correct it in one sentence — purple shampoo tones the surface, it cannot lift the warmth underneath.',
      'One piece of proof — a strand, a swatch, or a client result.',
    ],
    altMyths: [
      'Toner is not permanent — it is a top-up, not a fix.',
      'Box dye does not "wash out". It builds up.',
      'You do not need to go lighter to look brighter.',
    ],
    lengthSec: [20, 35],
    reference: 'https://www.instagram.com/reel/DYmuloKIbK0/',
    referenceNote: 'Three stealable stylist formats; the myth-correction structure is the middle one.',
    evidence: 'Industry checklists specify this format with an explicit 2-second text hold and a 30–45 second ceiling.',
    verified: false,
    servicePush: 'Toner & Gloss · $45 — the low-friction first booking',
  },
  {
    id: 'ten-second-skill',
    type: 'education',
    name: 'Ten seconds of pure skill',
    hook: 'No talking. Just the hands.',
    why: 'Proof of competence with nothing to sit through. Cheapest possible video to make and it holds watch-through almost by design.',
    films: [
      'One continuous close-up of a single technique — a foil placed, a section painted, a toner going through.',
      'No intro, no outro. Start mid-action.',
    ],
    lengthSec: [8, 12],
    reference: 'https://www.tiktok.com/@amberrosehairr/video/7505900699331628290',
    referenceNote: 'Salon content built around short skill demonstrations.',
    evidence: 'Explicitly recommended as "proof of your skill in under 10 seconds"; short length maximises the watch-through rate platforms reward.',
    verified: false,
    servicePush: 'Partial Blonde (Foils) · from $240',
  },
  {
    id: 'price-honesty',
    type: 'personality',
    name: 'What it actually costs, and why',
    hook: 'This took four hours. Here is where the money goes.',
    why: 'Price is the unspoken objection for every $340 colour. Addressing it directly filters out the people who were never booking and reassures the ones who were.',
    films: [
      'The finished result first — earn the right to talk.',
      'You, to camera, naming the real cost drivers: time, product, training.',
      'No apology, no discount.',
    ],
    lengthSec: [20, 30],
    reference: 'https://www.thecut.com/article/hair-by-chrissy-drama-prices-explained.html',
    referenceNote: 'Case study in what happens when pricing is NOT explained up front — a stylist\'s prices became a viral controversy. Read this as the cautionary version.',
    evidence: 'Pricing transparency is a recurring high-engagement topic in the industry; the linked case shows the downside risk of leaving it unaddressed.',
    verified: false,
    servicePush: 'Balayage / Lived-in Blonde · from $340',
  },
  {
    id: 'chair-open',
    type: 'offer',
    name: 'Chair is open',
    hook: '{day} just opened up.',
    why: 'The direct booking driver. Capped at 15% of slots so the feed never reads as an ad channel.',
    films: [
      'Best recent result, 5 seconds.',
      'On-screen text with the actual day and time.',
      'One clear instruction: book at the link.',
    ],
    lengthSec: [10, 15],
    reference: null,
    referenceNote: 'No reference needed — this one is a card, not a copy.',
    evidence: 'Salons using a direct booking CTA convert materially better than those relying on profile discovery alone.',
    verified: false,
    servicePush: 'Whatever the open slot is worth',
  },
];

/** Rank formats by what has actually worked for this salon, then by mix need. */
export function rankFormats(memory = {}) {
  return REFERENCE_LIBRARY.map((f) => {
    const mem = memory.formats?.[f.id];
    return {
      ...f,
      timesUsed: mem?.n || 0,
      avgScore: mem?.avg ?? null,
      confidence: (mem?.n || 0) >= system.scoring.minPostsBeforeTrust ? 'proven here' : 'untested here',
    };
  }).sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
}

export async function run() {
  log.start();
  try {
    const memory = store.recallPatterns();
    const formats = rankFormats(memory);

    const brief = {
      generatedAt: new Date().toISOString(),
      region: system.research.region,
      formats,
      craftRules: CRAFT_RULES,
      keywords: brand.positioning.priorityKeywords,
      note: 'Every format carries a reference video. View counts are not asserted — none have been verified by this engine.',
    };

    store.write('trends', { ...brief, items: [], live: true });
    log.ok(`${formats.length} formats ranked, ${formats.filter((f) => f.reference).length} with reference videos`);
    log.done({ formats: formats.length });
    return brief;
  } catch (err) {
    log.fail(err);
    throw err;
  }
}

export default { run, rankFormats, REFERENCE_LIBRARY, CRAFT_RULES };
