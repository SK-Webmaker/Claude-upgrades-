import { createWriteStream, mkdirSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { paths } from '../lib/config.js';
import { makeLogger } from '../lib/log.js';

const log = makeLogger('upload');

const ALLOWED = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.hevc', '.3gp']);
const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB — a long 4K phone clip

/**
 * Multipart upload, parsed by hand.
 *
 * A dependency-free parser is worth it here: this is the one surface Sha
 * touches from her phone, and it needs to keep working without anyone
 * maintaining a package tree. It streams straight to disk rather than
 * buffering, so a 1.5 GB clip from an iPhone does not have to fit in memory.
 */

function findBoundary(contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  return m ? (m[1] || m[2]).trim() : null;
}

function safeName(name) {
  const base = basename(String(name)).replace(/[^\w.\- ]+/g, '_').slice(0, 120);
  return base || `clip_${Date.now()}.mp4`;
}

/**
 * Parse a multipart body, writing any file parts into the inbox.
 *
 * Buffers are scanned for the boundary rather than converting to string,
 * because video bytes are not valid UTF-8 and a string round trip corrupts
 * them. This is the bug that makes most hand-rolled parsers produce files
 * that look right in size but will not decode.
 */
export function receiveUpload(req) {
  return new Promise((resolve, reject) => {
    const boundary = findBoundary(req.headers['content-type']);
    if (!boundary) return reject(new Error('Not a multipart upload'));

    if (!existsSync(paths.inbox)) mkdirSync(paths.inbox, { recursive: true });

    const delim = Buffer.from(`--${boundary}`);
    const saved = [];
    const rejected = [];

    let buffer = Buffer.alloc(0);
    let total = 0;
    let current = null; // { name, stream, path, bytes }
    let inPreamble = true;

    const closeCurrent = () => {
      if (!current) return;
      current.stream.end();
      if (ALLOWED.has(extname(current.path).toLowerCase())) {
        saved.push({ name: basename(current.path), bytes: current.bytes });
        log.ok(`received ${basename(current.path)} (${(current.bytes / 1048576).toFixed(1)} MB)`);
      } else {
        rejected.push({ name: basename(current.path), reason: 'not a video file' });
      }
      current = null;
    };

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BYTES) {
        req.destroy();
        return reject(new Error(`Upload exceeds ${MAX_BYTES / 1073741824} GB`));
      }
      buffer = Buffer.concat([buffer, chunk]);

      let idx;
      while ((idx = buffer.indexOf(delim)) !== -1) {
        if (current) {
          // Everything before the boundary belongs to the current file, minus
          // the CRLF that precedes the delimiter.
          const end = idx >= 2 ? idx - 2 : 0;
          if (end > 0) {
            current.stream.write(buffer.subarray(0, end));
            current.bytes += end;
          }
          closeCurrent();
        }
        inPreamble = false;

        // Move past the delimiter, then find the end of this part's headers.
        buffer = buffer.subarray(idx + delim.length);
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) break; // need more data

        const headers = buffer.subarray(0, headerEnd).toString('utf8');
        buffer = buffer.subarray(headerEnd + 4);

        const fileMatch = /filename="([^"]*)"/i.exec(headers);
        if (fileMatch && fileMatch[1]) {
          const name = safeName(fileMatch[1]);
          const target = join(paths.inbox, `${Date.now()}-${name}`);
          current = { path: target, stream: createWriteStream(target), bytes: 0 };
        }
      }

      // Keep a tail long enough that a boundary split across chunks is still
      // found on the next pass.
      if (current && buffer.length > delim.length + 4) {
        const keep = delim.length + 4;
        const flush = buffer.subarray(0, buffer.length - keep);
        current.stream.write(flush);
        current.bytes += flush.length;
        buffer = buffer.subarray(buffer.length - keep);
      } else if (!current && !inPreamble && buffer.length > delim.length + 4) {
        buffer = buffer.subarray(buffer.length - (delim.length + 4));
      }
    });

    req.on('end', () => {
      closeCurrent();
      resolve({ saved, rejected, totalBytes: total });
    });
    req.on('error', reject);
  });
}

export default { receiveUpload };
