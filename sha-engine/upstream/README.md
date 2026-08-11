# upstream/ — code targeting the other branch

**Nothing in this directory runs on this branch.** It is staged here, unimported,
awaiting a decision about which codebase is the source of truth.

## Why it exists

The real `sha-engine` lives on `claude/auto-model-fresh-install-y2umbq` — the one
with `JOURNAL.md`, `plan.js`, `karaoke.js`, `analyse.js`, `config/`, and a
`lib/config.js` that loads brand and system JSON. That branch was not on the
remote when this branch's work started, so this branch reimplemented a subset of
the same system with different conventions.

`instagram-composio.js` here is written against **that** branch's interfaces:

- imports `../lib/config.js` (`creds`, `brand`) and `../lib/log.js` (`makeLogger`)
- exports the same surface as its `src/platforms/instagram.js` — `publish`,
  `preflight`, `buildCaption`, `quotaRemaining`, `fetchInsights`, `LIMITS` — so
  `ship.js` swaps one entry in its `ADAPTERS` map and nothing else changes

Those modules do not exist on this branch, so importing this file here throws.
It is deliberately kept out of `src/` for that reason.

## What it changes versus the Graph adapter it replaces

| | |
|---|---|
| Auth | Composio OAuth via `POST /api/v3/tools/execute/{slug}` with `x-api-key`, instead of a raw `creds.instagram.accessToken` |
| Photo posts | Branches on media type. The Graph adapter hardcoded `media_type: 'REELS'` and applied duration rules to everything — see below |
| Quota | Prefers the live read; the fallback constant is labelled as a fallback rather than asserted as the cap |
| Media | Verifies the URL is fetchable and serves the right content type before spending a container |
| Insights | Passes `metric` as an array — Composio rejects a comma-separated string |

## The photo-post bug it fixes

Reproduced against the real `src/platforms/instagram.js`:

```
photo post preflight: { "ok": false, "problems": ["0.0s is below the 3s minimum"] }
video post preflight: { "ok": true,  "problems": [] }
```

`preflight()` reads `post.render?.durationSec || 0`. Photo posts carry no
`render` block, so `d` is `0` and the `minDurationSec` check rejects them. Then
`publish()` hardcodes `media_type: 'REELS'` with `video_url: post.mediaUrl`, so a
photo would go out as a reel pointed at a JPEG even if preflight passed.

This matters because journal entry 2 retired the Editor and kept the Publisher
specifically because "photo posts still run the full ingest → approve → publish
path." Photo posts are the only thing the API path still ships, and it rejects
all of them. The Editor retirement and this duration check were never reconciled.

## Corrections to constraints recorded in the journal

Each verified live against the connected account on 2026-08-11.

**Instagram has no drafts.** The journal's "Current publishing posture" and the
task brief both describe content landing in Sha's Instagram drafts for her to
post there. Composio exposes only the container→publish pair; a container is
invisible in-app and expires in ~24h, and Meta has no save-to-drafts endpoint.
`requiresTap` is real for TikTok's inbox route (entry 1) but has no Instagram
equivalent. Publishing here is immediate and public, which makes the
`status === 'approved'` gate in `ship.js` the only thing between a queued post
and her audience.

**The 25-per-24h cap is wrong for this account.** Live read:
`quota_total: 100`, `quota_usage: 0`. Both `LIMITS.dailyPosts = 25` and
`config/system.json` → `dailyApiCap: 25` understate it 4×. `ship.js` already
prefers the live `quotaRemaining()`, so this only bites as the fallback — but
entry 8 calls 25 "verified against the 2026 API," and the project's standing rule
is no unverified numbers.

**The Facebook Page link is not required on this path.** That is a Facebook Login
requirement. This connection uses Instagram Login — the media edge pages against
`graph.instagram.com`. The account is `BUSINESS`, so publishing works regardless,
but the constraint as written does not apply here.

## To land it

On `claude/auto-model-fresh-install-y2umbq`: move this file to
`src/platforms/instagram-composio.js`, point `ship.js`'s `ADAPTERS.instagram` at
it, and keep `tests/agents.test.js` green.
