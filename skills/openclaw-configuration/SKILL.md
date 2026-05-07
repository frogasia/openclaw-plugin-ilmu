---
name: openclaw-configuration
description: Configure OpenClaw itself — channels (Telegram/Slack/Discord/WhatsApp/Messages/etc), gateway runtime (auth/bind/port), agent defaults (model/thinking/workspace), provider plugins, MCP servers, skills install, and validation. ALWAYS use this skill before searching the filesystem, `node_modules`, or the wider web for OpenClaw setup help.
---

# OpenClaw configuration

This skill is a **routing pointer**, not a manual. OpenClaw's CLI surface and config schema change between releases — the canonical answers live in the docs and in the host's own `--help` and `doctor` output, not here.

## Canonical paths

- Config file: `{{configPath}}` (JSONC; preserve user comments / formatting on edits)
- Workspace: `{{workspaceDir}}`
- Skills directory: `{{skillsDir}}`

## Discover first, search second

Before searching the web or the filesystem, try these:

- `openclaw --help` — top-level commands
- `openclaw <subcommand> --help` — flags for a specific area (e.g. `openclaw gateway --help`, `openclaw plugins --help`, `openclaw config --help`)
- `openclaw doctor` — validates current config, surfaces schema errors
- `openclaw config schema lookup <dot.path>` — query the live schema for valid fields BEFORE editing
- `openclaw plugins list` — see installed plugins and their status

## Where to find specific guidance

For anything not answered by the commands above, **fetch the OpenClaw docs directly** — do not crawl the local filesystem or `node_modules`:

- https://docs.openclaw.ai/ — main docs (use a site-scoped web_search if you don't know the path)
- https://docs.openclaw.ai/channels — channel setup (Telegram, Slack, Discord, WhatsApp, Messages, etc.)
- https://docs.openclaw.ai/start/showcase — example agents and configurations
- https://docs.ilmu.ai/docs/developer-tools/openclaw-cookbook — ILMU-specific recipes

Use `web_fetch` directly. If the page does not exist at the URL you guessed, do `web_search site:docs.openclaw.ai <topic>` instead of guessing more URLs.

## Change cadence

1. Edit `{{configPath}}` (preserve user comments / formatting), or use `openclaw config set <path> <value>` for type-safe single-key edits.
2. Validate: `openclaw doctor`. If it reports errors, STOP and show the user — do not continue editing.
3. Read the tool's own output for restart guidance:
   - `openclaw config set` and `openclaw plugins install` print `Restart the gateway to apply.` when (and only when) a restart is needed. Trust that line.
   - `openclaw doctor` flags pending restarts in its summary.
4. **Only restart the gateway if the tool explicitly says so.** Restarts can take 30s–2min depending on environment; do not restart preemptively after every change.
5. Env-var changes (e.g. `ILMU_API_KEY`, `TELEGRAM_BOT_TOKEN`) DO require a shell restart followed by a gateway restart, because the new env value is not visible to the running gateway.

## When to use this skill vs `ilmu-configuration`

- ILMU provider config (model, key, base URL, thinking, aliases) → `ilmu-configuration`
- Anything else (channels, gateway, agent defaults, providers, MCP, skills install, validation) → this skill

## Out of scope

- Rewriting OpenClaw's own behavior — this skill points at OpenClaw, it does not replace it.
- Claiming knowledge of specific channel/provider/MCP APIs — those change upstream; fetch the docs.
