---
name: send
description: Email the finished week to Sha — the three post images embedded with their captions, the video guides with the videos to copy, and the projection. Use when the user types /send, says "send it to Sha", "send the week", or asks to hand the week over.
---

# /send — hand the week over

`/start` finishes the work. `/send` is what gets it to her.

This exists because of a measured failure. Week 1 produced three posts and three
guides and **none of them went up**. The reason she gave was that she never saw
them — the work was finished and sitting in `content/cards`. A system that
produces work nobody receives has not produced anything.

**This is handover, not publishing.** Invariant 1 stands: nothing posts itself.
The email puts the week in Sha's inbox; she still posts every item by hand.

---

## Run it

```bash
cd sha-engine && node scripts/send-week.mjs --dry-run   # render, send nothing
cd sha-engine && node scripts/send-week.mjs             # send
```

**Always dry-run first**, and open `data/send-preview.html` to look at it. An
email is not recallable. The dry run prints the pack, the subject, the
recipient and the image base URL — check the recipient especially.

`--week=YYYY-MM-DD` targets a specific pack. Without it, the script takes the
**newest pack on disk**, which is the one just authored. It deliberately does
not use `forWeek(today)`: that resolves to the week already in progress, so a
Friday `/send` would mail out last week's pack.

## What it needs

| Variable | Notes |
|---|---|
| `COMPOSIO_API_KEY` | the `ak_` project key |
| `COMPOSIO_GMAIL_ACCOUNT_ID` | Gmail connected account, same project, user id `sha` |
| `SHA_EMAIL` | where it goes |

`node scripts/check-creds.mjs` reports all three and prints the Gmail account
id to paste in. Gmail uses a **Composio-managed OAuth2 app** — no Google Cloud
project needed — and the scopes must include send, not just read.

If any are missing the script refuses and names them. It does not half-send.

## Before sending, the cards must be pushed

Images are **embedded from `raw.githubusercontent.com`, pinned to the current
commit SHA** — not attached. Two reasons:

- `GMAIL_SEND_EMAIL`'s `attachment` field takes a single object keyed by an
  `s3key`, not a list, and Composio exposes no upload endpoint on its REST
  surface. Three cards cannot be attached in one message.
- Embedding reads better anyway: she sees each card directly above its own
  caption instead of matching filenames to text.

A SHA is used rather than a branch because a branch URL dies the moment the
branch is merged or renamed, and an email that breaks a week after it is sent
is worse than no email.

**So: commit and push the week before `/send`.** If the cards are not on the
remote, the URLs resolve to nothing and she gets an email of broken images.
Verify with:

```bash
curl -sI "<imageBase>/w2-midweek.png" | head -1     # expect 200
```

The dry run prints `imageBase` for exactly this.

## After sending

Say plainly what went where — recipient, subject, how many posts and guides.
Then note the two things that still need her: the posts do not publish
themselves, and `CAPTION-FIXES.md` is still outstanding.

If the send fails, report the error verbatim rather than retrying blind. A
Composio 401 here means the Gmail connection, not the Instagram one.
