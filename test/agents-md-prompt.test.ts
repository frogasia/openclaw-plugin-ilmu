import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyAgentsMdMutation,
  renderIlmuPlatformPromptBlock,
  spliceIlmuPlatformPromptBlock,
  type IlmuAgentsMdPaths,
} from "../src/agents-md-prompt.ts";

function buildPaths(workspaceDir: string): IlmuAgentsMdPaths {
  return {
    workspaceDir,
    configPath: `${workspaceDir}/openclaw.json`,
    skillsDir: `${workspaceDir}/skills`,
    skillPath: `${workspaceDir}/skills/ilmu-configuration/SKILL.md`,
    openclawSkillPath: `${workspaceDir}/skills/openclaw-configuration/SKILL.md`,
  };
}

describe("renderIlmuPlatformPromptBlock", () => {
  it("includes a stable sha256 hash attribute and bakes paths in", async () => {
    const paths = buildPaths("/tmp/fixture-ws");
    const { block, hash } = await renderIlmuPlatformPromptBlock(paths);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(block).toContain(`hash="${hash}"`);
    expect(block).toContain('version="1"');
    expect(block).toContain("/tmp/fixture-ws");
    expect(block).toContain("/tmp/fixture-ws/skills/ilmu-configuration/SKILL.md");
    expect(block).toContain("/tmp/fixture-ws/skills/openclaw-configuration/SKILL.md");
    expect(block.startsWith("<ilmu-platform-prompt")).toBe(true);
    expect(block.endsWith("</ilmu-platform-prompt>")).toBe(true);
  });

  it("produces the same hash for identical paths", async () => {
    const paths = buildPaths("/tmp/fixture-ws");
    const a = await renderIlmuPlatformPromptBlock(paths);
    const b = await renderIlmuPlatformPromptBlock(paths);
    expect(a.hash).toBe(b.hash);
  });

  it("produces a different hash when paths differ", async () => {
    const a = await renderIlmuPlatformPromptBlock(buildPaths("/tmp/a"));
    const b = await renderIlmuPlatformPromptBlock(buildPaths("/tmp/b"));
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("spliceIlmuPlatformPromptBlock", () => {
  const hash = "a".repeat(64);
  const block = `<ilmu-platform-prompt version="1" hash="${hash}">body</ilmu-platform-prompt>`;
  const oldHash = "b".repeat(64);

  it("appends to empty content with no leading separator", () => {
    const result = spliceIlmuPlatformPromptBlock("", block, hash);
    expect(result.action).toBe("appended");
    expect(result.next).toBe(`${block}\n`);
  });

  it("appends after pre-existing user content with one blank line separator", () => {
    const existing = "# My agent\n\nUser-authored guidance.\n";
    const result = spliceIlmuPlatformPromptBlock(existing, block, hash);
    expect(result.action).toBe("appended");
    expect(result.next).toBe(`# My agent\n\nUser-authored guidance.\n\n${block}\n`);
  });

  it("replaces an existing block in place when hash differs", () => {
    const existing = `Header\n\n<ilmu-platform-prompt version="1" hash="${oldHash}">old body</ilmu-platform-prompt>\n\nFooter\n`;
    const result = spliceIlmuPlatformPromptBlock(existing, block, hash);
    expect(result.action).toBe("replaced");
    expect(result.next).toBe(`Header\n\n${block}\n\nFooter\n`);
  });

  it("is a no-op when the recorded hash matches the new hash", () => {
    const existing = `Header\n\n<ilmu-platform-prompt version="1" hash="${hash}">stale body</ilmu-platform-prompt>\n\nFooter\n`;
    const result = spliceIlmuPlatformPromptBlock(existing, block, hash);
    expect(result.action).toBe("noop-hash-match");
    expect(result.next).toBe(existing);
  });

  it("preserves user content above and below the block byte-identically when replacing", () => {
    const above = "# Above\n\n- bullet 1\n- bullet 2\n";
    const below = "\n## Below\n\n```ts\nconst x = 1;\n```\n";
    const existing = `${above}\n<ilmu-platform-prompt version="1" hash="${oldHash}">x</ilmu-platform-prompt>${below}`;
    const result = spliceIlmuPlatformPromptBlock(existing, block, hash);
    expect(result.next.startsWith(above)).toBe(true);
    expect(result.next.endsWith(below)).toBe(true);
  });
});

describe("applyAgentsMdMutation (filesystem)", () => {
  let workspaceDir: string;
  let agentsMdPath: string;

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), "ilmu-agentsmd-"));
    agentsMdPath = join(workspaceDir, "AGENTS.md");
  });

  it("creates AGENTS.md when missing and appends the block", async () => {
    const action = await applyAgentsMdMutation(agentsMdPath, buildPaths(workspaceDir));
    expect(action).toBe("appended");
    const content = await readFile(agentsMdPath, "utf8");
    expect(content).toMatch(/<ilmu-platform-prompt[^>]+>/);
    expect(content).toMatch(/<\/ilmu-platform-prompt>\n$/);
  });

  it("is idempotent — second call is noop-hash-match", async () => {
    await applyAgentsMdMutation(agentsMdPath, buildPaths(workspaceDir));
    const before = await readFile(agentsMdPath, "utf8");
    const action = await applyAgentsMdMutation(agentsMdPath, buildPaths(workspaceDir));
    const after = await readFile(agentsMdPath, "utf8");
    expect(action).toBe("noop-hash-match");
    expect(after).toBe(before);
  });

  it("preserves pre-existing user content above the block", async () => {
    const userContent = "# User AGENTS\n\nimportant context.\n";
    await writeFile(agentsMdPath, userContent, "utf8");
    await applyAgentsMdMutation(agentsMdPath, buildPaths(workspaceDir));
    const content = await readFile(agentsMdPath, "utf8");
    expect(content.startsWith(userContent)).toBe(true);
    const matches = content.match(/<ilmu-platform-prompt\b/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("creates parent directories if needed", async () => {
    const nestedPath = join(workspaceDir, "nested", "deep", "AGENTS.md");
    await mkdir(workspaceDir, { recursive: true });
    const action = await applyAgentsMdMutation(nestedPath, buildPaths(workspaceDir));
    expect(action).toBe("appended");
    const content = await readFile(nestedPath, "utf8");
    expect(content).toContain("<ilmu-platform-prompt");
  });
});
