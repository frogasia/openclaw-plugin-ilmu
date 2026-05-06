import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyIlmuSkillWrite,
  ILMU_SKILL_FILENAME,
  ILMU_SKILL_SLUG,
  renderIlmuSkill,
  resolveIlmuSkillPath,
  resolveIlmuSkillsDir,
} from "../src/skill-writer.ts";

describe("path resolvers", () => {
  it("places the skill under <workspace>/skills/<slug>/SKILL.md", () => {
    expect(resolveIlmuSkillsDir("/ws")).toBe("/ws/skills");
    expect(resolveIlmuSkillPath("/ws")).toBe(`/ws/skills/${ILMU_SKILL_SLUG}/${ILMU_SKILL_FILENAME}`);
  });
});

describe("renderIlmuSkill", () => {
  it("substitutes all placeholders with absolute paths", async () => {
    const rendered = await renderIlmuSkill({
      workspaceDir: "/ws",
      configPath: "/cfg/openclaw.json",
    });
    expect(rendered).toContain("/ws");
    expect(rendered).toContain("/cfg/openclaw.json");
    expect(rendered).toContain(`/ws/skills/${ILMU_SKILL_SLUG}/${ILMU_SKILL_FILENAME}`);
    expect(rendered).not.toContain("{{");
    expect(rendered).not.toContain("}}");
  });

  it("preserves the YAML frontmatter so OpenClaw skill discovery can parse it", async () => {
    const rendered = await renderIlmuSkill({
      workspaceDir: "/ws",
      configPath: "/ws/openclaw.json",
    });
    expect(rendered.startsWith("---\n")).toBe(true);
    expect(rendered).toContain("name: ilmu-configuration");
    expect(rendered).toMatch(/^description: /m);
  });
});

describe("applyIlmuSkillWrite (filesystem)", () => {
  let workspaceDir: string;

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), "ilmu-skill-"));
  });

  it("writes SKILL.md to the workspace skills dir", async () => {
    const result = await applyIlmuSkillWrite({
      workspaceDir,
      configPath: join(workspaceDir, "openclaw.json"),
    });
    expect(result.action).toBe("wrote");
    expect(result.path).toBe(resolveIlmuSkillPath(workspaceDir));
    const content = await readFile(result.path, "utf8");
    expect(content).toContain(workspaceDir);
  });

  it("is a no-op when content already matches (idempotent)", async () => {
    const first = await applyIlmuSkillWrite({
      workspaceDir,
      configPath: join(workspaceDir, "openclaw.json"),
    });
    expect(first.action).toBe("wrote");

    const second = await applyIlmuSkillWrite({
      workspaceDir,
      configPath: join(workspaceDir, "openclaw.json"),
    });
    expect(second.action).toBe("noop-content-match");
  });

  it("overwrites when previous content differs", async () => {
    const skillPath = resolveIlmuSkillPath(workspaceDir);
    await mkdir(join(workspaceDir, "skills", ILMU_SKILL_SLUG), { recursive: true });
    await writeFile(skillPath, "stale content", "utf8");

    const result = await applyIlmuSkillWrite({
      workspaceDir,
      configPath: join(workspaceDir, "openclaw.json"),
    });
    expect(result.action).toBe("wrote");
    const content = await readFile(skillPath, "utf8");
    expect(content).not.toBe("stale content");
    expect(content).toContain("ilmu-configuration");
  });
});
