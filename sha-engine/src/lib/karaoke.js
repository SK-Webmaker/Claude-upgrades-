import { hexToAss } from './subtitles.js';

/**
 * Word-synced ("karaoke") captions.
 *
 * Every serious short-form clipping tool converges on this: captions that
 * highlight word by word as they are spoken hold attention far better than a
 * static block of text, and on a muted feed they are the only thing carrying
 * the message. Since Sha is on camera with voice, her actual words drive the
 * captions rather than copy written in advance.
 *
 * Implemented with ASS \k timing inside a grouped line, so the whole phrase
 * stays on screen while the spoken word lights up — the pattern viewers read
 * as "captions" rather than the one-word-at-a-time flicker that makes a clip
 * feel cheap.
 */

/**
 * Group a flat word list into readable lines.
 *
 * Lines break on natural pauses first, then on length. A caption that runs
 * past the safe area or changes every 300ms is worse than no caption.
 */
export function groupWords(words, { maxChars = 28, maxWords = 5, pauseSec = 0.45, maxLineSec = 3.0 } = {}) {
  const lines = [];
  let current = [];

  const flush = () => {
    if (current.length) {
      lines.push(current);
      current = [];
    }
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = words[i - 1];

    // A real pause in speech is the most natural place to break a line.
    if (prev && w.start - prev.end >= pauseSec) flush();

    const projected = [...current, w];
    const chars = projected.map((x) => x.word).join(' ').length;
    const span = w.end - (projected[0]?.start ?? w.start);

    if (current.length && (chars > maxChars || projected.length > maxWords || span > maxLineSec)) {
      flush();
    }
    current.push(w);
  }
  flush();

  return lines
    .filter((l) => l.length)
    .map((line) => ({
      start: line[0].start,
      end: line[line.length - 1].end,
      words: line,
      text: line.map((w) => w.word).join(' '),
    }));
}

/**
 * ASS \k durations are in centiseconds and are *relative* — each one starts
 * where the previous ended. Gaps between words have to be padded or the
 * highlight drifts out of sync with the audio partway through a line.
 */
export function buildKaraokeLine(line, { highlight }) {
  const parts = [];
  let cursor = line.start;

  for (const w of line.words) {
    const gap = Math.max(0, w.start - cursor);
    if (gap > 0.02) parts.push(`{\\k${Math.round(gap * 100)}}`);
    const dur = Math.max(1, Math.round((w.end - Math.max(w.start, cursor)) * 100));
    parts.push(`{\\kf${dur}}${w.word} `);
    cursor = w.end;
  }

  // \2c is the pre-highlight (secondary) colour that \kf sweeps away from.
  return `{\\2c${highlight}}${parts.join('').trim()}`;
}

function assTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.round((s - Math.floor(s)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Full ASS document with karaoke lines plus any fixed captions (a hook card,
 * a price, a CTA) layered above them.
 */
export function buildKaraokeAss({ lines, fixed = [], look, video }) {
  const marginV = Math.round(video.height * (look.safeAreaBottomPct / 100));
  const marginH = Math.round(video.width * 0.075);
  const font = look.captionFontName || 'DejaVu Sans';
  const size = look.captionFontSize;
  const highlight = hexToAss(look.accent || '#B07C33');

  const styles = [
    `Style: Karaoke,${font},${size},${hexToAss(look.captionPrimary)},${highlight},` +
      `${hexToAss(look.captionOutline)},${hexToAss('#000000', 60)},-1,0,0,0,100,100,0.5,0,1,5,1,2,` +
      `${marginH},${marginH},${marginV},1`,
    `Style: Hook,${font},${Math.round(size * 1.28)},${hexToAss(look.captionPrimary)},${hexToAss(look.captionPrimary)},` +
      `${hexToAss(look.captionOutline)},${hexToAss('#000000', 60)},-1,0,0,0,100,100,0.8,0,1,6,1,8,` +
      `${marginH},${marginH},${Math.round(video.height * (look.safeAreaTopPct / 100))},1`,
  ];

  const events = [];
  for (const line of lines) {
    events.push(
      `Dialogue: 0,${assTime(line.start)},${assTime(line.end)},Karaoke,,0,0,0,,` +
      buildKaraokeLine(line, { highlight })
    );
  }
  for (const cap of fixed) {
    const text = String(cap.text).replace(/[{}]/g, '').replace(/\r?\n/g, '\\N').trim();
    events.push(
      `Dialogue: 1,${assTime(cap.start)},${assTime(cap.end)},Hook,,0,0,0,,${text}`
    );
  }

  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${video.width}`,
    `PlayResY: ${video.height}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    ...styles,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\n');
}

/**
 * Shift word timings to match a cut.
 *
 * The transcript is timed against the *source*, but the render keeps only
 * selected segments and then speeds part of it up. Without remapping, captions
 * drift further out of sync the longer the clip runs — the single most common
 * way an automated caption pipeline produces unusable output.
 */
export function remapWords(words, segments, { rampAfterSecond, rampFactor, ramped }) {
  const out = [];
  let elapsed = 0;

  for (const seg of segments) {
    const segLen = seg.end - seg.start;
    for (const w of words) {
      if (w.start >= seg.start && w.end <= seg.end) {
        let start = elapsed + (w.start - seg.start);
        let end = elapsed + (w.end - seg.start);

        if (ramped && rampFactor > 1) {
          const compress = (t) =>
            t <= rampAfterSecond ? t : rampAfterSecond + (t - rampAfterSecond) / rampFactor;
          start = compress(start);
          end = compress(end);
        }
        out.push({ ...w, start: Number(start.toFixed(3)), end: Number(end.toFixed(3)) });
      }
    }
    elapsed += segLen;
  }
  return out.sort((a, b) => a.start - b.start);
}

export default { groupWords, buildKaraokeAss, buildKaraokeLine, remapWords };
