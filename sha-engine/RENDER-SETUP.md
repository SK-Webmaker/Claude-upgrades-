# Moving Gloss from a bare service to a project with a disk

## Why the Disks option is missing

`gloss-sha` was created through Render's **New Web Service** form, which makes a
service that belongs to no project. Disk management in the current dashboard
lives at the project level, so a service outside a project shows no Disks
section — there is nothing wrong with the plan or the account.

The proof is in the same workspace: `hairbysha-booking` sits inside a project
and has a 1 GB disk at `/var/data`. `gloss-sha` sits outside one and has none.

Render's API cannot attach a disk to an existing service, and cannot move a
service into a project. A Blueprint creates the project, the environment, the
service and the disk together, in one pass. That is the only path, and it needs
one click from the dashboard.

## What to click

1. Open **https://dashboard.render.com/blueprints** → **New Blueprint Instance**
2. Pick the repo `SK-Webmaker/Claude-upgrades-`
3. Set the branch to `claude/sha-instagram-composio-34njw7`
4. Leave **Blueprint Path** empty. `render.yaml` is at the repository root, which
   is where that field already looks. (It used to sit in `sha-engine/`, which is
   why the form reported "Blueprint file render.yaml not found" — the file was
   there, just not where Render looks by default.)
5. Render shows a service called **gloss** with a 1 GB disk at `/var/data`.
   Approve it.
6. It will ask for the four values marked `sync: false`. Three of them you
   already have on `gloss-sha`:

   | Variable | Value |
   |---|---|
   | `COMPOSIO_API_KEY` | the rotated key (see below) |
   | `COMPOSIO_CONNECTED_ACCOUNT_ID` | same as on `gloss-sha` |
   | `PUBLIC_MEDIA_BASE_URL` | leave blank for now — step 6 |
   | `FIRECRAWL_API_KEY` | optional; without it `.research` runs on cached data |

7. Once it deploys, Render assigns a hostname like `https://gloss.onrender.com`.
   Put that exact URL into `PUBLIC_MEDIA_BASE_URL` and redeploy. Instagram
   fetches media server-side, so this has to be the service's own public
   address or publishing fails at the container step.
8. Check `https://gloss.onrender.com` loads and shows **This Week**, then run
   `.review` once to populate the disk.
9. Delete `gloss-sha`.

`PLAN_TOKEN` is generated automatically — you never need to see it. It guards
`POST /api/plan`, and that route stays closed while it is unset.

## What changes, and what does not

The three finished posts and the video guides ship in `content/`, so they
survive every deploy with or without a disk. What the disk buys is
`data/state/` — the account review, the per-post scores and the week-by-week
goal history. Without it the engine re-reads the account fine but can never
compare a week against the one before it, which is the part that compounds.

Cost: the service plan is unchanged (`starter`, same as now). The disk adds
about $0.25/month for 1 GB.

## Rotating the keys

Both of these were pasted into a chat transcript, so treat them as public. They
are not in the repo — the working tree and the recent history are clean — but
they are live on the running service.

**Composio.** https://app.composio.dev → Settings → **Project Settings** → API
Keys → revoke the old key, generate a new one. That is the path that actually
shows the working keys; the account-level API Keys page issues keys that 401 on
every endpoint. Paste the new key into the new service's environment.

**Anthropic.** https://console.anthropic.com/settings/keys → revoke, create a
new one. The service currently has `ANTHROPIC_API_KEY` set, left from the chat
surface that has since been removed from the console. Nothing in Gloss reads it
any more, so the safe move is to revoke it and **not** carry it across to the
new service.
