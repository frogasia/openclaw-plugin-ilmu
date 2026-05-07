import { describe, expect, it } from "vitest";
import {
  DEFAULT_ILMU_MUTATION_FLAGS,
  resolveConfigPath,
  resolveIlmuPaths,
  resolveMutationFlags,
  resolveWorkspaceDir,
} from "../src/self-configure-service.ts";

describe("resolveMutationFlags", () => {
  it("defaults to all-true with no config and no env overrides", () => {
    const flags = resolveMutationFlags(undefined, {});
    expect(flags).toEqual(DEFAULT_ILMU_MUTATION_FLAGS);
  });

  it("respects per-mutation booleans from plugin config", () => {
    const flags = resolveMutationFlags(
      { mutations: { agentsMd: false, skill: true, bootstrapBump: false } },
      {},
    );
    expect(flags).toEqual({ agentsMd: false, skill: true, bootstrapBump: false });
  });

  it("env override forces a mutation off even when config says true", () => {
    const flags = resolveMutationFlags(
      { mutations: { agentsMd: true, skill: true, bootstrapBump: true } },
      { ILMU_NO_AGENTS_MD: "1", ILMU_NO_SKILL: "yes", ILMU_NO_BOOTSTRAP_BUMP: "true" },
    );
    expect(flags).toEqual({ agentsMd: false, skill: false, bootstrapBump: false });
  });

  it("env override is force-off only — does not turn enabled when config disabled", () => {
    const flags = resolveMutationFlags(
      { mutations: { agentsMd: false } },
      { ILMU_NO_AGENTS_MD: "0" },
    );
    expect(flags.agentsMd).toBe(false);
  });

  it("ignores empty/whitespace env values", () => {
    const flags = resolveMutationFlags(undefined, {
      ILMU_NO_AGENTS_MD: "",
      ILMU_NO_SKILL: "   ",
      ILMU_NO_BOOTSTRAP_BUMP: "false",
    });
    expect(flags).toEqual(DEFAULT_ILMU_MUTATION_FLAGS);
  });
});

describe("resolveWorkspaceDir", () => {
  it("uses OPENCLAW_WORKSPACE_DIR when set", () => {
    expect(resolveWorkspaceDir({ OPENCLAW_WORKSPACE_DIR: "/explicit/ws" })).toBe("/explicit/ws");
  });

  it("derives from OPENCLAW_HOME when only home is set", () => {
    expect(resolveWorkspaceDir({ OPENCLAW_HOME: "/custom/home" })).toBe("/custom/home/workspace");
  });

  it("falls back to ~/.openclaw/workspace by default", () => {
    const result = resolveWorkspaceDir({});
    expect(result).toMatch(/\.openclaw\/workspace$/);
  });
});

describe("resolveConfigPath", () => {
  it("uses OPENCLAW_CONFIG_PATH when set", () => {
    expect(resolveConfigPath("/state", { OPENCLAW_CONFIG_PATH: "/custom/openclaw.json" })).toBe(
      "/custom/openclaw.json",
    );
  });

  it("joins stateDir with default filename otherwise", () => {
    expect(resolveConfigPath("/state", {})).toBe("/state/openclaw.json");
  });
});

describe("resolveIlmuPaths", () => {
  it("derives all paths (including both skill paths) from workspaceDir + configPath", () => {
    const paths = resolveIlmuPaths({
      workspaceDir: "/ws",
      configPath: "/cfg/openclaw.json",
    });
    expect(paths).toEqual({
      workspaceDir: "/ws",
      configPath: "/cfg/openclaw.json",
      skillsDir: "/ws/skills",
      skillPath: "/ws/skills/ilmu-configuration/SKILL.md",
      openclawSkillPath: "/ws/skills/openclaw-configuration/SKILL.md",
      agentsMdPath: "/ws/AGENTS.md",
    });
  });
});
