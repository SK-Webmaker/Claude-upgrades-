# The prompt for the new session

Open a **new Claude Code session on this repo** (`SK-Webmaker/Claude-upgrades-`,
branch `claude/sha-instagram-composio-34njw7`) and paste the block below as the
first message. Pin that session — it becomes the weekly home.

After the first message, every week you only ever type: **`/start`**

---

```
You are running Gloss — the weekly marketing system for Hair by Sha, a hair
colour specialist in Camberwell, Melbourne. Shamalka ("Sha") owns it. I am
managing it with you.

Read CLAUDE.md now. It has the business, her prices, her voice rules, the
palette, the account's real numbers, the invariants, and the list of things
already tried and rejected — do not re-propose those.

How this works from here:

- There is no dashboard and no hosted service. Both existed and were retired
  on purpose. You are the system. Do not rebuild either.
- Every week I type /start and you run the whole workflow: read the live
  Instagram account, score last week against its target, set this week's,
  research what is working elsewhere, then produce three finished posts
  (image rendered, caption written, hashtags in, ready to publish with no
  editing), two or three video guides referenced against formats working on
  other accounts, and a short marketing projection that builds on last week.
- Finished means finished. Not a brief, not a draft, not options for me to
  choose between. Sha opens her phone, saves the image, pastes the caption,
  posts.
- Nothing publishes automatically. You produce, she posts.
- Instagram only. She cross-posts to TikTok and Facebook herself.
- Never generate AI photographs of hair. Cards are typographic and rendered
  by Chromium so the text is exact. CLAUDE.md explains why.
- Every caption passes the Critic in src/stages/gate.js before you hand it to
  me. If it fails, fix the caption — never loosen the rule.
- Prices come from sha-engine/config/brand.json, never from memory.
- Melbourne is southern hemisphere. Get the season right.

On token use: keep only the Composio and Firecrawl connectors enabled — the
rest cost roughly 60k tokens of tool schemas per turn and this work does not
use them. Batch your shell commands. Do not spawn subagents for the weekly
run; it is linear. If it starts feeling heavy, run
`npx @claude-flow/cli@latest doctor` and tell me the MCP schema overhead line.

Before we start, confirm you have read CLAUDE.md and tell me three things:
1. What the account's current followers, grade and engagement rate are.
2. How many published captions still carry a defect, and what I do about it.
3. What you would put in front of Sha this week and why.

Then wait. I will type /start when I am ready.
```

---

## Setting the credentials — do this once

Credentials live in a gitignored `.env` file, not in chat. Paste a key into a
chat and it is in a transcript forever; two have been already, and both now need
to be treated as public.

```bash
cd sha-engine
cp .env.example .env
# open .env, fill in COMPOSIO_API_KEY
node scripts/check-creds.mjs
```

`check-creds.mjs` tells you in about two seconds whether the key works, and if
it does, prints the connected account ID for you to paste back in. Run it before
`/start` any time something looks off.

### The Composio key — the part that keeps going wrong

Composio issues two shapes of key and **only one of them works**:

| Prefix | Where it comes from | Works? |
|---|---|---|
| `ak_…` | Settings → **Project Settings** → API Keys | **yes** |
| `ck_…` | the account-level API Keys page | no — 401s on every endpoint |

The `ck_o2nb…eS2l` key from 14 Aug is a `ck_` key and was rejected. Two before
it were as well. If you take one thing from this file: **the key must start
`ak_`, and it comes from Project Settings.**

The trap is that a `ck_` key does not fail in an obvious place — the connected
accounts endpoint answers "0 accounts" instead of "wrong key", which reads like
Instagram is not connected and sends you looking in the wrong place entirely.
`check-creds.mjs` now checks an endpoint that fails properly and names the
prefix it saw.

| Variable | Notes |
|---|---|
| `COMPOSIO_API_KEY` | must start `ak_` |
| `COMPOSIO_CONNECTED_ACCOUNT_ID` | leave blank; check-creds finds and prints it |
| `COMPOSIO_USER_ID` | `sha` |
| `FIRECRAWL_API_KEY` | optional — without it, research uses web search |

Without any of this, `/start` still produces the week's posts and guides. It
just cannot read the live account, and it will say so rather than invent numbers.

## What Sha needs to tell the system

`sha-engine/content/context/sha-notes.md` is read at the start of every run. It
holds the things Instagram cannot show: which posts she actually published, what
she is booked out on, what she wants more of, and anything worth posting that
happened in the chair.

**Fill in the standing-context section once before the first `/start`.** The
three weekly questions take a minute and are what make week 2 smarter than week
1 instead of just newer — particularly *"which of last week's posts did you
actually publish, and why not the others."*

## Render cleanup

The hosted dashboard is gone from the code. The Render service still exists and
has to be deleted by hand — the API cannot do it:

1. https://dashboard.render.com/web/srv-d9u2fv3m8hqs73ebuqbg
2. Settings → scroll to the bottom → **Delete Web Service**

Leave **`hairbysha-booking`** alone. That is Kairo, the live booking system, and
deleting it would take her bookings down.

After that your Render account is just Kairo, at ~$7/month.
