#!/bin/bash
# Installs Hermes Agent (NousResearch) from source and puts `hermes` on PATH.
#
# Why from source: hermes-agent.nousresearch.com is blocked by this
# environment's egress policy, so the official installers
# (install.sh / install.ps1) cannot be fetched here. github.com and
# pypi.org are reachable, so we build from the public repo instead.
#
# Idempotent: re-running skips work that is already done.
set -euo pipefail

# Default to a sibling of the project checkout (e.g. /home/user/hermes-agent).
# A venv hardcodes absolute paths in its shebangs, so this location must stay
# stable across sessions — do not "tidy" it into $HOME, which is /root here
# while the project lives under /home/user.
_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
HERMES_DIR="${HERMES_DIR:-$(dirname "$_PROJECT_DIR")/hermes-agent}"
HERMES_REPO="https://github.com/NousResearch/hermes-agent.git"
VENV="$HERMES_DIR/venv"

log() { echo "[hermes-bootstrap] $*"; }

# 1. Source checkout -----------------------------------------------------
if [ ! -d "$HERMES_DIR/.git" ]; then
  log "cloning $HERMES_REPO -> $HERMES_DIR"
  git clone --depth 1 "$HERMES_REPO" "$HERMES_DIR"
else
  log "repo already present at $HERMES_DIR"
fi

# 2. uv ------------------------------------------------------------------
# The pinned uv.lock uses `exclude-newer-package` booleans that uv < 0.12
# cannot parse ("invalid type: boolean, expected a timestamp string"), which
# makes `uv sync --locked` fail. Prefer a module-level uv we control.
UV="python3 -m uv"
if ! $UV --version >/dev/null 2>&1; then
  log "installing uv from PyPI"
  python3 -m pip install --quiet --upgrade uv
fi
UV_VER="$($UV --version 2>/dev/null | awk '{print $2}')"
UV_MAJOR_MINOR="$(echo "$UV_VER" | cut -d. -f1,2)"
if [ "$(printf '%s\n0.12\n' "$UV_MAJOR_MINOR" | sort -V | head -1)" != "0.12" ]; then
  log "uv $UV_VER is too old for the lockfile; upgrading"
  python3 -m pip install --quiet --upgrade uv
fi
log "uv $($UV --version | awk '{print $2}')"

# 3. Dependencies --------------------------------------------------------
# `uv sync --locked` is hash-verified against the committed uv.lock. Fall
# back to the repo's own documented fallbacks if the lock is unusable.
if [ -x "$VENV/bin/hermes" ]; then
  log "venv already built; skipping dependency sync"
else
  log "syncing dependencies (this takes a few minutes)"
  cd "$HERMES_DIR"
  UV_PROJECT_ENVIRONMENT="$VENV" $UV sync --extra all --locked \
    || UV_PROJECT_ENVIRONMENT="$VENV" $UV sync --extra all \
    || UV_PROJECT_ENVIRONMENT="$VENV" $UV pip install -e "."
fi

# 4. PATH ----------------------------------------------------------------
mkdir -p "$HOME/.local/bin"
ln -sf "$VENV/bin/hermes" "$HOME/.local/bin/hermes"
ln -sf "$VENV/bin/hermes-agent" "$HOME/.local/bin/hermes-agent"
ln -sf "$VENV/bin/hermes-acp" "$HOME/.local/bin/hermes-acp"

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  echo "export HERMES_DIR=\"$HERMES_DIR\"" >> "$CLAUDE_ENV_FILE"
fi
export PATH="$HOME/.local/bin:$PATH"

# 5. Provider credentials ------------------------------------------------
# Hermes needs a model provider. Every *.nousresearch.com host (portal,
# inference-api, tool-gateway) is blocked by egress policy here, so Nous
# Portal is not an option. Of the third-party providers, only
# api.anthropic.com and generativelanguage.googleapis.com are reachable.
# We only wire up a key if one is actually present in the environment.
mkdir -p "$HOME/.hermes"
touch "$HOME/.hermes/.env"
persist_key() {
  local name="$1" val="${2:-}"
  [ -z "$val" ] && return 0
  grep -q "^${name}=" "$HOME/.hermes/.env" 2>/dev/null && return 0
  echo "${name}=${val}" >> "$HOME/.hermes/.env"
  log "wired $name into ~/.hermes/.env"
}
persist_key ANTHROPIC_API_KEY "${ANTHROPIC_API_KEY:-}"
persist_key GEMINI_API_KEY    "${GEMINI_API_KEY:-}"
persist_key GOOGLE_API_KEY    "${GOOGLE_API_KEY:-}"
persist_key OPENROUTER_API_KEY "${OPENROUTER_API_KEY:-}"

if ! grep -qE '^(ANTHROPIC|GEMINI|GOOGLE|OPENROUTER)_API_KEY=.' "$HOME/.hermes/.env" 2>/dev/null; then
  log "NOTE: no model provider key found. Hermes is installed but cannot"
  log "      run a turn until you set one (see README.md)."
fi

_VER="$("$VENV/bin/hermes" --version 2>/dev/null || true)"
_VER="${_VER%%$'\n'*}"
log "hermes ${_VER:-(version unavailable)}"
log "done"
