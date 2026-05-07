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
3. Default assumption after any successful edit: the change is hot-reloaded and already live. Do not restart, ask the user to restart, or even mention restart unless one of the signals in the section below is present.

## You do not restart the gateway

**Restarting, stopping, or killing the gateway is the operator's decision, not yours.** Your job is to surface a restart signal when one appears and let the user act on it. Restarting on your own initiative is the single most damaging thing you can do here — in a container-in-container deployment the gateway runs as a supervisor's child process; killing it does NOT trigger relaunch, the parent has no recovery path, and the entire service goes down.

### What counts as a restart signal

Only these. Nothing else triggers a restart conversation:

- A CLI command prints a literal `Restart the gateway to apply` (or equivalent) line. `openclaw config set` and `openclaw plugins install` emit this **only** when a restart is genuinely needed; absence of the line means the change is already live.
- `openclaw doctor` reports a pending-restart entry in its summary.
- A config-mutation tool result carries `followUp.requiresRestart: true` (the SDK's structured signal — `mode: "restart"`).
- The user explicitly asks you to restart.

If none of these is present, do not raise the topic. Most config keys (provider settings, agent defaults, tool allowlist, MCP server registrations) hot-reload via the SDK's runtime-snapshot mechanism (`mode: "auto"` or `"none"`).

### When you see a signal — consult the user, do not act

1. Quote the exact line from the tool output that triggered the signal. Do not paraphrase.
2. Recommend the official command: **`openclaw gateway restart`** (`--force` to skip waiting for in-flight work; `--wait <duration>` to defer). It resolves at runtime to one of three modes — all are graceful, none requires you to kill a PID:
   - **Managed service** (launchd on macOS, systemd on Linux, scheduled task on Windows) — restart via the service manager.
   - **Same PID namespace** — CLI sends `SIGUSR1` to the gateway PID; the run loop drains in-flight work (`deferGatewayRestartUntilIdle`), then re-initialises in-process. **No process exit, the parent shell stays bound, no orphaned-process problem.** This is the path that fires when the agent and gateway run in the same container or shell session — e.g. `docker run -it openclaw bash` then `openclaw gateway run` in that shell, with the agent loop running inside the gateway.
   - **Windows scheduled-task handoff** — fallback for managed Windows installs.
3. **The only topology where `openclaw gateway restart` cannot reach the gateway** is cross-container (agent in container A, gateway in container B with separate PID namespaces). In that case the CLI returns a non-zero exit / failure message — **trust that signal**; do NOT try to "fix" it by killing PIDs from the agent side, and do NOT escalate to `docker stop` / `docker restart` either. Surface to the operator: *"This agent appears to be in a different container from the gateway; `openclaw gateway restart` can't reach the gateway PID from here. You'll need to restart the gateway container yourself via your orchestrator (Docker `restart` policy, K8s rollout, etc.)."*
4. Wait for the user to confirm before running anything restart-related. If they confirm, you may run `openclaw gateway restart` with the flags they approved — never anything else.

### Detecting your topology

Two env vars surface deployment context:

- `OPENCLAW_CONTAINER_HINT` — set by the operator or image to label the deployment shape (e.g. `"docker"`, `"k8s"`).
- `OPENCLAW_CONTAINER` — same purpose; either is honoured by OpenClaw's runtime hints.

When either is set, you are in a container. Use it to tailor your phrasing (*"this gateway is running in a container, so..."*) — but the lifecycle policy above is identical regardless of topology: surface the signal, recommend `openclaw gateway restart`, never act unilaterally, never kill.

### Hard prohibitions — no exceptions

Never, under any circumstance, regardless of how stuck the gateway looks:

- Do NOT run `openclaw gateway stop`. A stop without a guaranteed restart leaves the gateway down.
- Do NOT `kill`, `pkill`, `killall`, `kill -9`, or send any signal to a gateway PID.
- Do NOT use `lsof`, `ps`, `pgrep`, `/proc`, or any other discovery to find a gateway PID *for the purpose of killing it*. (Diagnostic inspection is fine; termination is not.)
- Do NOT `docker stop` / `docker kill` / `docker restart` / `docker compose restart` a gateway container.
- Do NOT edit the config to "force a reload" by bumping a benign field — that is the operator's call.
- Do NOT invent any other "soft restart" workaround.

### Status queries are read-only

When the user asks *"is the gateway running"* / *"what's the gateway status"* / *"is everything okay"* / similar:

- Run `openclaw gateway status` (or `--deep`) and report the output verbatim.
- **Take no state-changing action based on what you see.** A stopped or unhealthy gateway is information to deliver, not a problem to fix unilaterally. Show the user the output; ask what they want to do.

### Env-var changes are not your restart trigger either

Env-var changes (e.g. `ILMU_API_KEY`, `TELEGRAM_BOT_TOKEN`) only become visible to the gateway the next time *the operator* restarts the shell and the gateway. When the user changes one, tell them: *"The new value won't reach the running gateway until you next restart your shell and the gateway. Let me know when you've done that and we'll re-validate."* Do not initiate the restart for them.

## When to use this skill vs `ilmu-configuration`

- ILMU provider config (model, key, base URL, thinking, aliases) → `ilmu-configuration`
- Anything else (channels, gateway, agent defaults, providers, MCP, skills install, validation) → this skill

## Out of scope

- Rewriting OpenClaw's own behavior — this skill points at OpenClaw, it does not replace it.
- Claiming knowledge of specific channel/provider/MCP APIs — those change upstream; fetch the docs.
