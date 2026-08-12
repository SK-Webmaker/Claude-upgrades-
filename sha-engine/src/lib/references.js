/**
 * What to watch before filming.
 *
 * A note on link honesty, because it changes what is stored here.
 *
 * Individual post permalinks cannot be verified from this environment. A
 * deliberately fake reel URL (`instagram.com/reel/ZZZZfakefake9/`) returns HTTP
 * 200, while real creator profiles return 429 — Instagram's status codes carry
 * no signal about whether a link is real. Permalinks also rot as creators
 * archive posts.
 *
 * So this library stores two things that stay useful:
 *
 *   1. Creator accounts worth studying — a body of work, not one clip
 *   2. Hashtag and audio browse URLs, which are constructed URL patterns that
 *      are live by definition and always show current top-performing content
 *
 * `sourcedFrom` records where a handle came from. Nothing here claims a view
 * count, and `verified: false` stays until an API confirms otherwise.
 */

export const STUDY_ACCOUNTS = [
  {
    handle: 'kaseylee_blondespecialist',
    url: 'https://www.instagram.com/kaseylee_blondespecialist/',
    who: 'Kasey Wilson — Melbourne blonde specialist, runs KLBS Salon',
    why: 'Closest peer in the market: same city, same niche, further along. Study how she frames a reveal and how her captions sell the consult.',
    watchFor: ['Reveal framing and camera distance', 'Caption structure', 'How often she shows her own face'],
    relevance: 'local',
    sourcedFrom: 'Firecrawl search, AU-localised, 2026-08-11',
    verified: false,
  },
  {
    handle: 'omgartistry',
    url: 'https://www.instagram.com/omgartistry/',
    who: 'Olivia Thompson — blonde specialist, transformation-led feed',
    why: 'Strong hook writing. Her bio line — "a great hairstylist gives you what you ask for, an expert gives you what actually works" — is the positioning Sha already has but does not say out loud.',
    watchFor: ['Opening two seconds', 'On-screen text length', 'Before/after cut timing'],
    relevance: 'niche',
    sourcedFrom: 'Firecrawl search, 2026-08-11',
    verified: false,
  },
  {
    handle: 'johnnyramirez',
    url: 'https://www.instagram.com/johnnyramirez/',
    who: 'Johnny Ramirez — LA colourist, widely cited as a balayage reference account',
    why: 'The high end of the craft. Useful for shot composition and lighting, not for cadence — his scale is nothing like a single-chair salon.',
    watchFor: ['Lighting on the finished hair', 'How little text he needs', 'Consistent colour grade'],
    relevance: 'aspirational',
    sourcedFrom: 'SalonCentric "10 Balayage Accounts You Need to Follow"',
    verified: false,
  },
  {
    handle: 'shelleygregoryhair',
    url: 'https://www.instagram.com/shelleygregoryhair/',
    who: 'Shelley Gregory — colourist with a strong visual identity',
    why: 'Study feed cohesion. Her grid reads as one body of work, which is what makes a profile visit convert into a follow.',
    watchFor: ['Grid consistency', 'Recurring colour palette', 'Cover frame choice'],
    relevance: 'aspirational',
    sourcedFrom: 'SalonCentric "10 Balayage Accounts You Need to Follow"',
    verified: false,
  },
  {
    handle: 'hairbyamybee',
    url: 'https://www.instagram.com/hairbyamybee/',
    who: 'Amy Bee — balayage specialist',
    why: 'Good example of process content that holds attention without being long.',
    watchFor: ['Process shot pacing', 'Where she cuts away', 'Hands-in-frame composition'],
    relevance: 'niche',
    sourcedFrom: 'SalonCentric "10 Balayage Accounts You Need to Follow"',
    verified: false,
  },
];

/**
 * Always-live browse URLs. These are constructed patterns, not scraped links —
 * they resolve by definition and always surface current top content.
 */
export const LIVE_BROWSE = {
  instagramTag: (tag) => `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`,
  tiktokTag: (tag) => `https://www.tiktok.com/tag/${encodeURIComponent(tag)}`,
  tiktokSearch: (q) => `https://www.tiktok.com/search?q=${encodeURIComponent(q)}`,
  instagramAudio: () => 'https://www.instagram.com/reels/audio/',
};

/** Tags worth checking before a shoot, grouped by what each is for. */
export const BROWSE_SETS = {
  local: ['melbournehairdresser', 'melbournehairsalon', 'camberwellhair', 'melbournebalayage'],
  craft: ['balayage', 'fullheadfoils', 'blondespecialist', 'hairtransformation'],
  formatIdeas: ['hairtok', 'hairstylistlife', 'coloristsofinstagram'],
};

/** Browse links for one format, so the brief points somewhere specific. */
export function browseFor(formatId) {
  const byFormat = {
    transformation_reveal: ['hairtransformation', 'balayage'],
    contrast_hook: ['hairtransformation', 'melbournebalayage'],
    process_satisfying: ['fullheadfoils', 'balayage'],
    education_myth: ['hairtok', 'blondespecialist'],
    price_transparency: ['hairstylistlife', 'hairtok'],
    client_reaction: ['hairtransformation', 'hairtok'],
    maintenance_tips: ['blondespecialist', 'hairtok'],
    product_feature: ['blondespecialist'],
    booking_urgency: ['melbournehairdresser'],
  };
  const tags = byFormat[formatId] ?? BROWSE_SETS.craft;
  return tags.map((tag) => ({
    tag,
    instagram: LIVE_BROWSE.instagramTag(tag),
    tiktok: LIVE_BROWSE.tiktokTag(tag),
  }));
}

/** The accounts most worth studying for a given format. */
export function accountsFor(formatId) {
  const local = STUDY_ACCOUNTS.filter((a) => a.relevance === 'local');
  const niche = STUDY_ACCOUNTS.filter((a) => a.relevance === 'niche');
  if (['transformation_reveal', 'contrast_hook', 'client_reaction'].includes(formatId)) {
    return [...local, ...niche].slice(0, 3);
  }
  return [...local, ...niche].slice(0, 2);
}
