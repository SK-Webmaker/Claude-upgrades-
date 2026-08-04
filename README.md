# Claude-upgrades-

A portable Claude Code setup: marketplaces, plugins, and skills that travel with
the repository instead of living on one machine.

Claude Code installs plugins into `~/.claude/` on the machine that runs the
install. That state is per-machine and is not synced to your Anthropic account,
so it does not follow you between computers and does not survive an ephemeral
container being reclaimed. This repo keeps the setup in version control so any
session opened against it starts with the same tooling.

## What's here

| Path | Purpose |
| --- | --- |
| `.claude/settings.json` | Declares the marketplaces and which plugins should be enabled. Applied automatically by sessions opened against this repo. |
| `.claude/skills/` | Vendored copies of the skill definitions, so they load without needing to re-fetch anything from GitHub. |
| `scripts/restore-plugins.sh` | Installs the plugins fully into the local plugin cache when you need agents, commands, or MCP servers, not just skills. |

## How it works

There are two independent layers, and either one alone is useful.

**Declared plugins.** `.claude/settings.json` lists the marketplaces under
`extraKnownMarketplaces` and the plugins under `enabledPlugins`. A session that
opens this repo reads that file and enables the plugins, fetching them from
GitHub as needed. This is the layer that provides agents, slash commands, and
MCP servers.

**Vendored skills.** `.claude/skills/` holds the actual skill files. These load
directly from disk with no network access and no plugin resolution, so the
skills are available even if a marketplace is unreachable or a plugin fails to
install.

Keeping both means a broken clone degrades to "skills still work" rather than
"nothing works".

## Restoring on a fresh machine or container

Cloning the repo is enough for the skills. To also install the plugins:

```bash
./scripts/restore-plugins.sh
```

The script is idempotent — running it when things are already installed is
harmless.

## Included plugins

| Plugin | Marketplace | What it adds |
| --- | --- | --- |
| `superpowers` | `anthropics/claude-plugins-official` | 14 skills for planning, TDD, systematic debugging, code review, and git worktrees. |
| `ruflo-core` | `ruvnet/ruflo` | 5 skills, 4 agents, and an MCP server exposing memory, swarm, and orchestration tooling. |
| `claude-seo` | `AgriciDaniel/claude-seo` | 25 SEO skills and 18 specialist agents covering audits, technical SEO, schema, and GEO. |

`anthropics/claude-plugins-community` is registered as a marketplace but has no
plugins enabled from it; it is there so community plugins can be installed
without adding the marketplace first.

## Adding another plugin

```bash
claude plugin marketplace add <owner>/<repo>
claude plugin install <plugin>@<marketplace>
```

Then add the marketplace to `extraKnownMarketplaces` and the plugin to
`enabledPlugins` in `.claude/settings.json`, and add both to the arrays in
`scripts/restore-plugins.sh` so the restore path stays complete.

To vendor its skills as well, copy the plugin's `skills/` subdirectories into
`.claude/skills/`.

## Note on slash commands

`/plugin` is a slash command in the interactive Claude Code CLI and desktop app.
It does not exist in every environment. The equivalent CLI subcommands —
`claude plugin marketplace add` and `claude plugin install` — work anywhere the
`claude` binary is available, which is what `scripts/restore-plugins.sh` uses.
