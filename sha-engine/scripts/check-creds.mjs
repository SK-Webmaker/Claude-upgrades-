#!/usr/bin/env node
/**
 * Checks the credentials before anything tries to use them.
 *
 * This exists because getting the wrong Composio key has now cost hours twice.
 * Composio issues two shapes and only one of them works against the REST API:
 *
 *   ak_...  Settings → Project Settings → API Keys   ← the one that works
 *   ck_...  the account-level API Keys page          ← 401s on every endpoint
 *
 * A ck_ key does not fail loudly in an obvious place. /connected_accounts
 * answers 200 with an empty list, which reads as "no Instagram connected"
 * rather than "wrong key", and sends you looking in the wrong direction.
 * So this checks a endpoint that does hard-fail, and says which shape it saw.
 *
 *   node scripts/check-creds.mjs
 */
const BASE = process.env.COMPOSIO_BASE_URL || 'https://backend.composio.dev';
const KEY = process.env.COMPOSIO_API_KEY || '';
const ACCOUNT = process.env.COMPOSIO_CONNECTED_ACCOUNT_ID || '';
const USER = process.env.COMPOSIO_USER_ID || 'sha';

const ok = (m) => console.log(`  \x1b[32mok\x1b[0m    ${m}`);
const bad = (m) => console.log(`  \x1b[31mfail\x1b[0m  ${m}`);
const warn = (m) => console.log(`  \x1b[33mwarn\x1b[0m  ${m}`);
const mask = (k) => (k.length > 8 ? `${k.slice(0, 3)}…${k.slice(-4)}` : '(short)');

console.log('\n  Gloss — credential check\n');

let fatal = false;

if (!KEY) {
  bad('COMPOSIO_API_KEY is not set');
  console.log('        Put it in sha-engine/.env — see .env.example\n');
  process.exit(1);
}

if (KEY.startsWith('ck_')) {
  bad(`COMPOSIO_API_KEY looks like an account-level key (${mask(KEY)})`);
  console.log('        ck_ keys 401 on every REST endpoint. You need the ak_ key from');
  console.log('        app.composio.dev → Settings → Project Settings → API Keys.\n');
  fatal = true;
} else if (KEY.startsWith('ak_')) {
  ok(`COMPOSIO_API_KEY is a project key (${mask(KEY)})`);
} else {
  warn(`COMPOSIO_API_KEY has an unfamiliar prefix (${mask(KEY)}) — trying it anyway`);
}

// Hit an endpoint that hard-fails on a bad key, rather than one that returns
// an empty list and looks like a configuration problem instead of an auth one.
try {
  const res = await fetch(`${BASE}/api/v3/toolkits?limit=1`, { headers: { 'x-api-key': KEY } });
  if (res.status === 401) {
    bad('Composio rejected the key (401)');
    console.log('        Regenerate from Project Settings, not the account API Keys page.');
    fatal = true;
  } else if (!res.ok) {
    warn(`Composio answered ${res.status} — not an auth failure, but not healthy either`);
  } else {
    ok('Composio accepted the key');
  }
} catch (err) {
  bad(`Could not reach Composio: ${err.message}`);
  fatal = true;
}

if (!fatal) {
  try {
    const res = await fetch(`${BASE}/api/v3/connected_accounts`, { headers: { 'x-api-key': KEY } });
    const body = await res.json();
    const items = body.items || body.data || [];
    const insta = items.filter((a) =>
      String(a.toolkit?.slug || a.appName || '').toLowerCase().includes('instagram'),
    );

    if (!items.length) {
      bad('The key is valid but its project has no connected accounts');
      console.log('        Connect Instagram in that same project, then re-run this.');
    } else if (!insta.length) {
      bad(`${items.length} connected account(s), none of them Instagram`);
      for (const a of items) console.log(`        · ${a.toolkit?.slug || a.appName} — ${a.id}`);
    } else {
      for (const a of insta) {
        const live = String(a.status || '').toUpperCase() === 'ACTIVE';
        (live ? ok : warn)(`Instagram connected account ${a.id} — status ${a.status}`);
        if (!ACCOUNT) {
          console.log(`        Set COMPOSIO_CONNECTED_ACCOUNT_ID=${a.id}`);
        } else if (ACCOUNT !== a.id) {
          warn(`COMPOSIO_CONNECTED_ACCOUNT_ID is ${ACCOUNT}, but the live one is ${a.id}`);
        }
      }
    }
  } catch (err) {
    warn(`Could not list connected accounts: ${err.message}`);
  }
}

ok(`COMPOSIO_USER_ID = ${USER}`);
console.log(
  process.env.FIRECRAWL_API_KEY
    ? '  \x1b[32mok\x1b[0m    FIRECRAWL_API_KEY set — research runs live'
    : '  \x1b[33mwarn\x1b[0m  FIRECRAWL_API_KEY not set — research falls back to web search (fine)',
);

console.log(
  fatal
    ? '\n  Not ready. Fix the above, then run this again.\n'
    : '\n  Ready. Run /start.\n',
);
process.exit(fatal ? 1 : 0);
