/**
 * The Scout.
 *
 * Ranks content formats for the coming week against a reference library of what
 * works for a local colour specialist, weighted by Sha's own results (Analyst)
 * and by live market research when a research snapshot is available.
 */

/**
 * Reference library. Each format carries the hook patterns that make it work,
 * the shot list Sha needs to film, and an effort cost so a week's slate stays
 * realistic for one stylist working behind the chair.
 *
 * `mediaOrigin: 'real'` means the result shown must be genuine client work.
 */
export const FORMAT_LIBRARY = [
  {
    id: 'transformation_reveal',
    label: 'Transformation reveal',
    mediaType: 'REELS',
    baseScore: 92,
    effort: 2,
    mediaOrigin: 'real',
    why: 'Highest-intent format for colour. Prospective clients are buying the outcome.',
    hooks: [
      'She hadn’t been blonde in {n} years.',
      'From {before} to {after} in one sitting.',
      'This is {n} hours of foils, condensed.',
    ],
    shotList: [
      'Before: natural light, front and back, no filter',
      'Process: 2-3 seconds of foil placement or application',
      'Reveal: chair spin, hair down, slow pan',
      'Finish: styled, moving, natural light',
    ],
  },
  {
    id: 'contrast_hook',
    label: 'Same base, different hair',
    mediaType: 'REELS',
    baseScore: 88,
    effort: 2,
    mediaOrigin: 'real',
    why: 'Her best-performing post used exactly this. Cheap to shoot, strong stop rate.',
    hooks: [
      'Same length. Same base. Completely different hair.',
      'No cut. No extensions. Just colour.',
      'Nothing was removed — only rearranged.',
    ],
    shotList: [
      'Before and after framed identically, same angle and distance',
      'Hard cut between them on the beat',
      'Hold the after for 3 seconds',
    ],
  },
  {
    id: 'process_satisfying',
    label: 'Satisfying process',
    mediaType: 'REELS',
    baseScore: 80,
    effort: 1,
    mediaOrigin: 'real',
    why: 'Watch-time driver. Retention lifts the whole account, not just this post.',
    hooks: [
      'Foil placement that decides everything.',
      'The part nobody sees.',
      'Twenty seconds of colour doing its thing.',
    ],
    shotList: [
      'Overhead of sectioning, tripod or shelf',
      'Close on foil or brush work, hands in frame',
      'Rinse bowl, water running clear',
    ],
  },
  {
    id: 'education_myth',
    label: 'Myth correction',
    mediaType: 'REELS',
    baseScore: 78,
    effort: 1,
    mediaOrigin: 'real',
    why: 'Builds authority and pre-frames the consult. Filters out unrealistic briefs.',
    hooks: [
      'No, you cannot go platinum in one sitting. Here’s why.',
      'Box dye isn’t the problem. This is.',
      'Your blonde going brassy isn’t your fault.',
    ],
    shotList: [
      'Talking head, salon background, good light',
      'Cut to a hair example that proves the point',
      'End on the correction, not the myth',
    ],
  },
  {
    id: 'price_transparency',
    label: 'What it actually costs',
    mediaType: 'REELS',
    baseScore: 76,
    effort: 1,
    mediaOrigin: 'real',
    why: 'Highest-converting educational angle. Removes the main booking objection.',
    hooks: [
      'What a full head of foils actually costs in Melbourne.',
      'Why your balayage quote was $200 different everywhere you asked.',
      'You’re not paying for the colour. You’re paying for this.',
    ],
    shotList: [
      'Talking head with the price on screen, no coyness',
      'Cut to the work that justifies it',
      'End on the booking CTA',
    ],
  },
  {
    id: 'client_reaction',
    label: 'Client reaction',
    mediaType: 'REELS',
    baseScore: 74,
    effort: 1,
    mediaOrigin: 'real',
    why: 'Social proof that cannot be faked. Strongest trust signal available.',
    hooks: ['She had no idea.', 'The moment she sees it.', 'I asked her not to look for 3 hours.'],
    shotList: ['Chair spin, film the face not the hair', 'Hold the reaction', 'Then show the hair'],
  },
  {
    id: 'maintenance_tips',
    label: 'Keep it looking new',
    mediaType: 'CAROUSEL',
    baseScore: 68,
    effort: 1,
    mediaOrigin: 'real',
    why: 'Saves and shares. Saved posts keep resurfacing to new local audiences.',
    hooks: [
      'How to keep your blonde from going brassy.',
      'Five things quietly wrecking your colour.',
      'Your colour should last {n} weeks. Here’s how.',
    ],
    shotList: [
      'Cover card with the promise, big type',
      '3-5 tip cards, one idea each',
      'Final card: book your refresh',
    ],
  },
  {
    id: 'product_feature',
    label: 'Product in use',
    mediaType: 'REELS',
    baseScore: 60,
    effort: 1,
    mediaOrigin: 'real',
    why: 'Retail revenue and expertise signal. Keep it in-chair, never a flat-lay ad.',
    hooks: [
      'What K18 actually does to a bond.',
      'The treatment I put in every blonde.',
      'This is why your hair felt different after.',
    ],
    shotList: ['Product in hand, in chair', 'Applied to real hair', 'Result close-up'],
  },
  {
    id: 'booking_urgency',
    label: 'Open slot',
    mediaType: 'IMAGE',
    baseScore: 52,
    effort: 1,
    mediaOrigin: 'any',
    why: 'Direct-response filler. Fills a genuine gap; loses power if overused.',
    hooks: [
      'Colour appointment open {day} from {time}.',
      'One cancellation this week.',
      '{day} afternoon just opened up.',
    ],
    shotList: ['Recent result photo, or a clean type-led graphic'],
  },
  {
    id: 'seasonal_angle',
    label: 'Seasonal change',
    mediaType: 'REELS',
    baseScore: 72,
    effort: 1,
    mediaOrigin: 'real',
    season: true,
    why: 'Seasonal content performs because people search it. Melbourne seasons — never northern-hemisphere ones.',
    hooks: [
      'What {season} does to blonde, and how to get ahead of it.',
      '{season} in Melbourne means one thing for your colour.',
      'Booking {season} colour now, before the rush.',
    ],
    shotList: [
      'Hook to camera or over a result, season named on screen',
      'The problem the season causes — dryness, brassiness, dullness',
      'The fix, shown on real hair',
      'Close on the booking CTA',
    ],
  },
  {
    id: 'service_spotlight',
    label: 'One service explained',
    mediaType: 'REELS',
    baseScore: 70,
    effort: 1,
    mediaOrigin: 'real',
    usesService: true,
    why: 'Removes the "I don’t know what to book" objection, which is the quiet reason booking pages get abandoned.',
    hooks: [
      'What "{service}" actually means, and who it’s for.',
      'Balayage or foils? Here’s how I decide.',
      'The difference between {service} and what you probably booked.',
    ],
    shotList: [
      'Name the service on screen in the first second',
      'Show the technique on real hair',
      'Who it suits, and who it does not',
      'Time and price on screen, said plainly',
    ],
  },
  {
    id: 'offer_promo',
    label: 'Offer',
    mediaType: 'REELS',
    baseScore: 58,
    effort: 1,
    mediaOrigin: 'any',
    why: 'Converts hardest of any format, degrades fastest if repeated. Keep it rare and make it specific.',
    hooks: [
      '{offer} — this month only.',
      'New client? Your first colour comes with something.',
      'Booking {month}: here’s what’s included.',
    ],
    shotList: [
      'The offer stated on screen in plain words, first second',
      'The work it applies to, on real hair',
      'The deadline, said out loud',
    ],
  },
  {
    id: 'new_client_welcome',
    label: 'What a first visit is like',
    mediaType: 'REELS',
    baseScore: 66,
    effort: 1,
    mediaOrigin: 'real',
    why: 'Nervousness about a new salon is a real booking blocker. Showing the room and the consult defuses it.',
    hooks: [
      'What happens when you book a first colour with me.',
      'Nervous about a new salon? This is the whole process.',
      'Your free consult, start to finish.',
    ],
    shotList: [
      'Walking into the space — show the room, it is the reassurance',
      'The consult: reference photos, the honest conversation',
      'A finished result from a first-time client',
      'Booking CTA with the free consult named',
    ],
  },
  {
    id: 'aftercare_routine',
    label: 'Make it last',
    mediaType: 'CAROUSEL',
    baseScore: 64,
    effort: 1,
    mediaOrigin: 'real',
    why: 'Saveable, and it protects her work. A client whose colour lasts rebooks; one whose colour goes brassy blames the salon.',
    hooks: [
      'Your blonde should still look good in {n} weeks. Here’s how.',
      'The wash routine that keeps blonde from going brassy.',
      'What I actually recommend after a colour, and why.',
    ],
    shotList: [
      'Cover card with the promise',
      'One tip per card, 3-5 cards',
      'Product she genuinely stocks, in the salon',
      'Final card: book your refresh',
    ],
  },
];

/** How often a format may run, in days. Stops the feed feeling repetitive. */
const COOLDOWN_DAYS = {
  booking_urgency: 10,
  product_feature: 14,
  default: 7,
};

export function scoreFormats({
  insights = [],
  research = null,
  recentFormats = [],
  formatBias = {},
  now = new Date(),
}) {
  // Per-format engagement from the Analyst, when we have it.
  const performance = new Map();
  for (const item of insights) {
    if (!item.format) continue;
    const prev = performance.get(item.format) ?? { total: 0, n: 0 };
    performance.set(item.format, { total: prev.total + (item.score ?? 0), n: prev.n + 1 });
  }
  const averages = [...performance.entries()].map(([, v]) => v.total / v.n);
  const meanScore = averages.length ? averages.reduce((a, b) => a + b, 0) / averages.length : 0;

  // Market signal keyed by format id, from the research snapshot.
  const trend = new Map(Object.entries(research?.formatSignal ?? {}));

  return FORMAT_LIBRARY.map((format) => {
    let score = format.baseScore;
    const reasons = [];

    const own = performance.get(format.id);
    if (own && meanScore > 0) {
      const avg = own.total / own.n;
      const delta = Math.round(((avg - meanScore) / meanScore) * 25);
      score += delta;
      reasons.push(
        `${delta >= 0 ? '+' : ''}${delta} from her own results (${own.n} post${own.n === 1 ? '' : 's'})`,
      );
    }

    if (trend.has(format.id)) {
      const lift = Math.round(Number(trend.get(format.id)) || 0);
      score += lift;
      reasons.push(`${lift >= 0 ? '+' : ''}${lift} from market research`);
    }

    // Last week's scorecard steers this week's mix — this is the compounding loop.
    if (formatBias[format.id]) {
      const delta = Math.round(formatBias[format.id]);
      score += delta;
      reasons.push(`${delta >= 0 ? '+' : ''}${delta} from last week's scorecard`);
    }

    const last = recentFormats.find((r) => r.format === format.id);
    if (last) {
      const days = (now - new Date(last.postedAt)) / 86_400_000;
      const cooldown = COOLDOWN_DAYS[format.id] ?? COOLDOWN_DAYS.default;
      if (days < cooldown) {
        const penalty = Math.round(((cooldown - days) / cooldown) * 40);
        score -= penalty;
        reasons.push(`-${penalty} used ${Math.round(days)}d ago, cooldown ${cooldown}d`);
      }
    }

    return { ...format, score: Math.round(score), reasons };
  }).sort((a, b) => b.score - a.score);
}

export async function runScout({ insights = [], goals = null, store = null, now = new Date() }) {
  const state = store?.state ?? {};
  const recentFormats = (state.posts ?? [])
    .filter((p) => p.status === 'published' && p.format)
    .map((p) => ({ format: p.format, postedAt: p.publish?.publishedAt ?? p.createdAt }))
    .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));

  const formatRanking = scoreFormats({
    insights,
    research: state.research,
    recentFormats,
    formatBias: goals?.formatBias ?? {},
    now,
  });

  return { formatRanking };
}
