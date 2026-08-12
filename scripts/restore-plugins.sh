#!/usr/bin/env bash
#
# Restore the Claude Code marketplaces and plugins used by this repo.
#
# .claude/settings.json already declares the marketplaces and which plugins
# should be enabled, so a session opened against this repo normally picks
# them up on its own. Run this script when you want the plugins fully
# installed into the local plugin cache as well -- for example on a fresh
# container, or when a plugin's MCP server / agents / commands are needed
# rather than just its skills.
#
# Usage:
#   ./scripts/restore-plugins.sh
#
set -euo pipefail

MARKETPLACES=(
  "anthropics/claude-plugins-official"
  "anthropics/claude-plugins-community"
  "ruvnet/ruflo"
  "AgriciDaniel/claude-seo"
)

PLUGINS=(
  "superpowers@claude-plugins-official"
  "ruflo-core@ruflo"
  "claude-seo@agricidaniel-claude-seo"
)

if ! command -v claude >/dev/null 2>&1; then
  echo "error: the 'claude' CLI is not on PATH" >&2
  exit 1
fi

echo "==> Adding marketplaces"
for m in "${MARKETPLACES[@]}"; do
  echo "  - $m"
  # Already-added marketplaces are not an error; keep going either way.
  claude plugin marketplace add "$m" >/dev/null 2>&1 || echo "    (already present or unreachable)"
done

echo "==> Installing plugins"
for p in "${PLUGINS[@]}"; do
  echo "  - $p"
  claude plugin install "$p" >/dev/null 2>&1 || echo "    (already installed or unavailable)"
done

echo "==> Installed"
claude plugin list
