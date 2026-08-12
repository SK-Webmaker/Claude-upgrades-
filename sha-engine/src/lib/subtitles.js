import { writeFileSync } from 'node:fs';

/**
 * Caption rendering goes through libass rather than ffmpeg's drawtext.
 *
 * drawtext is absent from many static ffmpeg builds (including the one npm
 * ships), and even where it exists it cannot wrap text, which matters a lot
 * for a caption that has to stay inside a 9:16 safe area. libass gives real
 * wrapping, outlines and margins, and is compiled into effectively every
 * build because subtitle burn-in is such a common need.
 */

/** ASS wants &HAABBGGRR — alpha first, then blue/green/red. */
export function hexToAss(hex, alphaPct = 0) {
  const h = String(hex).replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = full.slice(0, 2);
  const g = full.slice(2, 4);
  const b = full.slice(4, 6);
  const a = Math.round((alphaPct / 100) * 255).toString(16).padStart(2, '0');
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

function assTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.round((s - Math.floor(s)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** Newlines become ASS hard breaks; braces would open an override block. */
function assText(text) {
  return String(text)
    .replace(/[{}]/g, '')
    .replace(/\r?\n/g, '\\N')
    .trim();
}

/**
 * Build an ASS file for a set of timed captions.
 *
 * `look` carries brand type and colour; `video` carries the frame size so
 * margins can be expressed as a percentage of the real canvas.
 */
export function buildAss({ captions, look, video }) {
  const marginV = Math.round(video.height * (look.safeAreaBottomPct / 100));
  const marginH = Math.round(video.width * 0.075);
  const fontName = look.captionFontName || 'DejaVu Sans';

  const styles = [
    // Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour,
    // BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing,
    // Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
    `Style: Caption,${fontName},${look.captionFontSize},` +
      `${hexToAss(look.captionPrimary)},${hexToAss(look.captionPrimary)},` +
      `${hexToAss(look.captionOutline)},${hexToAss('#000000', 60)},` +
      `-1,0,0,0,100,100,0.6,0,1,5,1,2,${marginH},${marginH},${marginV},1`,
    `Style: Hook,${fontName},${Math.round(look.captionFontSize * 1.28)},` +
      `${hexToAss(look.captionPrimary)},${hexToAss(look.captionPrimary)},` +
      `${hexToAss(look.captionOutline)},${hexToAss('#000000', 60)},` +
      `-1,0,0,0,100,100,0.8,0,1,6,1,2,${marginH},${marginH},${marginV},1`,
  ];

  const events = captions.map((c) => {
    const style = c.style === 'hook' ? 'Hook' : 'Caption';
    return `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},${style},,0,0,0,,${assText(c.text)}`;
  });

  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${video.width}`,
    `PlayResY: ${video.height}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
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

export function writeAss(file, opts) {
  writeFileSync(file, buildAss(opts), 'utf8');
  return file;
}

/** ffmpeg filter values treat : and ' as syntax, so a path must be escaped. */
export function escapeFilterPath(p) {
  return String(p).replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}
