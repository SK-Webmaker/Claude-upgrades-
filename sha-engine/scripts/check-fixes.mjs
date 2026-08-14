#!/usr/bin/env node
/**
 * Runs every replacement caption in CAPTION-FIXES.md back through the Critic.
 *
 * The doc claims all 20 are clean. This is what makes that claim checkable —
 * and it is how the two lowercase-tag defects were found in the first place,
 * by re-running the audit after the rule learned to see them.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCaption } from '../src/lib/pack.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const doc = readFileSync(join(ROOT, 'CAPTION-FIXES.md'), 'utf8');
const blocks = [...doc.matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => m[1]);

let bad = 0;
blocks.forEach((text, i) => {
  const lines = text.split('\n');
  const tagLine = lines.findLastIndex((l) => l.trim().startsWith('#'));
  const hashtags = tagLine === -1 ? [] : lines[tagLine].trim().split(/\s+/);
  const body = lines.slice(0, tagLine === -1 ? undefined : tagLine).join('\n').trim();
  const problems = checkCaption({ hook: '', body, hashtags });
  if (problems.length) { bad++; console.log(`#${i + 1}: ${problems.join('; ')}`); }
});

console.log(`${blocks.length} replacement captions, ${bad} with problems`);
process.exit(bad ? 1 : 0);
