import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Where state lives.
 *
 * DATA_DIR points this at a mounted disk. Without it everything is written
 * under the repo, which on an ephemeral host means the store is wiped on every
 * deploy — the account review, the week's plan and the approval queue all
 * disappear, and the system cannot learn across releases because it never
 * remembers a previous week.
 */
const DATA = process.env.DATA_DIR || join(ROOT, 'data');

export const paths = {
  root: ROOT,
  config: join(ROOT, 'config'),
  data: DATA,
  inbox: join(DATA, 'inbox'),
  footage: join(DATA, 'footage'),
  renders: join(DATA, 'renders'),
  state: join(DATA, 'state'),
  logs: join(DATA, 'logs'),
};

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export const brand = readJson(join(paths.config, 'brand.json'));
export const system = readJson(join(paths.config, 'system.json'));

/**
 * Credentials come from the environment only — never from a committed file.
 * Every value is optional at load time so the pipeline can run end to end in
 * dry-run mode before any account has been connected.
 */
export const creds = {
  instagram: {
    userId: process.env.IG_USER_ID || null,
    accessToken: process.env.IG_ACCESS_TOKEN || null,
  },
  tiktok: {
    accessToken: process.env.TIKTOK_ACCESS_TOKEN || null,
    clientKey: process.env.TIKTOK_CLIENT_KEY || null,
  },
  firecrawl: {
    apiKey: process.env.FIRECRAWL_API_KEY || null,
  },
  publicMediaBaseUrl: process.env.PUBLIC_MEDIA_BASE_URL || null,
};

/** Which capabilities are actually live right now. */
export function capabilities() {
  return {
    instagramPublish: Boolean(creds.instagram.userId && creds.instagram.accessToken && creds.publicMediaBaseUrl),
    tiktokPublish: Boolean(creds.tiktok.accessToken),
    tiktokDirectPost: Boolean(creds.tiktok.accessToken && system.publishing.tiktok.auditPassed),
    liveResearch: Boolean(creds.firecrawl.apiKey),
    bookingUrlSet: brand.business.bookingUrl && !brand.business.bookingUrl.startsWith('TODO'),
    consentPolicySet: brand.consent.policy && !brand.consent.policy.startsWith('TODO'),
  };
}

/** Fail loudly rather than posting into the void. */
export function assertCapability(name) {
  const caps = capabilities();
  if (!caps[name]) {
    throw new Error(
      `Capability "${name}" is not available yet. Run \`sha doctor\` to see exactly what is missing.`
    );
  }
}

export function configExists() {
  return existsSync(join(paths.config, 'brand.json'));
}
