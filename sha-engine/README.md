# sha-engine

Growth marketing engine for **Hair by Sha** (@hairbysha_c, Camberwell, Melbourne).

It researches what's working, tells Sha exactly what to film, drafts the captions,
gates everything against a hard quality check, and publishes to Instagram — but
only after she taps approve.

## The flow

```
Analyst → Librarian → Scout → Producer → Critic → Publisher → [Sha taps] → Instagram
```

| Agent | Does |
|---|---|
| **Analyst** | Scores what already shipped, using her real Instagram insights |
| **Librarian** | Ingests media she uploads, hosts it at public HTTPS URLs |
| **Scout** | Ranks content formats against market research + her own results |
| **Producer** | Writes the weekly shoot brief and drafts every caption |
| **Critic** | Hard gate — blocks anything broken before it reaches her |
| **Publisher** | Queues for approval, publishes what she taps through |

Order is never hardcoded. Each agent declares `requires`/`produces` in
`src/agents/registry.js` and `src/agents/coordinator.js` topologically sorts them.

There is **no Editor stage**. Cutting raw video on a machine is what broke the
workflow before. Sha films and edits natively; the engine tells her what to shoot.

## Instagram has no API drafts — read this before changing the approval flow

The obvious design is "drop a draft in her Instagram and let her tap post". **That
is not possible.** Meta's API has no save-to-drafts endpoint; drafts are an in-app
feature only. Composio exposes exactly two publishing calls:

- `INSTAGRAM_POST_IG_USER_MEDIA` → creates a media **container**
- `INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH` → publishes that container

A container is an invisible server-side staging handle. It never appears in the
Instagram app, Sha cannot see or tap it, and it expires after ~24 hours.

So approval happens on **our own review page** before a container is ever created.
Same one-tap feel, and it actually works.

## The approval invariant

Nothing becomes public without Sha's explicit tap. Enforced in three independent
places, because any one alone would be a single point of failure:

1. `runPublisher` only queues — it never publishes
2. `publishApproved` only selects posts with status `approved` **and** an
   `approvedAt` timestamp
3. `InstagramComposio.publish` re-checks and throws before calling Instagram

`tests/agents.test.js` covers all three, including that an unapproved post cannot
reach the network at all.

## Critic rules

Two exist because both defects were found live on the account:

| Rule | Why |
|---|---|
| `BARE_HASHTAG` | Every published caption lost its `#` after the fifth tag — half of each post's discovery surface was dead text |
| `DRAFT_ARTIFACT` | The top-performing post shipped with `Alt caption (shorter, quieter tone)` in the live caption |

Plus: `NO_CTA` (a post that can't convert), `MEDIA_NOT_HTTPS` / `MEDIA_UNFETCHABLE`
(Meta fetches media server-side — a bad URL fails opaquely and burns quota),
`CAPTION_TOO_LONG`, `CAROUSEL_SIZE`, `TOO_FEW_HASHTAGS`, and `AI_RESULT_IMAGERY`.

That last one is a policy choice: AI imagery is fine for title cards, promo
graphics, product shots and b-roll, but a hair *result* shown to a prospective
client must be real client work.

## Local run

```bash
npm install
npm test

# one cycle — drafts and queues, publishes nothing
DATA_DIR=./.local UPLOADS_DIR=./.local/uploads \
PUBLIC_BASE_URL=https://your-service.onrender.com \
npm run cycle

# review page
REVIEW_TOKEN=dev npm start   # then open /review?t=dev
```

## Environment

| Var | Required | Notes |
|---|---|---|
| `COMPOSIO_API_KEY` | to publish | Composio project API key |
| `COMPOSIO_CONNECTED_ACCOUNT_ID` | to publish | e.g. `instagram_bogle-kanred` |
| `IG_USER_ID` | no | `me` (default) resolves the authenticated account |
| `PUBLIC_BASE_URL` | yes | This service's public URL. Instagram fetches media from it |
| `REVIEW_TOKEN` | yes | Anyone holding it can approve posts |
| `DATA_DIR` / `UPLOADS_DIR` | yes | On Render, under the mounted disk |
| `POSTS_PER_WEEK` | no | Defaults to 3 |

## Uploading media

Drop files into `UPLOADS_DIR`. An optional sidecar JSON of the same name adds
metadata:

```jsonc
// reveal.json, alongside reveal.mp4
{
  "format": "transformation_reveal",
  "notes": "Full head of foils, 4 hours, K18 in-chair",
  "vars": { "n": "6", "before": "grown-out balayage", "after": "creamy blonde" },
  "origin": "real",          // "ai" for generated assets
  "depicts": "client_result" // "title_card", "product", "broll"
}
```

Assets default to `origin: "real"` / `depicts: "client_result"` — the Critic's
authenticity rule fails closed.

## Deploying

`render.yaml` defines the web service plus two crons: the weekly cycle (Sunday
22:00 UTC) and an hourly publish check. Set `PUBLIC_BASE_URL` to the service's own
URL once Render assigns it.

## Cross-posting

TikTok and Facebook are manual. Each queued post exposes
`/review/:id/caption.txt` so Sha can copy the caption straight across after
posting the media by hand.
