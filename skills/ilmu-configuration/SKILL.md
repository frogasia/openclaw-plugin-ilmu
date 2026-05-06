---
name: ilmu-configuration
description: Configure the ILMU provider in OpenClaw — change default model, add/rotate API keys, set base URL, tune thinking budget, define model aliases. Use whenever the user asks to switch ILMU model, change ILMU settings, or troubleshoot ILMU auth.
---

# ILMU configuration

This skill is the canonical entry point for editing the ILMU provider in OpenClaw. Read it before running any discovery commands.

## Where things live

- OpenClaw config (single source of truth): `{{configPath}}`
- Workspace root: `{{workspaceDir}}`
- This skill: `{{skillPath}}`

The config file is JSON-with-comments (jsonc). Preserve user comments and trailing-comma style when editing.

## Common tasks

### 1. Switch the default ILMU model

1. Locate the field with `openclaw config schema lookup agents.defaults.model.primary`.
2. Use `openclaw config set agents.defaults.model.primary '"ilmu/<model>"'` (quote the JSON value). Valid refs: `ilmu/nemo-super`, `ilmu/ilmu-nemo-nano`.
3. If you want a friendly alias, edit `agents.defaults.models["ilmu/<model>"].alias` directly in `{{configPath}}`.
4. Validate, then follow the restart guidance below.

### 2. Add or rotate an ILMU API key

API keys are read from the `ILMU_API_KEY` env var by default.

- **Env-var path (recommended):** update `ILMU_API_KEY` in the user's shell profile or service unit. The new value is not visible to the running gateway, so a shell restart and gateway restart are both required.
- **Config-persisted path:** set `models.providers.ilmu.apiKey` in `{{configPath}}`. Validate. Restart only if the tool tells you to.

### 3. Change the ILMU base URL (e.g. staging endpoint)

1. Set `models.providers.ilmu.baseUrl` in `{{configPath}}` (no trailing slash).
2. Validate, then follow the restart guidance below.

### 4. Tune the thinking budget

ILMU models support reasoning. The plugin seeds `agents.defaults.thinkingDefault = "medium"` on first onboarding. Valid values: `"off" | "low" | "medium" | "high"`.

1. `openclaw config set agents.defaults.thinkingDefault '"<value>"'`.
2. Validate, then follow the restart guidance below.

### 5. Add or update model aliases

1. Edit `agents.defaults.models["ilmu/<model>"].alias` in `{{configPath}}`.
2. Validate, then follow the restart guidance below.

## Validation

After every edit:

```sh
openclaw doctor
```

`openclaw doctor` surfaces schema errors, missing API keys, unreachable endpoints, and conflicting overrides. If it reports errors, **do not** modify the config further — show the doctor output to the user and ask before continuing.

## Restart cadence

OpenClaw decides whether a restart is needed; do not assume:

- `openclaw config set` and `openclaw plugins install` print `Restart the gateway to apply.` ONLY when a restart is needed. Trust that line.
- `openclaw doctor` flags pending restarts in its summary.
- **Only restart if the tool explicitly says so.** Restarts can take 30s–2min depending on environment.
- Env-var changes (`ILMU_API_KEY`) DO require a shell restart followed by a gateway restart, because the new env value is not visible to the running gateway.

For broader OpenClaw configuration concerns (channels, gateway, agent defaults beyond ILMU, providers, MCP), use the `openclaw-configuration` skill.

## References

- **ILMUClaw cookbook** — recipes, tuning, troubleshooting:
  https://docs.ilmu.ai/docs/developer-tools/openclaw-cookbook

## Out of scope for this skill

- Editing OpenClaw bootstrap files (`AGENTS.md`, `SOUL.md`, `IDENTITY.md`, etc.).
- Changing global agent defaults that are not under `agents.defaults` for ILMU.
- Provisioning ILMU accounts or managing billing — direct the user to the ILMU admin console.
