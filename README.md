# Ilmu OpenClaw Plugin

[![npm](https://img.shields.io/npm/v/@frogasia/ilmu-openclaw-plugin.svg)](https://www.npmjs.com/package/@frogasia/ilmu-openclaw-plugin)

OpenClaw plugin that registers [Ilmu](https://ilmu.ai) as an LLM provider. Ilmu exposes its models through an OpenAI-compatible API, so this plugin reuses OpenClaw's standard `openai-completions` replay family — no custom transport.

| Property | Value |
| --- | --- |
| Provider id | `ilmu` |
| Auth env var | `ILMU_API_KEY` |
| API | OpenAI-compatible |
| Base URL | `https://api.ilmu.ai/v1` |
| Default model | `ilmu/nemo-super` |

## Models

| Model ref | Name | Context | Max output | Notes |
| --- | --- | --- | --- | --- |
| `ilmu/nemo-super` | Ilmu Nemo Super | 256,000 | 128,000 | Default; flagship reasoning tier |
| `ilmu/ilmu-nemo-nano` | Ilmu Nemo Nano | 256,000 | 128,000 | Lighter sibling for cheaper turns |

Both models declare `reasoning: true`. Onboarding seeds `agents.defaults.thinkingDefault: "medium"` so step-by-step thinking is on out of the box.

## Install

```bash
npm install @frogasia/ilmu-openclaw-plugin
```

Or via the OpenClaw CLI once published to Clawhub:

```bash
openclaw plugin install @frogasia/ilmu-openclaw-plugin
```

## Onboard

```bash
openclaw onboard --auth-choice ilmu-api-key
```

This prompts for your API key, stores it as `ILMU_API_KEY`, and sets `ilmu/nemo-super` as the agent's default primary model.

Verify:

```bash
openclaw models list --provider ilmu
```

### Non-interactive (scripts / CI)

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice ilmu-api-key \
  --ilmu-api-key "$ILMU_API_KEY" \
  --skip-health \
  --accept-risk
```

If the OpenClaw Gateway runs as a daemon (launchd / systemd), make sure `ILMU_API_KEY` is available to that process — for example via `~/.openclaw/.env` or `env.shellEnv`.

## Custom base URL (sovereign / self-hosted Ilmu)

Override the base URL through standard provider config:

```json5
{
  models: {
    providers: {
      ilmu: {
        baseUrl: "https://api.your-ilmu-deployment.example/v1",
      },
    },
  },
}
```

The plugin keeps `api: "openai-completions"` and the bundled model catalog, so a private deployment serving the same model IDs works without further changes.

## Live tests

Live tests are gated on `OPENCLAW_LIVE_TEST=1`, `ILMU_LIVE_TEST=1`, and `ILMU_API_KEY`:

```bash
OPENCLAW_LIVE_TEST=1 ILMU_LIVE_TEST=1 ILMU_API_KEY=sk-... npm test
```

Without the env vars, vitest skips the live suite and only the unit tests run.

## Development

```bash
npm install
npm run typecheck
npm test
```

This plugin ships TypeScript sources directly (no build step). `package.json` declares `openclaw.extensions: ["./src/index.ts"]` and the OpenClaw host loads TS at runtime.

## Releases

Releases are engineer-gated and triggered by publishing a [GitHub Release](https://github.com/frogasia/openclaw-plugin-ilmu/releases). Maintainer flow:

```bash
# 1. From a clean main with the checkpoint commit at HEAD:
git checkout main && git pull

# 2. Bump version (creates a commit + an annotated tag like v0.2.0):
npm version minor    # or patch / major

# 3. Push the bump commit + tag together:
git push origin main --follow-tags
```

Then on GitHub: **Releases → Draft a new release → pick the tag you just pushed → write release notes → Publish**.

Publishing the GitHub Release triggers `.github/workflows/release.yml`, which:
1. Checks out the tagged commit.
2. Runs typecheck + tests.
3. Verifies `package.json` version matches the tag.
4. `npm publish --access public --provenance`.

The repo needs an `NPM_TOKEN` secret (npm publish-scope token, set under Settings → Secrets and variables → Actions). The workflow uses [npm provenance](https://docs.npmjs.com/generating-provenance-statements) — published versions show a verified link back to this repo and commit.

## License

MIT — see [LICENSE](./LICENSE).
