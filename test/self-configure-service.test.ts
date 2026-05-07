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
      {
        mutations: {
          agentsMd: false,
          skill: true,
          bootstrapBump: false,
          toolAllowlist: false,
          deepwikiMcp: true,
        },
      },
      {},
    );
    expect(flags).toEqual({
      agentsMd: false,
      skill: true,
      bootstrapBump: false,
      toolAllowlist: false,
      deepwikiMcp: true,
    });
  });

  it("env override forces a mutation off even when config says true", () => {
    const flags = resolveMutationFlags(
      {
        mutations: {
          agentsMd: true,
          skill: true,
          bootstrapBump: true,
          toolAllowlist: true,
          deepwikiMcp: true,
        },
      },
      {
        ILMU_NO_AGENTS_MD: "1",
        ILMU_NO_SKILL: "yes",
        ILMU_NO_BOOTSTRAP_BUMP: "true",
        ILMU_NO_TOOL_ALLOWLIST: "on",
        ILMU_NO_DEEPWIKI_MCP: "true",
      },
    );
    expect(flags).toEqual({
      agentsMd: false,
      skill: false,
      bootstrapBump: false,
      toolAllowlist: false,
      deepwikiMcp: false,
    });
  });

  it("env override is force-off only — does not turn enabled when config disabled", () => {
    const flags = resolveMutationFlags(
      { mutations: { agentsMd: false, toolAllowlist: false, deepwikiMcp: false } },
      { ILMU_NO_AGENTS_MD: "0", ILMU_NO_TOOL_ALLOWLIST: "0", ILMU_NO_DEEPWIKI_MCP: "0" },
    );
    expect(flags.agentsMd).toBe(false);
    expect(flags.toolAllowlist).toBe(false);
    expect(flags.deepwikiMcp).toBe(false);
  });

  it("ignores empty/whitespace env values", () => {
    const flags = resolveMutationFlags(undefined, {
      ILMU_NO_AGENTS_MD: "",
      ILMU_NO_SKILL: "   ",
      ILMU_NO_BOOTSTRAP_BUMP: "false",
      ILMU_NO_TOOL_ALLOWLIST: " ",
      ILMU_NO_DEEPWIKI_MCP: "",
    });
    expect(flags).toEqual(DEFAULT_ILMU_MUTATION_FLAGS);
  });

  it("opts out of toolAllowlist independently via env", () => {
    const flags = resolveMutationFlags(undefined, { ILMU_NO_TOOL_ALLOWLIST: "1" });
    expect(flags.toolAllowlist).toBe(false);
    expect(flags.deepwikiMcp).toBe(true);
    expect(flags.bootstrapBump).toBe(true);
  });

  it("opts out of deepwikiMcp independently via env", () => {
    const flags = resolveMutationFlags(undefined, { ILMU_NO_DEEPWIKI_MCP: "true" });
    expect(flags.deepwikiMcp).toBe(false);
    expect(flags.toolAllowlist).toBe(true);
    expect(flags.bootstrapBump).toBe(true);
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
