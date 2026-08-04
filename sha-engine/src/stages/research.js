import { brand, system, creds, capabilities } from '../lib/config.js';
import { makeLogger } from '../lib/log.js';
import * as store from '../lib/store.js';

const log = makeLogger('research');

/**
 * Where the trend signal comes from.
 *
 * TikTok Creative Center is the primary source: it is official TikTok data,
 * free, needs no ad account, and filters by country — so we can ask what is
 * trending in Australia specifically rather than inheriting US trends that
 * nobody in Camberwell is seeing.
 *
 * Firecrawl does the fetching. When it is not connected the stage still runs,
 * falling back to the salon's own learned history so the pipeline never
 * blocks — it just says so loudly rather than pretending it has fresh data.
 */

const HAIR_TERMS = [
  'hair', 'hairdresser', 'hairstylist', 'balayage', 'blonde', 'brunette',
  'colour', 'color', 'salon', 'toner', 'highlights', 'foils', 'greyblending',
  'hairtransformation', 'haircare', 'bond', 'olaplex', 'k18',
];

function looksRelevant(text) {
  const t = String(text || '').toLowerCase();
  return HAIR_TERMS.some((term) => t.includes(term));
}

/** Firecrawl scrape via MCP is injected by the caller so this stays testable. */
async function fetchCreativeCenter(scrape, url, label) {
  try {
    const res = await scrape(url);
    const text = typeof res === 'string' ? res : res?.markdown || res?.content || '';
    if (!text) throw new Error('empty response');
    return { label, url, text, ok: true };
  } catch (err) {
    log.warn(`could not read ${label}: ${err.message}`);
    return { label, url, text: '', ok: false, error: err.message };
  }
}

/**
 * Pull hashtag and sound candidates out of scraped Creative Center markdown.
 * Deliberately forgiving — the page layout changes and we would rather return
 * fewer good rows than crash the weekly run.
 */
export function parseTrends(text, kind) {
  if (!text) return [];
  const out = [];
  const seen = new Set();

  if (kind === 'hashtags') {
    const re = /#([A-Za-z0-9_]{3,40})/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const tag = m[1].toLowerCase();
      if (seen.has(tag)) continue;
      seen.add(tag);
      out.push({ kind: 'hashtag', value: `#${m[1]}`, relevant: looksRelevant(tag) });
    }
  } else {
    // Sounds appear as "Title - Artist" table rows.
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*\|?\s*([^|]{3,60}?)\s+[-–—]\s+([^|]{2,40}?)\s*\|?\s*$/);
      if (!m) continue;
      const key = m[1].trim().toLowerCase();
      if (seen.has(key) || key.length < 3) continue;
      seen.add(key);
      out.push({ kind: 'sound', value: m[1].trim(), artist: m[2].trim(), relevant: true });
    }
  }
  return out;
}

/**
 * Score a trend for this specific salon. Relevance to hair beats raw
 * popularity — a globally trending gaming sound is worthless to a colourist,
 * and the memory of what has actually worked here outranks both.
 */
export function scoreTrend(trend, memory) {
  let score = trend.relevant ? 60 : 15;
  const mem = memory?.sounds?.[trend.value] || memory?.hooks?.[trend.value];
  if (mem?.avg) score += Math.max(-25, Math.min(40, mem.avg * 10));
  if (trend.kind === 'hashtag' && trend.value.length > 25) score -= 10;
  return Math.round(score);
}

/**
 * Formats that reliably work for a colour specialist. These are structural
 * templates, not copied content — the hook shape and pacing, which is the
 * part that is actually transferable between accounts.
 */
export const FORMAT_LIBRARY = [
  {
    id: 'brass-fix',
    type: 'transformation',
    name: 'The brass correction',
    hookPattern: 'She came in {problem}. Watch.',
    beats: ['before, held 1.5s', 'application, sped up', 'rinse', 'final reveal, slow'],
    needs: ['before', 'process', 'after'],
    why: 'Colour correction is the highest-intent search a colourist gets; the before frame does the qualifying.',
  },
  {
    id: 'grey-blend',
    type: 'transformation',
    name: 'Grey blending, not covering',
    hookPattern: 'You do not have to cover the grey.',
    beats: ['close on regrowth', 'placement', 'blended result'],
    needs: ['before', 'process', 'after'],
    why: 'Speaks directly to the busy-professional client who wants low maintenance.',
  },
  {
    id: 'why-brass',
    type: 'education',
    name: 'Why your blonde went brassy',
    hookPattern: 'Your blonde went orange. Here is why.',
    beats: ['talking head hook', 'explainer over process b-roll', 'what to do'],
    needs: ['talking', 'process'],
    why: 'Educational content is roughly 40% of high-performing salon accounts and earns saves, which weight heavily for bookings.',
  },
  {
    id: 'maintenance',
    type: 'education',
    name: 'Make it last twelve weeks',
    hookPattern: 'Three things wrecking your colour.',
    beats: ['hook to camera', 'three quick points', 'CTA'],
    needs: ['talking'],
    why: 'Save-bait that also pre-answers the objection that colour is high maintenance.',
  },
  {
    id: 'hands-craft',
    type: 'personality',
    name: 'Twenty years in the hands',
    hookPattern: 'Twenty years doing this and I still {detail}.',
    beats: ['close on hands working', 'ambient room', 'quiet result'],
    needs: ['process'],
    why: 'Builds the personal trust that actually converts a colour booking.',
  },
  {
    id: 'chair-open',
    type: 'offer',
    name: 'Chair is open',
    hookPattern: '{day} just opened up.',
    beats: ['best recent result', 'availability card', 'CTA'],
    needs: ['after'],
    why: 'Direct booking driver; capped so the feed never reads as an ad channel.',
  },
];

export async function run({ scrape = null } = {}) {
  log.start();
  try {
    const caps = capabilities();
    const memory = store.recallPatterns();
    const cc = system.research.creativeCenterUrls;

    let trends = [];
    let sources = [];

    if (caps.liveResearch && typeof scrape === 'function') {
      log.info(`fetching Creative Center for ${system.research.region}`);
      const [tags, songs] = await Promise.all([
        fetchCreativeCenter(scrape, cc.hashtags, 'hashtags'),
        fetchCreativeCenter(scrape, cc.songs, 'songs'),
      ]);
      sources = [tags, songs].map(({ text, ...s }) => s);
      trends = [
        ...parseTrends(tags.text, 'hashtags'),
        ...parseTrends(songs.text, 'songs'),
      ];
      log.info(`parsed ${trends.length} raw trend candidates`);
    } else {
      log.warn('Firecrawl not connected — running on learned history only, no fresh trend data');
      sources = [{ label: 'fallback', ok: false, error: 'FIRECRAWL_API_KEY not set or scrape fn not provided' }];
    }

    const scored = trends
      .map((t) => ({ ...t, score: scoreTrend(t, memory) }))
      .filter((t) => t.relevant || t.score > 50)
      .sort((a, b) => b.score - a.score)
      .slice(0, system.research.maxTrendsKept);

    // Rank the format library by what has actually performed for this salon.
    const formats = FORMAT_LIBRARY
      .map((f) => {
        const mem = memory.formats?.[f.id];
        return {
          ...f,
          timesUsed: mem?.n || 0,
          avgScore: mem?.avg ?? null,
          confidence: mem?.n >= system.scoring.minPostsBeforeTrust ? 'proven' : 'untested',
        };
      })
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));

    const brief = {
      generatedAt: new Date().toISOString(),
      region: system.research.region,
      live: caps.liveResearch,
      sources,
      items: scored,
      formats,
      keywords: brand.positioning.priorityKeywords,
      note: caps.liveResearch
        ? 'Trends are live from TikTok Creative Center, filtered to Australia.'
        : 'No live trend data this run. Formats are ranked purely on this salon’s own results.',
    };

    store.write('trends', brief);
    log.done({ trends: scored.length, formats: formats.length, live: caps.liveResearch });
    return brief;
  } catch (err) {
    log.fail(err);
    throw err;
  }
}

export default { run, parseTrends, scoreTrend, FORMAT_LIBRARY };
