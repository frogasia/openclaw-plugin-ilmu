import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { resolveStateDir } from "openclaw/plugin-sdk/state-paths";
import type { OpenClawPluginService, OpenClawPluginServiceContext } from "openclaw/plugin-sdk/core";
import {
  applyAgentsMdMutation,
  type IlmuAgentsMdPaths,
} from "./agents-md-prompt.js";
import {
  applyBootstrapFloorMutation,
  DEFAULT_BOOTSTRAP_FLOORS,
  summarizeBootstrapFloorPlan,
} from "./bootstrap-floor.js";
import { applyDeepwikiMcpMutation, summarizeDeepwikiMcpPlan } from "./deepwiki-mcp.js";
import {
  ALL_SKILLS,
  applySkillWrite,
  ILMU_SKILL_SLUG,
  OPENCLAW_SKILL_SLUG,
  resolveSkillPath,
  resolveSkillsDir,
} from "./skill-writer.js";
import {
  applyToolAllowlistMutation,
  summarizeToolAllowlistPlan,
} from "./tool-allowlist.js";

export const ILMU_SELF_CONFIGURE_SERVICE_ID = "ilmu/self-configure";
export const AGENTS_MD_FILENAME = "AGENTS.md";

export type IlmuMutationFlags = {
  agentsMd: boolean;
  skill: boolean;
  bootstrapBump: boolean;
  toolAllowlist: boolean;
  deepwikiMcp: boolean;
};

export type IlmuPluginConfig = {
  mutations?: Partial<IlmuMutationFlags>;
};

export const DEFAULT_ILMU_MUTATION_FLAGS: IlmuMutationFlags = {
  agentsMd: true,
  skill: true,
  bootstrapBump: true,
  toolAllowlist: true,
  deepwikiMcp: true,
};

type Logger = OpenClawPluginServiceContext["logger"];

export function resolveMutationFlags(
  config: IlmuPluginConfig | undefined,
  env: NodeJS.ProcessEnv = process.env,
): IlmuMutationFlags {
  const flags: IlmuMutationFlags = {
    agentsMd: config?.mutations?.agentsMd ?? DEFAULT_ILMU_MUTATION_FLAGS.agentsMd,
    skill: config?.mutations?.skill ?? DEFAULT_ILMU_MUTATION_FLAGS.skill,
    bootstrapBump:
      config?.mutations?.bootstrapBump ?? DEFAULT_ILMU_MUTATION_FLAGS.bootstrapBump,
    toolAllowlist:
      config?.mutations?.toolAllowlist ?? DEFAULT_ILMU_MUTATION_FLAGS.toolAllowlist,
    deepwikiMcp:
      config?.mutations?.deepwikiMcp ?? DEFAULT_ILMU_MUTATION_FLAGS.deepwikiMcp,
  };
  if (isTruthyEnv(env.ILMU_NO_AGENTS_MD)) flags.agentsMd = false;
  if (isTruthyEnv(env.ILMU_NO_SKILL)) flags.skill = false;
  if (isTruthyEnv(env.ILMU_NO_BOOTSTRAP_BUMP)) flags.bootstrapBump = false;
  if (isTruthyEnv(env.ILMU_NO_TOOL_ALLOWLIST)) flags.toolAllowlist = false;
  if (isTruthyEnv(env.ILMU_NO_DEEPWIKI_MCP)) flags.deepwikiMcp = false;
  return flags;
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export type ResolvedIlmuPaths = IlmuAgentsMdPaths & {
  agentsMdPath: string;
};

export function resolveIlmuPaths(params: {
  workspaceDir: string;
  configPath: string;
}): ResolvedIlmuPaths {
  return {
    workspaceDir: params.workspaceDir,
    configPath: params.configPath,
    skillsDir: resolveSkillsDir(params.workspaceDir),
    skillPath: resolveSkillPath(params.workspaceDir, ILMU_SKILL_SLUG),
    openclawSkillPath: resolveSkillPath(params.workspaceDir, OPENCLAW_SKILL_SLUG),
    agentsMdPath: join(params.workspaceDir, AGENTS_MD_FILENAME),
  };
}

export function resolveWorkspaceDir(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.OPENCLAW_WORKSPACE_DIR?.trim();
  if (explicit) return resolve(explicit);
  const home = env.OPENCLAW_HOME?.trim();
  if (home) return resolve(home, "workspace");
  return resolve(homedir(), ".openclaw", "workspace");
}

export function resolveConfigPath(
  stateDir: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = env.OPENCLAW_CONFIG_PATH?.trim();
  if (explicit) return resolve(explicit);
  return join(stateDir, "openclaw.json");
}

async function isWorkspaceReady(workspaceDir: string): Promise<boolean> {
  try {
    await access(join(workspaceDir, AGENTS_MD_FILENAME));
    return true;
  } catch {
    return false;
  }
}

function readPluginConfig(ctx: OpenClawPluginServiceContext): IlmuPluginConfig | undefined {
  const entries = (ctx.config as { plugins?: { entries?: Record<string, { config?: unknown }> } })
    ?.plugins?.entries;
  return (entries?.ilmu?.config ?? undefined) as IlmuPluginConfig | undefined;
}

export async function runIlmuSelfConfigure(
  ctx: OpenClawPluginServiceContext,
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<void> {
  const env = options.env ?? process.env;
  const logger = ctx.logger;

  const workspaceDir = ctx.workspaceDir ?? resolveWorkspaceDir(env);
  const stateDir = resolveStateDir(env);
  const configPath = resolveConfigPath(stateDir, env);

  if (!(await isWorkspaceReady(workspaceDir))) {
    logger.debug?.(
      `ilmu plugin: workspace not ready at ${workspaceDir} (no AGENTS.md), deferring self-configure mutations.`,
    );
    return;
  }

  const flags = resolveMutationFlags(readPluginConfig(ctx), env);
  const paths = resolveIlmuPaths({ workspaceDir, configPath });

  if (flags.agentsMd) {
    await runIsolated(logger, "agents-md", paths.agentsMdPath, async () => {
      const action = await applyAgentsMdMutation(paths.agentsMdPath, paths);
      logger.info?.(`ilmu plugin: AGENTS.md ${action} at ${paths.agentsMdPath}`);
    });
  }

  if (flags.skill) {
    for (const spec of ALL_SKILLS) {
      await runIsolated(logger, `skill[${spec.slug}]`, resolveSkillsDir(paths.workspaceDir), async () => {
        const result = await applySkillWrite(spec, {
          workspaceDir: paths.workspaceDir,
          configPath: paths.configPath,
        });
        logger.info?.(`ilmu plugin: skill[${spec.slug}] ${result.action} at ${result.path}`);
      });
    }
  }

  if (flags.bootstrapBump) {
    await runIsolated(logger, "bootstrap-floor", configPath, async () => {
      const plan = await applyBootstrapFloorMutation(DEFAULT_BOOTSTRAP_FLOORS);
      logger.info?.(summarizeBootstrapFloorPlan(plan));
    });
  }

  if (flags.toolAllowlist) {
    await runIsolated(logger, "tool-allowlist", configPath, async () => {
      const plan = await applyToolAllowlistMutation();
      logger.info?.(summarizeToolAllowlistPlan(plan));
    });
  }

  if (flags.deepwikiMcp) {
    await runIsolated(logger, "deepwiki-mcp", configPath, async () => {
      const plan = await applyDeepwikiMcpMutation();
      logger.info?.(summarizeDeepwikiMcpPlan(plan));
    });
  }
}

async function runIsolated(
  logger: Logger,
  label: string,
  affected: string,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn?.(
      `ilmu plugin: ${label} mutation failed for ${affected}: ${message}. Run \`openclaw doctor --fix\` to investigate.`,
    );
  }
}

export function buildIlmuSelfConfigureService(): OpenClawPluginService {
  return {
    id: ILMU_SELF_CONFIGURE_SERVICE_ID,
    start: (ctx) => runIlmuSelfConfigure(ctx),
  };
}
