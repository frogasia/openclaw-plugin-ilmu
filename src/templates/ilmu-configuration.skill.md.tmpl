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

### 1. Switch the default model to a different ILMU model

1. Read `{{configPath}}`.
2. Locate `agents.defaults.primaryModel` (string, e.g. `"ilmu/nemo-super"`).
3. Replace with the desired ILMU model ref. Valid refs:
   - `ilmu/nemo-super`
   - `ilmu/ilmu-nemo-nano`
4. If you also want a friendly alias, edit `agents.defaults.models["ilmu/<model>"].alias`.
5. Save the file. Restart any running OpenClaw session for the change to take effect.

### 2. Add or rotate an ILMU API key

API keys are read from the `ILMU_API_KEY` env var by default. To rotate:

1. Update the env var in the user's shell profile (`~/.zshrc`, `~/.bashrc`, or the systemd unit / launchd plist depending on platform).
2. Restart OpenClaw.

If the user wants the key persisted in config instead:

1. Read `{{configPath}}`.
2. Set `models.providers.ilmu.apiKey` to the new key.
3. Save and restart.

### 3. Change the ILMU base URL (e.g. for a staging endpoint)

1. Read `{{configPath}}`.
2. Set `models.providers.ilmu.baseUrl` to the new URL (no trailing slash).
3. Save and restart.

### 4. Tune the thinking budget

ILMU models support reasoning. The plugin seeds `agents.defaults.thinkingDefault = "medium"` on first onboarding. Valid values: `"off" | "low" | "medium" | "high"`.

1. Read `{{configPath}}`.
2. Set `agents.defaults.thinkingDefault`.
3. Save and restart.

### 5. Add or update model aliases

1. Read `{{configPath}}`.
2. Edit `agents.defaults.models["ilmu/<model>"].alias` (string).
3. Save and restart.

## Validation

After every edit, validate with:

```sh
openclaw doctor
```

`openclaw doctor` will surface schema errors, missing API keys, unreachable endpoints, and conflicting overrides.

If validation fails, **do not** modify the config further — show the doctor output to the user and ask before continuing.

## Restart cadence

- Config edits require a session restart to take effect (the config is read at session start).
- Env var changes (`ILMU_API_KEY`) require a shell restart **before** restarting OpenClaw.

## References

### ILMU

- **ILMUClaw cookbook** — recipes, tuning, troubleshooting:
  https://docs.ilmu.ai/docs/developer-tools/openclaw-cookbook

### OpenClaw (broader setup help)

- **Channels** — wiring Slack / Discord / etc:
  https://docs.openclaw.ai/channels
- **Showcase** — example agents and configurations:
  https://docs.openclaw.ai/start/showcase

## Out of scope for this skill

- Editing OpenClaw bootstrap files (`AGENTS.md`, `SOUL.md`, `IDENTITY.md`, etc.).
- Changing global agent defaults that are not under `agents.defaults` for ILMU.
- Provisioning ILMU accounts or managing billing — direct the user to the ILMU admin console.
