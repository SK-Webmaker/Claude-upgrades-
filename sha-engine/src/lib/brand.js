/**
 * Hair by Sha — brand truth.
 *
 * Every value here was read from a live source, not invented:
 *   - profile, bio, handle: Instagram Graph via Composio, 2026-08-11
 *   - address, phone, services, prices: her Kairo booking site, scraped 2026-08-11
 *   - voice rules: derived from her own published captions
 *
 * Prices are real and change. `pricesReadAt` is stamped so a caption built from
 * a stale menu can be spotted rather than quietly published.
 */

export const BUSINESS = {
  name: 'Hair by Sha',
  displayName: 'Hair by Sha | Camberwell',
  handle: 'hairbysha_c',
  instagram: 'https://www.instagram.com/hairbysha_c/',
  igUserId: '27461710323507831',
  address: '1 Prospect Hill Rd, Camberwell, Melbourne VIC 3124',
  phone: '0452 611 799',
  bookingUrl: 'https://hairbysha-booking.onrender.com/book',
  tagline: 'Crafting effortless beauty through personalised colour, style, and care.',
  positioning: 'Luxury blonde & colour specialist',
  specialties: ['Balayage', 'Foils', 'Colour transformations'],
  freeConsult: true,
  serviceSuburbs: [
    'Camberwell',
    'Hawthorn',
    'Glen Iris',
    'Kew',
    'Balwyn',
    'Canterbury',
    'Surrey Hills',
  ],
  stockists: ['ELEVEN Australia', 'K18'],
};

/**
 * Live service menu. Used by price-transparency and offer posts so a caption
 * never quotes a number that isn't on her booking page.
 */
export const SERVICES = {
  pricesReadAt: '2026-08-11',
  source: BUSINESS.bookingUrl,
  colour: [
    { id: 'balayage_lived_in', name: 'Balayage / Lived-in Blonde', from: 340, minutes: 210, note: 'Low-maintenance, seamless blonde. Includes toner and blow wave.' },
    { id: 'blonde_transformation', name: 'Blonde Transformation (Foils + Root + Cut)', from: 350, minutes: 240 },
    { id: 'blonde_transformation_k18', name: 'Blonde Transformation + K18', from: 420, minutes: 240 },
    { id: 'full_blonde', name: 'Full Blonde', from: 320, minutes: 210, note: 'Full head foils for maximum blonde impact. Includes toner and blow wave.' },
    { id: 'partial_blonde', name: 'Partial Blonde (Foils)', from: 240, minutes: 150, note: 'Soft brightness through the top and sides. Perfect for maintenance blondes.' },
    { id: 'root_refresh', name: 'Root Colour + Refresh', from: 150, minutes: 105, note: 'Regrowth colour with refreshed ends. Includes blow wave.' },
    { id: 'toner_gloss', name: 'Toner & Gloss', from: 45, minutes: 45 },
  ],
  cuts: [
    { id: 'cut_blow', name: 'Cut & Blow Wave', from: 110, minutes: 60 },
    { id: 'restyle', name: 'Restyle Cut', from: 140, minutes: 60 },
    { id: 'blow_wave', name: 'Blow Wave', from: 55, minutes: 45 },
  ],
  treatments: [
    { id: 'k18', name: 'K18 Treatment', from: 45, minutes: 15 },
    { id: 'deep_treatment', name: 'Deep Treatment', from: 30, minutes: 30 },
  ],
  extensions: [
    { id: 'ext_refit', name: 'Extensions Move Up / Refit', from: 300, minutes: 150 },
    { id: 'ext_removal', name: 'Extensions Removal', from: 100, minutes: 90 },
  ],
};

export function allServices() {
  return [...SERVICES.colour, ...SERVICES.cuts, ...SERVICES.treatments, ...SERVICES.extensions];
}

export function serviceById(id) {
  return allServices().find((s) => s.id === id) ?? null;
}

/** "$320" / "3.5 hours" — formatted the way her captions already read. */
export function priceLabel(service) {
  return `$${service.from}`;
}

export function durationLabel(service) {
  const h = service.minutes / 60;
  if (h < 1) return `${service.minutes} minutes`;
  return Number.isInteger(h) ? `${h} hour${h === 1 ? '' : 's'}` : `${h.toFixed(1)} hours`;
}

/**
 * Voice, derived from her own captions.
 *
 * The through-line is understatement. Her best-performing line is "Dimension
 * that doesn't scream for attention. Just quietly perfect." Nothing the engine
 * writes should be louder than she is.
 */
export const VOICE = {
  register: 'Warm, understated, quietly expert. Never hype.',
  person: 'First person singular. She is one stylist, not a team.',
  signatureEmoji: ['✨', '🤍', '📍', '💬'],
  emojiRule: 'One or two per caption, never a row of them. 🤍 is hers — use it on soft/blonde posts.',
  ownPhrases: [
    'creamy blonde',
    'dimensional',
    'lived-in',
    'grows out beautifully',
    'healthy blonde',
    'quietly perfect',
    'we talked it through properly first',
  ],
  values: [
    'Hair health over speed — she will not lift to platinum in one sitting and says so',
    'Consultation first, free, no pressure',
    'Colour that grows out well, not just colour that looks good today',
  ],
  avoid: [
    'OBSESSED', 'STUNNING', 'GORGEOUS', 'to die for', 'slay', 'bestie',
    'exclamation stacking (!!!)', 'ALL CAPS words',
    'discount language that cheapens the positioning — "cheap", "bargain"',
  ],
  signOff: `📍 ${BUSINESS.name}, Camberwell`,
};

/** Caption checks specific to her voice, layered on the Critic's generic rules. */
export function voiceViolations(text) {
  const found = [];
  for (const banned of VOICE.avoid) {
    if (!/^[a-z ]+$/i.test(banned)) continue;
    const re = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) found.push({ term: banned, why: 'off-brand for an understated luxury positioning' });
  }
  if (/!{2,}/.test(text)) found.push({ term: '!!', why: 'exclamation stacking — she does not write this way' });
  if (/\b[A-Z]{4,}\b/.test(text.replace(/\b(K18|DM|CTA|VIC)\b/g, ''))) {
    found.push({ term: 'ALL CAPS', why: 'shouting is off-brand' });
  }
  const emoji = [...text].filter((c) => /\p{Extended_Pictographic}/u.test(c));
  if (emoji.length > 4) found.push({ term: `${emoji.length} emoji`, why: 'one or two, never a row' });
  return found;
}

/**
 * Melbourne seasons, so seasonal posts land in the right hemisphere.
 * Getting this backwards is the classic mistake for AU salon content.
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
  { month: 9, name: 'Grand Final / spring', angle: 'refresh before the warm months' },
];

export function momentsFor(date = new Date()) {
  const m = date.getMonth() + 1;
  return LOCAL_MOMENTS.filter((x) => x.month === m || x.month === m + 1);
}

export default { BUSINESS, SERVICES, VOICE, SEASONS, LOCAL_MOMENTS, allServices, serviceById, priceLabel, durationLabel, seasonFor, momentsFor, voiceViolations };
