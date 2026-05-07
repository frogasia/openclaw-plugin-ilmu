import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenClawPluginServiceContext } from "openclaw/plugin-sdk/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runIlmuSelfConfigure } from "../src/self-configure-service.ts";
import { ILMU_SKILL_SLUG, OPENCLAW_SKILL_SLUG } from "../src/skill-writer.ts";

type CapturedLogger = {
  info: string[];
  warn: string[];
  debug: string[];
  error: string[];
};

function buildLogger(): { logger: OpenClawPluginServiceContext["logger"]; captured: CapturedLogger } {
  const captured: CapturedLogger = { info: [], warn: [], debug: [], error: [] };
  const logger = {
    info: (msg: string) => captured.info.push(msg),
    warn: (msg: string) => captured.warn.push(msg),
    debug: (msg: string) => captured.debug.push(msg),
    error: (msg: string) => captured.error.push(msg),
  } as OpenClawPluginServiceContext["logger"];
  return { logger, captured };
}

function buildContext(
  workspaceDir: string,
  pluginConfig?: Record<string, unknown>,
): { ctx: OpenClawPluginServiceContext; captured: CapturedLogger } {
  const { logger, captured } = buildLogger();
  const config = pluginConfig
    ? ({ plugins: { entries: { ilmu: { config: pluginConfig } } } } as unknown)
    : ({} as unknown);
  const ctx: OpenClawPluginServiceContext = {
    config: config as OpenClawPluginServiceContext["config"],
    workspaceDir,
    stateDir: workspaceDir,
    logger,
  };
  return { ctx, captured };
}

// All tests skip the bootstrap-floor mutation because it goes through the SDK's
// mutateConfigFile, which writes to the canonical openclaw.json path resolved
// from the environment (not parameterizable per call). Bootstrap behaviour is
// already covered by test/bootstrap-floor.test.ts.
const ENV_NO_BOOTSTRAP = { ILMU_NO_BOOTSTRAP_BUMP: "1" } as NodeJS.ProcessEnv;

describe("runIlmuSelfConfigure — workspace-ready gate", () => {
  let workspaceDir: string;

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), "ilmu-orch-gate-"));
  });

  afterEach(async () => {
    await rm(workspaceDir, { recursive: true, force: true });
  });

  it("defers all mutations when AGENTS.md is absent (workspace not onboarded yet)", async () => {
    const { ctx, captured } = buildContext(workspaceDir);

    await runIlmuSelfConfigure(ctx, { env: ENV_NO_BOOTSTRAP });

    // No file should have been created — no AGENTS.md, no skills dir.
    await expect(stat(join(workspaceDir, "AGENTS.md"))).rejects.toThrow();
    await expect(stat(join(workspaceDir, "skills"))).rejects.toThrow();
    // Nothing logged at info/warn level either: gate is silent except for debug.
    expect(captured.info).toEqual([]);
    expect(captured.warn).toEqual([]);
  });

  it("proceeds with mutations once AGENTS.md exists (workspace onboarded)", async () => {
    await writeFile(join(workspaceDir, "AGENTS.md"), "# pre-existing\n", "utf8");

    const { ctx, captured } = buildContext(workspaceDir);
    await runIlmuSelfConfigure(ctx, { env: ENV_NO_BOOTSTRAP });

    const agentsMd = await readFile(join(workspaceDir, "AGENTS.md"), "utf8");
    expect(agentsMd).toContain("<ilmu-platform-prompt");
    expect(agentsMd.startsWith("# pre-existing\n")).toBe(true);
    expect(captured.warn).toEqual([]);
  });
});

describe("runIlmuSelfConfigure — happy path fan-out", () => {
  let workspaceDir: string;

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), "ilmu-orch-happy-"));
    await writeFile(join(workspaceDir, "AGENTS.md"), "# user content\n", "utf8");
  });

  afterEach(async () => {
    await rm(workspaceDir, { recursive: true, force: true });
  });

  it("writes AGENTS.md block and BOTH skills (ilmu + openclaw) on first run", async () => {
    const { ctx, captured } = buildContext(workspaceDir);
    await runIlmuSelfConfigure(ctx, { env: ENV_NO_BOOTSTRAP });

    const ilmuSkill = await readFile(
      join(workspaceDir, "skills", ILMU_SKILL_SLUG, "SKILL.md"),
      "utf8",
    );
    const openclawSkill = await readFile(
      join(workspaceDir, "skills", OPENCLAW_SKILL_SLUG, "SKILL.md"),
      "utf8",
    );
    expect(ilmuSkill).toContain("name: ilmu-configuration");
    expect(openclawSkill).toContain("name: openclaw-configuration");

    // One info log per mutation: agents-md + 2 skills.
    expect(captured.info.filter((m) => m.includes("AGENTS.md"))).toHaveLength(1);
    expect(captured.info.filter((m) => m.includes("skill[ilmu-configuration]"))).toHaveLength(1);
    expect(captured.info.filter((m) => m.includes("skill[openclaw-configuration]"))).toHaveLength(1);
    expect(captured.warn).toEqual([]);
  });

  it("is idempotent on a second run — no new content, no warnings", async () => {
    const { ctx } = buildContext(workspaceDir);
    await runIlmuSelfConfigure(ctx, { env: ENV_NO_BOOTSTRAP });

    const agentsMdBefore = await readFile(join(workspaceDir, "AGENTS.md"), "utf8");
    const ilmuSkillBefore = await readFile(
      join(workspaceDir, "skills", ILMU_SKILL_SLUG, "SKILL.md"),
      "utf8",
    );

    const { ctx: ctx2, captured: captured2 } = buildContext(workspaceDir);
    await runIlmuSelfConfigure(ctx2, { env: ENV_NO_BOOTSTRAP });

    const agentsMdAfter = await readFile(join(workspaceDir, "AGENTS.md"), "utf8");
    const ilmuSkillAfter = await readFile(
      join(workspaceDir, "skills", ILMU_SKILL_SLUG, "SKILL.md"),
      "utf8",
    );
    expect(agentsMdAfter).toBe(agentsMdBefore);
    expect(ilmuSkillAfter).toBe(ilmuSkillBefore);
    expect(captured2.warn).toEqual([]);
  });

  it("respects per-mutation opt-out via plugin config", async () => {
    const { ctx } = buildContext(workspaceDir, {
      mutations: { agentsMd: false, skill: true, bootstrapBump: false },
    });
    await runIlmuSelfConfigure(ctx, { env: ENV_NO_BOOTSTRAP });

    // AGENTS.md untouched (still original "# user content\n").
    const agentsMd = await readFile(join(workspaceDir, "AGENTS.md"), "utf8");
    expect(agentsMd).toBe("# user content\n");

    // Skills still written.
    await stat(join(workspaceDir, "skills", ILMU_SKILL_SLUG, "SKILL.md"));
    await stat(join(workspaceDir, "skills", OPENCLAW_SKILL_SLUG, "SKILL.md"));
  });
});

describe("runIlmuSelfConfigure — failure isolation (runIsolated warn path)", () => {
  let workspaceDir: string;

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), "ilmu-orch-fail-"));
    await writeFile(join(workspaceDir, "AGENTS.md"), "# user content\n", "utf8");
  });

  afterEach(async () => {
    await rm(workspaceDir, { recursive: true, force: true });
  });

  it("logs a warning and continues when one skill write fails — other mutations still apply", async () => {
    // Force the ilmu skill write to fail by pre-creating SKILL.md as a *directory*
    // (writeFile against a directory throws EISDIR, which propagates out of
    // applySkillWrite and is caught by runIsolated).
    const ilmuSkillPath = join(workspaceDir, "skills", ILMU_SKILL_SLUG, "SKILL.md");
    await mkdir(ilmuSkillPath, { recursive: true });

    const { ctx, captured } = buildContext(workspaceDir);
    await runIlmuSelfConfigure(ctx, { env: ENV_NO_BOOTSTRAP });

    // ilmu skill mutation failed and was logged as a warning.
    expect(captured.warn.some((m) => m.includes("skill[ilmu-configuration]"))).toBe(true);
    expect(captured.warn.some((m) => m.includes("openclaw doctor --fix"))).toBe(true);

    // AGENTS.md mutation still applied (independent of the failing skill write).
    const agentsMd = await readFile(join(workspaceDir, "AGENTS.md"), "utf8");
    expect(agentsMd).toContain("<ilmu-platform-prompt");

    // openclaw skill mutation still applied (sibling skill, independent).
    const openclawSkill = await readFile(
      join(workspaceDir, "skills", OPENCLAW_SKILL_SLUG, "SKILL.md"),
      "utf8",
    );
    expect(openclawSkill).toContain("name: openclaw-configuration");
  });
});
