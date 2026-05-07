import {
  applyAgentDefaultModelPrimary,
  applyProviderConfigWithModelCatalog,
  type OpenClawConfig,
} from "openclaw/plugin-sdk/provider-onboard";
import { buildIlmuModelDefinition, ILMU_BASE_URL, ILMU_MODEL_CATALOG } from "./api.js";

export const ILMU_MODEL_REF_SUPER = "ilmu/nemo-super";
export const ILMU_MODEL_REF_NANO = "ilmu/ilmu-nemo-nano";
export const ILMU_DEFAULT_MODEL_REF = ILMU_MODEL_REF_SUPER;

// Pre-CSO-614 only the Super model was seeded into agents.defaults.models, with
// the bare "ILMU" alias. We migrate that exact legacy string to the descriptive
// default; any other operator-set alias is preserved.
const ILMU_LEGACY_ALIAS = "ILMU";

const ILMU_DEFAULT_ALIASES: Record<string, string> = {
  [ILMU_MODEL_REF_SUPER]: "ILMU Nemo Super",
  [ILMU_MODEL_REF_NANO]: "ILMU Nemo Nano",
};

function resolveAlias(current: string | undefined, defaultAlias: string): string {
  if (current === undefined) return defaultAlias;
  if (current === ILMU_LEGACY_ALIAS) return defaultAlias;
  return current;
}

export function applyIlmuProviderConfig(cfg: OpenClawConfig): OpenClawConfig {
  const models = { ...cfg.agents?.defaults?.models };
  for (const [ref, defaultAlias] of Object.entries(ILMU_DEFAULT_ALIASES)) {
    models[ref] = {
      ...models[ref],
      alias: resolveAlias(models[ref]?.alias, defaultAlias),
    };
  }

  return applyProviderConfigWithModelCatalog(cfg, {
    agentModels: models,
    providerId: "ilmu",
    api: "openai-completions",
    baseUrl: ILMU_BASE_URL,
    catalogModels: ILMU_MODEL_CATALOG.map(buildIlmuModelDefinition),
  });
}

export function applyIlmuConfig(cfg: OpenClawConfig): OpenClawConfig {
  const withProvider = applyIlmuProviderConfig(cfg);
  // Seed thinking-on defaults when the user picks ILMU. Use `??` so an
  // explicit user choice (including "off") is never clobbered by re-running
  // the wizard.
  const withDefaults: OpenClawConfig = {
    ...withProvider,
    agents: {
      ...withProvider.agents,
      defaults: {
        ...withProvider.agents?.defaults,
        thinkingDefault: withProvider.agents?.defaults?.thinkingDefault ?? "medium",
      },
    },
  };
  return applyAgentDefaultModelPrimary(withDefaults, ILMU_DEFAULT_MODEL_REF);
}
