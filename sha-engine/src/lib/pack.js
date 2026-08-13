import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brand } from './config.js';
import { bareTags, draftArtifact } from '../stages/gate.js';
import { voiceViolations } from './brand.js';

/**
 * The week's authored pack: three finished posts and the video guides.
 *
 * These are written by hand — by me, looking at what the account actually did
 * last week and at what is working on comparable accounts — and committed to
 * the repo. The generator in stages/brief.js can lay out a week's shape from
 * rules, but it cannot decide that this is the week to publish a price, and it
 * cannot judge whether a hook is worth sending to a friend. So the pack is the
 * strategy layer and the engine is the delivery and scoring layer.
 *
 * Packs live in content/, not data/. data/ is a mounted disk on Render and its
 * contents are whatever the running service has written; content/ ships with
 * the deploy and is the same on every machine.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKS = join(HERE, '..', '..', 'content', 'packs');
export const CARDS = join(HERE, '..', '..', 'content', 'cards');

/** Monday of the week a date falls in, as YYYY-MM-DD. */
export function weekOf(date = new Date()) {
  const d = new Date(date);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

function list() {
  if (!existsSync(PACKS)) return [];
  return readdirSync(PACKS)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .sort();
}

/** The caption as it goes into the Instagram box, hashtags and all. */
export function fullCaption(caption, bookingUrl = brand.business.bookingUrl) {
  const parts = [caption.hook, caption.body, caption.cta];
  if (bookingUrl && caption.cta) parts.push(bookingUrl);
  parts.push((caption.hashtags || []).join(' '));
  return parts.filter(Boolean).join('\n\n');
}

/**
 * Every rule the Critic applies to text, applied to a pack item.
 *
 * The media rules (aspect, duration, burned-in captions) do not apply to a
 * still card or to a guide that has not been filmed yet, so this is the text
 * subset rather than gate.evaluate. Nothing here is advisory: a pack that
 * trips a blocker does not load.
 */
export function checkCaption(caption) {
  const post = { caption };
  const problems = [];

  const bare = bareTags(post);
  if (bare.length) problems.push(`hashtags missing their "#": ${bare.join(', ')}`);

  const artifact = draftArtifact(post);
  if (artifact) problems.push(`drafting leftover: "${artifact}"`);

  const { min, max } = brand.voice.hashtagCount;
  const n = (caption.hashtags || []).length;
  if (n < min || n > max) problems.push(`${n} hashtags, brand config asks for ${min}-${max}`);

  const untagged = (caption.hashtags || []).filter((h) => !h.startsWith('#'));
  if (untagged.length) problems.push(`hashtags without a "#": ${untagged.join(', ')}`);

  for (const v of voiceViolations([caption.hook, caption.body, caption.cta].filter(Boolean).join('\n'))) {
    problems.push(`voice: "${v.term}" is ${v.why}`);
  }

  return problems;
}

function hydrate(raw, name) {
  const bookingUrl = brand.business.bookingUrl;
  const problems = [];

  const posts = (raw.posts || []).map((p) => {
    const found = checkCaption(p.caption);
    if (found.length) problems.push(`${name}/${p.id}: ${found.join('; ')}`);
    return {
      ...p,
      caption: { ...p.caption, bookingUrl, full: fullCaption(p.caption, bookingUrl) },
      imageUrl: `/card/${p.image}`,
      imageReady: existsSync(join(CARDS, p.image)),
    };
  });

  const videoGuides = (raw.videoGuides || []).map((g) => {
    const found = checkCaption(g.caption);
    if (found.length) problems.push(`${name}/${g.id}: ${found.join('; ')}`);
    return { ...g, caption: { ...g.caption, bookingUrl, full: fullCaption(g.caption, bookingUrl) } };
  });

  if (problems.length) {
    throw new Error(`pack rejected by the Critic — ${problems.join(' | ')}`);
  }

  const missing = posts.filter((p) => !p.imageReady).map((p) => p.image);
  return {
    ...raw,
    posts,
    videoGuides,
    missingImages: missing,
    // A pack with an unrendered card is still usable — the caption is finished
    // and the console says which image has not been made yet — so this is
    // reported rather than thrown.
    complete: missing.length === 0,
  };
}

/** The pack for a given week, or the most recent one on or before it. */
export function forWeek(week = weekOf()) {
  const names = list();
  if (!names.length) return null;
  const name = [...names].reverse().find((n) => n <= week);
  if (!name) return null;
  const raw = JSON.parse(readFileSync(join(PACKS, `${name}.json`), 'utf8'));
  return hydrate(raw, name);
}

export function current() {
  return forWeek(weekOf());
}

export default { current, forWeek, weekOf, fullCaption, checkCaption, CARDS };
