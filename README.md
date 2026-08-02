# Hermes Agent in this Claude Code environment

This repo configures [Hermes Agent](https://github.com/NousResearch/hermes-agent)
(Nous Research) to be installed and active in every Claude Code session for this
environment.

## Why this exists instead of the one-liner

The documented installers are:

```powershell
iex (irm https://hermes-agent.nousresearch.com/install.ps1)   # Windows
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash   # Linux/macOS
```

Neither works here:

1. **`hermes-agent.nousresearch.com` is blocked** by this environment's egress
   policy — the proxy rejects the CONNECT with `403`.
2. The PowerShell variant targets Windows; these containers are Linux with no
   `pwsh` installed.
3. **The container is ephemeral.** Anything installed is wiped when the session
   is reclaimed, so a one-time install would not persist regardless.

So Hermes is built from the public GitHub source (github.com and pypi.org *are*
reachable), and the install is re-run automatically on every session start.

## What's here

| Path | Purpose |
|---|---|
| `.claude/hooks/session-start.sh` | Clones + builds Hermes, puts `hermes` on PATH. Idempotent. |
| `.claude/settings.json` | Registers the hook as a `SessionStart` hook. |
| `.claude/skills/hermes/SKILL.md` | Teaches Claude how to drive Hermes and what's blocked. |
| `.mcp.json` | Registers `hermes mcp serve` as an MCP server. |

Install layout:

- Source + venv: `/home/user/hermes-agent` (sibling of this repo)
- Binaries: `~/.local/bin/{hermes,hermes-agent,hermes-acp}`
- Config: `~/.hermes/config.yaml`, secrets in `~/.hermes/.env`

## ⚠️ Hermes cannot run a turn yet — it needs a model provider key

The install is complete and `hermes` runs, but **no model provider is
configured**, so any actual agent turn fails. This is the one thing that
requires you.

Every Nous-hosted service is blocked by egress policy:

| Host | Purpose | Status |
|---|---|---|
| `hermes-agent.nousresearch.com` | installer, docs, Tool Gateway | ❌ blocked |
| `portal.nousresearch.com` | Nous Portal OAuth / models | ❌ blocked |
| `inference-api.nousresearch.com` | Nous inference | ❌ blocked |
| `tool-gateway.nousresearch.com` | web search, image gen, TTS, browser | ❌ blocked |

So **`hermes setup --portal` cannot work here** — the normal onboarding path is
unavailable, and the bundled Tool Gateway tools (web search, image generation,
browser) will stay offline.

Third-party providers, tested from this environment:

| Provider | Status |
|---|---|
| `api.anthropic.com` | ✅ reachable |
| `generativelanguage.googleapis.com` (Gemini) | ✅ reachable |
| `openrouter.ai` | ❌ blocked |
| `api.openai.com` | ❌ blocked |
| `api.fireworks.ai` | ❌ blocked |

Note the shipped default in `~/.hermes/config.yaml` is
`anthropic/claude-opus-4.6` via `base_url: https://openrouter.ai/api/v1` — that
base URL is blocked and must be changed.

### To finish setup

Provide a key for a reachable provider. Either set it in the environment so the
hook picks it up automatically on the next session:

```
ANTHROPIC_API_KEY=sk-ant-...
```

or write it directly:

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> ~/.hermes/.env
```

Then point `model.base_url` in `~/.hermes/config.yaml` at that provider (or
clear it to use the provider default) and verify:

```bash
hermes -z "say OK"
```

The hook already wires `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`,
or `OPENROUTER_API_KEY` into `~/.hermes/.env` when present in the environment.

Hermes needs **its own** key. The session's Claude Code credentials are not
reused for it.

### Alternative: unblock Nous directly

If you'd rather use Nous Portal as intended, allowlist `*.nousresearch.com` in
the environment's network policy
([docs](https://code.claude.com/docs/en/claude-code-on-the-web)). Then
`hermes setup --portal` works and one OAuth covers a model plus the Tool
Gateway tools.

## Activation caveat

`SessionStart` hooks and MCP servers load **at session start**. Committing this
config does not retro-activate Hermes in an already-running session — it takes
effect from the next session, and only once this branch is merged into the
repo's default branch.

## Build notes

- The repo's `uv.lock` uses `exclude-newer-package` booleans that **uv < 0.12
  cannot parse**. The image ships uv 0.8.17, so the hook upgrades uv from PyPI
  first; otherwise `uv sync --locked` fails with
  `invalid type: boolean, expected a timestamp string`.
- Install uses `uv sync --extra all --locked`, which is hash-verified against
  the committed lockfile, with the repo's own documented fallbacks.
- `hermes doctor` will always flag the Tool Gateway / web API keys as missing
  here. That is expected, not a regression.
