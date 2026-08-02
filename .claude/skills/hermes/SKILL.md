---
name: hermes
description: Drive the Hermes Agent (Nous Research) CLI installed in this environment — run one-shot prompts, manage skills/memory/cron, inspect status, and configure model providers. Use whenever the user asks to run, query, configure, or troubleshoot "hermes", the Hermes agent, or the `hermes` command.
---

# Hermes Agent

Hermes is installed from source at `$HERMES_DIR` (default `~/hermes-agent`) with
its venv at `$HERMES_DIR/venv`. The `hermes` binary is symlinked into
`~/.local/bin`, so it is on PATH once the SessionStart hook has run.

## Environment constraints — read this first

This environment's egress policy **blocks every `*.nousresearch.com` host**:

| Host | Purpose | Status |
|---|---|---|
| `hermes-agent.nousresearch.com` | official installer, docs, Tool Gateway | blocked (403 CONNECT) |
| `portal.nousresearch.com` | Nous Portal OAuth / model access | blocked |
| `inference-api.nousresearch.com` | Nous inference | blocked |
| `tool-gateway.nousresearch.com` | web search, image gen, TTS, browser | blocked |

Consequences:

- `hermes setup --portal` **cannot work here.** Do not suggest it.
- The bundled Tool Gateway tools (`web`, `image_gen`, browser) are unavailable.
- Hermes must be pointed at a third-party provider with a user-supplied key.

Reachable LLM providers from this environment (verified):

- `api.anthropic.com` ✅
- `generativelanguage.googleapis.com` ✅ (Google AI Studio / Gemini)
- `openrouter.ai`, `api.openai.com`, `api.fireworks.ai` ❌ blocked

**Never** repurpose the session's own Claude Code credentials
(`ANTHROPIC_BASE_URL` and friends) to power Hermes. Hermes needs its own key,
supplied by the user.

## Checking state

```bash
hermes --version          # install dir, method, Python, SDK version
hermes status             # component status
hermes doctor             # full diagnostics; --fix auto-repairs
```

`hermes doctor` will always report the Tool Gateway / web keys as missing in
this environment. That is expected, not a regression.

## Running a turn

```bash
hermes -z "your prompt"                 # one-shot, non-interactive
hermes -z "prompt" -m <model>           # override model
hermes chat                             # interactive (needs a TTY)
```

Prefer `-z` in this session — it is non-interactive and returns cleanly.
`hermes chat` and `--tui` expect a terminal and will hang here.

If a turn fails with a credential error (e.g. Bedrock
`UnrecognizedClientException`), no provider is configured — see below.

## Configuring a provider

Config lives in `~/.hermes/config.yaml`; secrets in `~/.hermes/.env`.

```bash
hermes model                            # interactive picker (needs TTY)
```

Non-interactively, write the key and point the model at a reachable provider:

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> ~/.hermes/.env
```

Then set `model.default` / `model.base_url` in `~/.hermes/config.yaml`. The
shipped default is `anthropic/claude-opus-4.6` with `base_url:
https://openrouter.ai/api/v1` — **that base_url is blocked here** and must be
changed to a reachable one for the chosen provider.

## Other subcommands worth knowing

```bash
hermes skills list        # bundled + optional skills (agentskills.io standard)
hermes memory             # agent-curated memory
hermes cron               # built-in scheduler
hermes sessions           # past-session search (FTS5)
hermes tools              # available toolsets
hermes mcp serve          # stdio MCP messaging bridge (registered in .mcp.json)
```

## MCP bridge

`.mcp.json` registers `hermes mcp serve`, exposing the messaging bridge tools
(`conversations_list`, `messages_read`, `messages_send`, `events_poll`,
`permissions_*`, `channels_list`). These only return useful data once a
messaging platform (Telegram, Discord, Slack, …) is configured via
`hermes gateway`. The server initializes cleanly with none configured.

## Reinstalling

The container is ephemeral. `.claude/hooks/session-start.sh` rebuilds Hermes on
every session start. To force a clean rebuild:

```bash
rm -rf "$HERMES_DIR" && .claude/hooks/session-start.sh
```

Note the installer needs uv >= 0.12 — older uv cannot parse the repo's
`uv.lock` (`exclude-newer-package` booleans). The hook handles this upgrade.
