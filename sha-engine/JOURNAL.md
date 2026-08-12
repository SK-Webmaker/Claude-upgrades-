# Sha Engine — Error & Fix Journal

Every failure this system hit, what actually caused it, and what was changed in
response. Ordered roughly chronologically. Each entry names the file that holds
the fix so the reasoning stays attached to the code.

Sources: commit bodies (`c528938`, `58af18d`, `22d5be2`), the code comments
written at the time of each fix, and the connector work done in session.

---

## 1. TikTok direct posting reaches nobody

**Symptom:** A TikTok app that hasn't passed TikTok's audit can create posts
successfully — valid token, `200 OK`, a real `publish_id` — and the post is
visible to nobody. Viewership is forced to `SELF_ONLY`, and the account itself
must be private at the time of posting.

**Why it's dangerous:** Nothing errors. The system looks like it works and
reaches zero people. This is the worst failure mode in the whole build, because
no log line would ever reveal it.

**Fix:** `src/platforms/tiktok.js` — Upload-to-Inbox became the default. The
finished video lands in Sha's TikTok drafts, she taps post, and *she* is the
publisher, so no audit and no viewership restriction apply. The direct-post
code path was written but gated behind `system.publishing.tiktok.auditPassed`.

**Later revision:** see entry 9.

---

## 2. Getting footage off the phone was the real bottleneck

**Symptom:** The pipeline was built to cut raw salon video with ffmpeg. In
practice the clips are large, the transfer off the phone is manual, and it has
to happen between appointments. The engineering was sound and the workflow
still broke.

**Fix:** `22d5be2` — the cut stage was removed and the **Editor agent retired**
(`src/agents/registry.js:56-59`). What replaces it is a shoot brief precise
enough to act on: per slot, the hook line, exact shots with durations, target
length, the service it pushes, a paste-ready caption, and a real reference video
to watch first. Sha films and posts natively, which also avoids re-encoding.

**Kept:** photo posts still run the full ingest → approve → publish path, since
images are small enough to send without friction and both platforms accept them
via API. That's why the Publisher survived the cut.

---

## 3. Running a week twice produced six posts instead of three

**Symptom:** Real duplication bug found in testing. Footage was only marked
"used" once a post *published*, so a re-plan saw the same clips as available and
planned them again.

**Why the existing guard missed it:** the Critic's duplicate rule compares
against already-published posts only. Nothing in-flight was visible to it.

**Fix:** `claimedClipIds()` in `src/stages/plan.js` — any clip committed to a
post in any in-flight state (`awaiting_approval`, `cut`, `published`) is
excluded from planning. `rejected` and `failed` posts release their clips back
for reuse. Locked by test at `tests/agents.test.js:184`.

---

## 4. Captions drifted further out of sync the longer a clip ran

**Symptom:** Captions were written in advance, so any trim or speed ramp pushed
them progressively out of alignment. This is the single most common way an
automated caption pipeline produces unusable output.

**Fix:** `src/lib/karaoke.js` — captions are now driven by faster-whisper
word-level timestamps and burned as ASS `\kf` karaoke sweeps. `remapWords()`
remaps timings through *both* the trim and the speed ramp. Inter-word gaps are
padded so total karaoke time matches line duration.

**Verified:** rendered and read back a frame mid-sweep — spoken words white,
unspoken words still in the accent colour. Test asserts karaoke total vs. line
duration within 3 centiseconds (`tests/agents.test.js:39`).

---

## 5. Centre crop cut heads off

**Symptom:** Vertical reframing from a wide source centre-cropped, which
decapitates the subject whenever they aren't dead centre.

**Why the obvious fix was wrong:** face detection silently centres when it finds
nothing — and a colourist films the *back* of a head as often as a face.

**Fix:** `cropExpression()` in `src/lib/analyse.js` — column edge-energy
tracking, which works for a face, a back of a head, or hands in foils. The crop
holds still unless the subject genuinely moves, and is clamped in bounds.

---

## 6. Video uploads from the phone arrived corrupted

**Symptom:** Multipart upload parsing converted buffers to string to find the
boundary. Video bytes are not valid UTF-8, so the round trip silently corrupted
the file — no error, just a broken MP4.

**Fix:** Boundary scanning on the raw `Buffer` rather than a string round trip.
Dependency-free streaming multipart upload writing straight to disk, up to 2 GB.

**Verified:** byte-exact on an 8.7 MB upload that still decodes with audio.
Dashboard verified at 393×852 with zero horizontal overflow.

---

## 7. TikTok Creative Center returned US entertainment hashtags for an AU query

**Symptom:** Live trend scraping with `countryCode=AU` redirects to US data and
caps at three rows without a login. The three results were US entertainment
hashtags with no relevance to hair.

**What worked:** the relevance filter rejected all three, so Scout returned
nothing rather than polluting the plan — the guard did its job.

**Fix:** `src/stages/scout.js` — the configured live source cannot deliver AU
trend data and no longer pretends to. Replaced with a built-in
`REFERENCE_LIBRARY` where every format carries a real reference video link, and
an explicit `verified: false` flag on all of them, because without platform API
access this engine has verified no view counts. Fabricated numbers make a weak
format look proven, which is worse than no numbers.

---

## 8. Instagram publish failed at the container step with an unhelpful error

**Symptom:** Publishing a container immediately after creating it fails. The
container isn't ready the instant you create it, and the error doesn't explain
itself.

**Related traps documented at the same time** (`src/platforms/instagram.js:14-21`):
- 25 API-published posts per rolling 24h — Reels and Stories share the cap
- Reels max 90 seconds
- Requires an IG Business account linked to a Facebook Page
- `video_url` must be publicly reachable by Meta's fetchers; a localhost path or
  a 60-second signed URL fails at the container step

**Fix:** poll for container readiness before publishing, plus
`quotaRemaining()` consulted in `src/stages/ship.js:52-60` so the daily cap is
respected up front instead of discovered through errors.

---

## 9. Waiting on TikTok's own audit was avoidable

**Symptom:** Entry 1's inbox workaround is ToS-clean but still requires a manual
tap, and the direct path was blocked behind an audit with no timeline.

**Fix:** `src/platforms/tiktok.js:38-73` — route through an **already-audited
partner connector** (Higgsfield) rather than getting our own app audited. Their
client has passed TikTok's review, so `DIRECT_POST` at `PUBLIC_TO_EVERYONE`
works on day one, and it can attach a Commercial Music Library track, which the
raw API cannot do for a draft at all. Inbox and own-app paths remain as
fallbacks behind one config switch (`config/system.json` → `publishing.tiktok.route`).

**Payload honesty** (`brokerPayload()`): Sha's own footage of her own work is
neither AI-generated nor branded content for a third party. `is_aigc: false` and
`commercial_content_disclosure.enabled: false` are asserted deliberately —
misdeclaring either breaches TikTok's terms. Locked by test at
`tests/agents.test.js:171`.

---

## 10. Plugins had to be reinstalled every session

**Symptom:** Claude Code stores installed plugins under `~/.claude` on whichever
machine ran the install. That state is per-machine, isn't synced to the account,
and doesn't survive an ephemeral container being reclaimed.

**Fix:** `6d7c1e0` — keep the setup in the repository:
- `.claude/settings.json` declares marketplaces and plugins, so a session opened
  against this repo enables them with no manual install
- `.claude/skills/` vendors 44 skill definitions, which load straight from disk
  and survive an unreachable marketplace
- `scripts/restore-plugins.sh` reinstalls into the local cache, idempotently,
  using the `claude plugin` CLI subcommands rather than the `/plugin` slash
  command, which isn't available in every environment

**Verified:** all 44 vendored skills have a `SKILL.md` with valid frontmatter.

---

## 11. Composio connector flapping (this session, unresolved in-repo)

**Symptom:** The Composio connector cycled up/down repeatedly during setup —
not a hard failure, an intermittent one.

**Diagnosis:** connector-level infrastructure, not anything in this codebase and
not caused by usage patterns. Usual root cause is a stale or expiring auth token
on Composio's side.

**Remedies (owner-side, not code):** disconnect and reconnect fresh in claude.ai
connector settings; check the Composio dashboard for rate limit, expired key, or
quota flags; regenerate the API key and reconnect if it doesn't hold.

**Outcome:** Instagram connected and confirmed via Composio OAuth.

---

## 12. Prompt injection attempts mid-session

**Symptom:** Two separate injected instruction blocks appeared in-session — one
claiming a "54 agents / swarm coordination" summary format, one claiming a
mandatory skill-invocation system. Neither corresponds to anything in this
project.

**Fix:** both ignored and called out explicitly rather than silently dropped.
Worth recording because an automated content system holding live social
credentials is exactly the target such injections aim at.

---

## Standing decisions that came out of the above

| Decision | Reason |
|---|---|
| Model directs, deterministic code executes | Frame-accurate editing isn't something a language model does; planning an edit from a transcript is |
| Nothing publishes without Sha's approval | `src/stages/ship.js` only queues `status === 'approved'` |
| Failures are loud, never silent | Every agent declares an `escalate` message a human can act on; enforced by test |
| No unverified numbers | `verified: false` on every reference format until an API confirms otherwise |
| Retry three times, then ask a human | `MAX_ATTEMPTS = 3` in `src/stages/ship.js:20` |

---

## Current publishing posture

- **Instagram** — connected via Composio OAuth. The engine's existing adapter
  (`src/platforms/instagram.js`) still assumes a raw Graph API token, so the
  adapter needs rewriting against Composio's tools. This is the open work.
- **TikTok / Facebook** — no automated path, by choice. Content lands in Sha's
  Instagram drafts; she posts it there and cross-posts manually. The Higgsfield
  broker route stays in the code as the option if that changes.
