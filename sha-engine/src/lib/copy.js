import { BUSINESS, SERVICES, priceLabel, durationLabel } from './brand.js';

/**
 * Audience-facing caption bodies.
 *
 * Kept separate from the format library on purpose. A format's `why` is internal
 * strategy — "highest-intent format for colour, prospective clients are buying
 * the outcome" — and it is written for whoever is reading the ranking, not for
 * Sha's clients. Wiring `why` into a caption published that reasoning verbatim,
 * which is the same class of mistake as the "Alt caption (shorter, quieter
 * tone)" text that reached her live feed.
 *
 * Everything here is written in her register: first person, understated,
 * consultative, no hype.
 */

const BODIES = {
  transformation_reveal: [
    'Full head of foils, toned soft and creamy. We took it slow so the blonde stays healthy and grows out without a hard line.',
    'A colour built to last past the appointment — dimensional, lived-in, and easy to maintain between visits.',
    'Foils through the whole head, then toned to take the yellow out. The goal was bright but still soft.',
  ],
  contrast_hook: [
    'No cut, no extensions. Just colour placed where it does the most work.',
    'Same length, same base — the difference is dimension and where the light lands.',
    'One appointment. Nothing removed, only rearranged.',
  ],
  process_satisfying: [
    'Sectioning decides everything. Get this part wrong and no toner saves it.',
    'The part nobody sees, and the part that actually makes the blonde.',
    'Placement first, colour second. This is where the result is made.',
  ],
  education_myth: [
    'Going platinum in one sitting is how hair breaks. We lift gradually, check the hair as we go, and stop when it says stop.',
    'Brassiness is not your fault — it is water, sun, and time. It is also fixable in 45 minutes with a toner.',
    'Box dye is not the problem. Layers of box dye at different ages is the problem, because it lifts unevenly.',
  ],
  price_transparency: [
    'You are not paying for the colour. You are paying for the hours, the products, and knowing when to stop.',
    'Quotes vary because appointments vary. Ask what is included — toner and blow wave should be.',
    'Here is exactly what a full head costs and how long it takes, so you can plan around it.',
  ],
  client_reaction: [
    'She had not seen it for three hours. This was the moment she did.',
    'The best part of the job, every time.',
    'I ask them not to look until it is finished. This is why.',
  ],
  maintenance_tips: [
    'Your colour should still look good weeks from now. Most of that is what happens at home.',
    'Small changes to how you wash it make the difference between six weeks and twelve.',
    'What I actually recommend after a colour — not a product list, just what works.',
  ],
  product_feature: [
    'K18 works on the bond itself rather than coating the outside, which is why hair feels different afterwards and stays that way.',
    'The treatment I put through every blonde. Fifteen minutes in the chair, and you feel it for weeks.',
    'This is what I reach for when hair has been through a lot.',
  ],
  booking_urgency: [
    'One colour appointment open this week. If you have been meaning to book, this is the easy one to take.',
    'A quiet afternoon slot just opened up — enough time for a full colour without rushing.',
    'One cancellation this week. First to message gets it.',
  ],
  seasonal_angle: [
    'Worth planning your colour around the season rather than fixing it afterwards.',
    'The weather does predictable things to blonde. Easier to get ahead of it than to correct it later.',
    'Booking around the season means your colour looks intentional rather than grown out.',
  ],
  service_spotlight: [
    'Knowing which one to book is half the problem. Here is the difference, plainly.',
    'If you are not sure what to book, book the consult — it is free and it takes fifteen minutes.',
    'Different techniques, different results, different maintenance. Worth knowing before you choose.',
  ],
  offer_promo: [
    'Included with any blonde transformation this month. Same appointment, same time in the chair.',
    'A small thing that makes a real difference to how the hair feels afterwards.',
    'On the books for this month only, and it applies to new and existing clients.',
  ],
  new_client_welcome: [
    'A first appointment starts with a consult — reference photos, an honest conversation about what your hair can do, and a plan we agree on before anything starts.',
    'Nervous about a new salon is normal. Here is the whole process so there are no surprises.',
    'The consult is free and there is no pressure to book on the day.',
  ],
  aftercare_routine: [
    'Everything here is what I tell clients in the chair. Save it for after your next appointment.',
    'None of this is complicated. It is mostly about water temperature and how often you wash.',
    'Do these and your colour holds its tone considerably longer.',
  ],
};

/**
 * A body line for a format, filled with real service facts where the format
 * calls for them.
 */
export function bodyFor(format, { index = 0, season = null, service = null, asset = null } = {}) {
  if (asset?.notes) return asset.notes;

  const pool = BODIES[format.id];
  let body = pool ? pool[index % pool.length] : null;

  if (!body) {
    // No copy written for this format yet — say something true and plain rather
    // than falling back to internal strategy text.
    body = `Real client work, start to finish, in ${BUSINESS.serviceSuburbs[0]}.`;
  }

  if (format.usesService && service) {
    body = `${service.name} — ${durationLabel(service)} in the chair, from ${priceLabel(service)}. ${body}`;
  }

  if (format.season && season) {
    const angle = season.angles[index % season.angles.length];
    body = `${season.name} in Melbourne: ${angle}. ${body}`;
  }

  return body;
}

export { BODIES, SERVICES };
