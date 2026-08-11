import { mkdirSync, readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

/**
 * The Librarian.
 *
 * Takes what Sha drops into the uploads directory and turns it into library
 * entries the Producer can pair with a format. Every asset gets a public HTTPS
 * URL, because Meta fetches media server-side — a local path is unpublishable.
 *
 * Sidecar metadata is optional: dropping `myclip.mp4` alone works, and adding
 * `myclip.json` lets her tag the format, notes and alt text.
 */

const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export function publicUrlFor(filename, baseUrl = process.env.PUBLIC_BASE_URL) {
  if (!baseUrl) {
    throw new Error(
      'PUBLIC_BASE_URL is not set — Instagram cannot fetch media without a public HTTPS URL',
    );
  }
  return `${baseUrl.replace(/\/$/, '')}/media/${encodeURIComponent(filename)}`;
}

export function classify(filename) {
  const ext = extname(filename).toLowerCase();
  if (VIDEO_EXT.has(ext)) return { kind: 'video', mediaType: 'REELS' };
  if (IMAGE_EXT.has(ext)) return { kind: 'image', mediaType: 'IMAGE' };
  return null;
}

export async function runLibrarian({
  uploadsDir = process.env.UPLOADS_DIR || join(process.cwd(), 'src', 'data', 'uploads'),
  baseUrl = process.env.PUBLIC_BASE_URL,
  readJson = defaultReadJson,
} = {}) {
  mkdirSync(uploadsDir, { recursive: true });

  const files = readdirSync(uploadsDir).filter((f) => !f.startsWith('.') && classify(f));

  // Fail loudly rather than emitting assets with no URL. A library entry Meta
  // cannot fetch is not a usable asset, and a null URL would only surface later
  // as a confusing Critic block.
  if (files.length && !baseUrl) {
    throw new Error(
      'PUBLIC_BASE_URL is not set — Instagram cannot fetch media without a public HTTPS URL',
    );
  }

  const library = [];

  for (const file of files) {
    const info = classify(file);
    const stem = basename(file, extname(file));
    const sidecar = readJson(join(uploadsDir, `${stem}.json`)) ?? {};

    // Assets are real client work unless the sidecar explicitly says otherwise.
    const origin = sidecar.origin ?? 'real';
    const depicts = sidecar.depicts ?? 'client_result';

    library.push({
      id: stem,
      file,
      mediaType: sidecar.mediaType ?? info.mediaType,
      format: sidecar.format ?? null,
      notes: sidecar.notes ?? null,
      altText: sidecar.altText ?? null,
      coverUrl: sidecar.coverUrl ?? null,
      vars: sidecar.vars ?? {},
      uploadedAt: statSync(join(uploadsDir, file)).mtime.toISOString(),
      media: [{ url: publicUrlFor(file, baseUrl), kind: info.kind, origin, depicts }],
    });
  }

  library.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));
  return { library };
}

function defaultReadJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}
