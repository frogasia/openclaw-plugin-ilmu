# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ILMU LLM provider plugin for [OpenClaw](https://docs.openclaw.ai), published to npm as `@ytlailabs/ilmu-openclaw-plugin`. It exposes two ILMU models (`ilmu/nemo-super`, `ilmu/nemo-nano`) via OpenAI-compatible API, registers as a provider on plugin load, and **mutates the host workspace on every gateway start** (AGENTS.md block, skills, defaults). The README is authoritative for end-user installation and configuration; this file is for engineers modifying the plugin itself.

## Common commands

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` — typecheck only, no output. |
| `npm test` | `vitest run` — unit + integration tests. Live tests skip without env vars. |
| `npm test -- test/<file>.test.ts` | Run a single test file. |
| `npm run build` | `tsc -p tsconfig.build.json && cp -R src/templates dist/templates`. |
| `npm pack --dry-run --json` | Inspect the publishable tarball file list (used by CI assertions). |
| `OPENCLAW_LIVE_TEST=1 ILMU_LIVE_TEST=1 ILMU_API_KEY=sk-... npm test` | Run live tests against the real ILMU API. |

## Architecture

Three layers, in dependency order:

1. **Provider registration.** `src/index.ts` exports a `defineSingleProviderPluginEntry` that wires the static model catalog (`src/models.ts`, `src/provider-catalog.ts`, `src/provider-discovery.ts`) into OpenClaw. The plugin's contract with the OpenClaw CLI lives in `openclaw.plugin.json` (NOT `package.json`) — `providerDiscoveryEntry`, `providerAuthChoices`, and `configSchema` are read by the CLI directly.

2. **Onboarding.** `src/onboard.ts` (`applyIlmuConfig`) sets the default model ref when a user runs `openclaw onboard --auth-choice ilmu-api-key`.

3. **Self-configure.** `src/self-configure-service.ts` runs on every gateway start (gated on workspace `AGENTS.md` existing). It orchestrates five mutations, each wrapped in `runIsolated()` so one failure logs a warning but does not block the others or the provider registration:

   | Module | What it does | Force-off env var |
   |---|---|---|
   | `agents-md-prompt.ts` | Inserts/replaces `<ilmu-platform-prompt>` block in workspace `AGENTS.md`. Idempotent via SHA-256 hash attribute. | `ILMU_NO_AGENTS_MD` |
   | `skill-writer.ts` | Writes `ilmu-configuration` and `openclaw-configuration` skills to the workspace. Templates loaded from `src/templates/*.tmpl`. | `ILMU_NO_SKILL` |
   | `bootstrap-floor.ts` | **Raise-only** for `agents.defaults.bootstrapMaxChars` (≥32k) and `bootstrapTotalMaxChars` (≥200k); sets `thinkingDefault`. Never lowers user values. | `ILMU_NO_BOOTSTRAP_BUMP` |
   | `tool-allowlist.ts` | Adds MCP tools to `agents.defaults` allowlist. | `ILMU_NO_TOOL_ALLOWLIST` |
   | `deepwiki-mcp.ts` | Ensures the deepwiki MCP server is configured and enabled. | `ILMU_NO_DEEPWIKI_MCP` |

   Per-mutation toggles also exist in plugin config under `mutations.{agentsMd,skill,bootstrapBump}` (see `openclaw.plugin.json#configSchema`).

## Build / publish invariants — READ BEFORE TOUCHING package.json OR tsconfig

- The published artifact is **`dist/`, not `src/`**. The OpenClaw loader cannot execute `.ts` files. `package.json#files` ships `dist/`, `skills/`, `openclaw.plugin.json`, `README.md`, `LICENSE`.
- `package.json#openclaw.extensions` and `openclaw.plugin.json#providerDiscoveryEntry` both point at `./dist/*.js`. If you change these, also update the build assertions in `.github/workflows/{ci,release}.yml`.
- `tsconfig.json` is **typecheck-only** (`noEmit: true`, `allowImportingTsExtensions: true`). Emit goes through `tsconfig.build.json` — keep them split. Source uses `.js` import specifiers (NodeNext) even though the files are `.ts`; the typecheck flow needs `allowImportingTsExtensions: true` while emit needs the opposite.
- `cp -R src/templates dist/templates` is part of `build` because `tsc` does not copy non-TS files. Templates are loaded at runtime via `new URL("./templates/...", import.meta.url)` (resolved relative to the emitted `.js`). If you add another non-`.ts` runtime resource, extend the build step and the CI assertion.
- `prepublishOnly` runs typecheck + test + build, so any `npm publish` (laptop or CI) is blocked unless the tarball has compiled output. CI additionally asserts the tarball file list via `npm pack --dry-run --json`.

## Release flow

1. `npm version <patch|minor|major>` on `main` (creates commit + tag locally).
2. `git push origin main --follow-tags`.
3. GitHub → Releases → Draft → pick the new tag → publish.
4. `release.yml` runs: typecheck → test → build → assert tarball ships `dist/index.js`/`dist/provider-discovery.js`/`dist/templates/agents-md-block.tmpl` → assert `package.json` version matches release tag → `npm publish --provenance`.
5. A separate `verify-install` job then installs the OpenClaw CLI on a fresh runner, waits for npm registry propagation, and runs `openclaw plugins install @ytlailabs/ilmu-openclaw-plugin@<tag>` to reproduce the end-user flow. If this fails, the published artifact is broken — patch, bump, re-release.

## Testing patterns

- `test/*.test.ts` — unit, runs by default.
- `test/*.integration.test.ts` — exercises mutations end-to-end against a temp workspace.
- `test/*.live.test.ts` — hits the real ILMU API; skipped unless `OPENCLAW_LIVE_TEST=1` and `ILMU_LIVE_TEST=1` and `ILMU_API_KEY=...` are set.

`vitest.config.ts` includes `test/**/*.test.ts` — integration and live tests match this glob too. "Live" skipping is via `describe.skipIf` inside the test file, not glob exclusion.

## Conventions

- ESM throughout (`"type": "module"`). Relative imports use `.js` specifiers even for `.ts` source — this is NodeNext. Do not "fix" them to `.ts`.
- Local `npm link` consumers see whatever's in `dist/` — re-run `npm run build` after every source edit, or they'll load stale/missing JS.
- Self-configure mutations must be **idempotent and raise-only**. The plugin runs on every gateway start; users will lose customisations if a mutation overwrites unconditionally.
- New self-configure mutations follow the existing pattern: a function in `src/<name>.ts`, registered in `self-configure-service.ts` inside `runIsolated()`, with an `ILMU_NO_<NAME>` force-off env var and a `mutations.<name>` flag in `openclaw.plugin.json#configSchema`. Add a `test/<name>.test.ts` and an integration scenario in `test/self-configure-service.integration.test.ts`.
- Commit messages use conventional-commit prefixes (`fix:`, `feat:`, `chore:`, etc.). If the branch name or related Jira ticket has a `CSO-XXX` ID, include `[CSO-XXX]` in the PR title.
