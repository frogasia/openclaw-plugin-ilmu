import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  ALL_SKILLS,
  applySkillWrite,
  ILMU_SKILL,
  ILMU_SKILL_SLUG,
  OPENCLAW_SKILL,
  OPENCLAW_SKILL_SLUG,
  renderSkill,
  resolveSkillPath,
  resolveSkillsDir,
  SKILL_FILENAME,
} from "../src/skill-writer.ts";

describe("path resolvers", () => {
  it("resolveSkillsDir places skills at <workspace>/skills", () => {
    expect(resolveSkillsDir("/ws")).toBe("/ws/skills");
  });

  it("resolveSkillPath places each skill at <workspace>/skills/<slug>/SKILL.md", () => {
    expect(resolveSkillPath("/ws", ILMU_SKILL_SLUG)).toBe(
      `/ws/skills/${ILMU_SKILL_SLUG}/${SKILL_FILENAME}`,
    );
    expect(resolveSkillPath("/ws", OPENCLAW_SKILL_SLUG)).toBe(
      `/ws/skills/${OPENCLAW_SKILL_SLUG}/${SKILL_FILENAME}`,
    );
  });
});

describe("renderSkill — ilmu-configuration", () => {
  it("substitutes all placeholders with absolute paths", async () => {
    const rendered = await renderSkill(ILMU_SKILL, {
      workspaceDir: "/ws",
      configPath: "/cfg/openclaw.json",
    });
    expect(rendered).toContain("/ws");
    expect(rendered).toContain("/cfg/openclaw.json");
    expect(rendered).toContain(`/ws/skills/${ILMU_SKILL_SLUG}/${SKILL_FILENAME}`);
    expect(rendered).not.toContain("{{");
    expect(rendered).not.toContain("}}");
  });

  it("preserves the YAML frontmatter so OpenClaw skill discovery can parse it", async () => {
    const rendered = await renderSkill(ILMU_SKILL, {
      workspaceDir: "/ws",
      configPath: "/ws/openclaw.json",
    });
    expect(rendered.startsWith("---\n")).toBe(true);
    expect(rendered).toContain("name: ilmu-configuration");
    expect(rendered).toMatch(/^description: /m);
  });
});

describe("renderSkill — openclaw-configuration", () => {
  it("renders with the routing-pointer language and key URLs (no leftover placeholders)", async () => {
    const rendered = await renderSkill(OPENCLAW_SKILL, {
      workspaceDir: "/ws",
      configPath: "/cfg/openclaw.json",
    });
    expect(rendered).toContain("name: openclaw-configuration");
    expect(rendered).toContain("/cfg/openclaw.json");
    expect(rendered).toContain("/ws");
    expect(rendered).toContain("https://docs.openclaw.ai/channels");
    expect(rendered).toContain("https://docs.openclaw.ai/start/showcase");
    expect(rendered).toContain("https://docs.ilmu.ai/docs/developer-tools/openclaw-cookbook");
    expect(rendered).toContain("openclaw --help");
    expect(rendered).toContain("openclaw doctor");
    expect(rendered).not.toContain("{{");
  });
});

describe("ALL_SKILLS registry", () => {
  it("contains both ilmu and openclaw skills in a stable order", () => {
    expect(ALL_SKILLS).toEqual([ILMU_SKILL, OPENCLAW_SKILL]);
    expect(ALL_SKILLS.map((s) => s.slug)).toEqual([ILMU_SKILL_SLUG, OPENCLAW_SKILL_SLUG]);
  });
});

describe("applySkillWrite (filesystem)", () => {
  let workspaceDir: string;

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), "ilmu-skill-"));
  });

  it("writes SKILL.md to the workspace skills dir for the ilmu skill", async () => {
    const result = await applySkillWrite(ILMU_SKILL, {
      workspaceDir,
      configPath: join(workspaceDir, "openclaw.json"),
    });
    expect(result.action).toBe("wrote");
    expect(result.path).toBe(resolveSkillPath(workspaceDir, ILMU_SKILL_SLUG));
    const content = await readFile(result.path, "utf8");
    expect(content).toContain(workspaceDir);
  });

  it("is a no-op when content already matches (idempotent)", async () => {
    const first = await applySkillWrite(ILMU_SKILL, {
      workspaceDir,
      configPath: join(workspaceDir, "openclaw.json"),
    });
    expect(first.action).toBe("wrote");

    const second = await applySkillWrite(ILMU_SKILL, {
      workspaceDir,
      configPath: join(workspaceDir, "openclaw.json"),
    });
    expect(second.action).toBe("noop-content-match");
  });

  it("overwrites when previous content differs", async () => {
    const skillPath = resolveSkillPath(workspaceDir, ILMU_SKILL_SLUG);
    await mkdir(join(workspaceDir, "skills", ILMU_SKILL_SLUG), { recursive: true });
    await writeFile(skillPath, "stale content", "utf8");

    const result = await applySkillWrite(ILMU_SKILL, {
      workspaceDir,
      configPath: join(workspaceDir, "openclaw.json"),
    });
    expect(result.action).toBe("wrote");
    const content = await readFile(skillPath, "utf8");
    expect(content).not.toBe("stale content");
    expect(content).toContain("ilmu-configuration");
  });

  it("writes the openclaw skill to its own slug dir, idempotently", async () => {
    const first = await applySkillWrite(OPENCLAW_SKILL, {
      workspaceDir,
      configPath: join(workspaceDir, "openclaw.json"),
    });
    expect(first.action).toBe("wrote");
    expect(first.path).toBe(resolveSkillPath(workspaceDir, OPENCLAW_SKILL_SLUG));

    const second = await applySkillWrite(OPENCLAW_SKILL, {
      workspaceDir,
      configPath: join(workspaceDir, "openclaw.json"),
    });
    expect(second.action).toBe("noop-content-match");
  });

  it("writes both skills side-by-side without collision", async () => {
    await applySkillWrite(ILMU_SKILL, {
      workspaceDir,
      configPath: join(workspaceDir, "openclaw.json"),
    });
    await applySkillWrite(OPENCLAW_SKILL, {
      workspaceDir,
      configPath: join(workspaceDir, "openclaw.json"),
    });

    const ilmuContent = await readFile(
      resolveSkillPath(workspaceDir, ILMU_SKILL_SLUG),
      "utf8",
    );
    const openclawContent = await readFile(
      resolveSkillPath(workspaceDir, OPENCLAW_SKILL_SLUG),
      "utf8",
    );
    expect(ilmuContent).toContain("name: ilmu-configuration");
    expect(openclawContent).toContain("name: openclaw-configuration");
    expect(ilmuContent).not.toBe(openclawContent);
  });
});
