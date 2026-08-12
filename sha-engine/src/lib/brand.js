import { brand } from './config.js';

/**
 * Brand adapter.
 *
 * `config/brand.json` is the source of truth — it is edited by hand and carries
 * her real services, prices, voice rules and palette. This module shapes that
 * file for the content modules and adds only what the JSON cannot express:
 * southern-hemisphere seasons, Melbourne calendar moments, and the voice check.
 *
 * Nothing here redefines a fact that lives in the JSON.
 */

export const BUSINESS = {
  name: brand.business.name,
  operator: brand.business.operator,
  displayName: `${brand.business.name} | ${brand.business.suburb}`,
  handle: brand.business.instagram,
  instagram: `https://www.instagram.com/${brand.business.instagram}/`,
  address: brand.business.address,
  suburb: brand.business.suburb,
  city: brand.business.city,
  timezone: brand.business.timezone,
  phone: brand.business.phone,
  bookingUrl: brand.business.bookingUrl,
  website: brand.business.website,
  tagline: brand.positioning.tagline,
  positioning: brand.positioning.speciality,
  credentials: brand.positioning.credentials ?? [],
  idealClient: brand.positioning.idealClient,
  priceAnchor: brand.positioning.priceAnchor,
  serviceSuburbs: [
    brand.business.suburb,
    'Hawthorn',
    'Glen Iris',
    'Kew',
    'Balwyn',
    'Canterbury',
    'Surrey Hills',
  ],
  stockists: ['ELEVEN Australia', 'K18'],
};

/** Her live service menu, straight from the config. */
export const SERVICES = brand.positioning.services;

export function allServices() {
  return SERVICES;
}

export function serviceById(id) {
  // The config keys services by name; ids are derived so callers can be stable.
  return SERVICES.find((s) => slugFor(s) === id) ?? null;
}

export function slugFor(service) {
  return service.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * The services content should actually drive toward.
 *
 * `priceAnchor.note` in the config is explicit: the money is in the $240-$420
 * colour packages, not the $35 blow dry. Content that spotlights a cheap service
 * trains the audience to book the cheap service.
 */
export function heroServices() {
  const hero = SERVICES.filter((s) => s.hero);
  return hero.length ? hero : SERVICES.filter((s) => s.category === 'colour package');
}

export function priceLabel(service) {
  return `${service.from ? 'from ' : ''}$${service.price}`;
}

export function durationLabel(service) {
  const h = service.minutes / 60;
  if (h < 1) return `${service.minutes} minutes`;
  return Number.isInteger(h) ? `${h} hour${h === 1 ? '' : 's'}` : `${h.toFixed(1)} hours`;
}

/** Voice rules, lifted from the config so there is one place to edit them. */
export const VOICE = {
  persona: brand.voice.persona,
  use: brand.voice.use ?? [],
  avoid: brand.voice.avoid ?? [],
  emojiMax: brand.voice.emojiMax ?? 2,
  hashtagCount: brand.voice.hashtagCount ?? { min: 4, max: 8 },
  coreHashtags: brand.voice.coreHashtags ?? [],
  onCamera: brand.voice.onCamera,
};

export const CTA = brand.cta;
export const LOOK = brand.look;
export const CONSENT = brand.consent;

/**
 * Checks a caption against her voice rules.
 *
 * Returns findings rather than throwing — the Critic decides severity. Voice is
 * a warning, not a blocker: it is her account and her call.
 */
export function voiceViolations(text) {
  const found = [];

  for (const banned of VOICE.avoid) {
    // Config mixes literal words with descriptions like "excessive emoji";
    // only the word-shaped entries can be matched directly.
    if (!/^[a-z0-9 '!]+$/i.test(banned)) continue;
    const escaped = banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');
    if (re.test(text)) {
      found.push({ term: banned, why: 'on the brand’s avoid list' });
    }
  }

  if (/!{2,}/.test(text)) {
    found.push({ term: '!!', why: 'exclamation stacking — she does not write this way' });
  }

  // K18, DM, VIC and AU are legitimate; anything else in caps is shouting.
  const caps = text.replace(/\b(K18|DM|CTA|VIC|AU|IG)\b/g, '');
  if (/\b[A-Z]{4,}\b/.test(caps)) {
    found.push({ term: 'ALL CAPS', why: 'shouting is off-brand' });
  }

  const emoji = [...text].filter((c) => /\p{Extended_Pictographic}/u.test(c));
  if (emoji.length > VOICE.emojiMax) {
    found.push({
      term: `${emoji.length} emoji`,
      why: `brand config caps emoji at ${VOICE.emojiMax}`,
    });
  }

  return found;
}

/**
 * Southern-hemisphere seasons.
 *
 * Melbourne, not the northern default. Getting this backwards is the standard
 * way an automated content system embarrasses an Australian business.
 */
export const SEASONS = [
  { months: [12, 1, 2], name: 'Summer', angles: ['sun and chlorine protection', 'beach-proof blonde', 'party season colour', 'holiday-ready gloss'] },
  { months: [3, 4, 5], name: 'Autumn', angles: ['going warmer for the cooler months', 'copper and caramel tones', 'post-summer repair'] },
  { months: [6, 7, 8], name: 'Winter', angles: ['dimensional brunette', 'gloss for dull winter light', 'scalp and dryness care', 'lowlights'] },
  { months: [9, 10, 11], name: 'Spring', angles: ['brightening up for spring', 'racing season hair', 'wedding season', 'pre-summer blonde build'] },
];

export function seasonFor(date = new Date()) {
  const m = date.getMonth() + 1;
  return SEASONS.find((s) => s.months.includes(m)) ?? SEASONS[0];
}

/** Melbourne calendar moments a local salon can hang content on. */
export const LOCAL_MOMENTS = [
  { month: 11, name: 'Spring Racing Carnival', angle: 'race day hair — book early, the week fills' },
  { month: 12, name: 'Christmas parties', angle: 'party season gloss and blow waves' },
  { month: 2, name: 'Wedding season', angle: 'bridal trials and guest hair' },
  { month: 9, name: 'Grand Final and early spring', angle: 'refresh before the warm months' },
];

export function momentsFor(date = new Date()) {
  const m = date.getMonth() + 1;
  return LOCAL_MOMENTS.filter((x) => x.month === m || x.month === m + 1);
}

export default {
  BUSINESS,
  SERVICES,
  VOICE,
  CTA,
  LOOK,
  CONSENT,
  SEASONS,
  LOCAL_MOMENTS,
  allServices,
  serviceById,
  slugFor,
  heroServices,
  priceLabel,
  durationLabel,
  seasonFor,
  momentsFor,
  voiceViolations,
};
