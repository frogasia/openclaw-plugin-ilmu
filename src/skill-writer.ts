import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const TEMPLATE_URL = new URL(
  "./templates/ilmu-configuration.skill.md.tmpl",
  import.meta.url,
);

export const ILMU_SKILL_SLUG = "ilmu-configuration";
export const ILMU_SKILL_FILENAME = "SKILL.md";

export type IlmuSkillPaths = {
  workspaceDir: string;
  configPath: string;
};

let cachedTemplate: string | undefined;

async function loadTemplate(): Promise<string> {
  if (cachedTemplate === undefined) {
    cachedTemplate = await readFile(TEMPLATE_URL, "utf8");
  }
  return cachedTemplate;
}

export function resolveIlmuSkillPath(workspaceDir: string): string {
  return join(workspaceDir, "skills", ILMU_SKILL_SLUG, ILMU_SKILL_FILENAME);
}

export function resolveIlmuSkillsDir(workspaceDir: string): string {
  return join(workspaceDir, "skills");
}

export async function renderIlmuSkill(paths: IlmuSkillPaths): Promise<string> {
  const template = await loadTemplate();
  const skillPath = resolveIlmuSkillPath(paths.workspaceDir);
  return template
    .replaceAll("{{workspaceDir}}", paths.workspaceDir)
    .replaceAll("{{configPath}}", paths.configPath)
    .replaceAll("{{skillsDir}}", resolveIlmuSkillsDir(paths.workspaceDir))
    .replaceAll("{{skillPath}}", skillPath);
}

export async function applyIlmuSkillWrite(
  paths: IlmuSkillPaths,
): Promise<{ path: string; action: "wrote" | "noop-content-match" }> {
  const skillPath = resolveIlmuSkillPath(paths.workspaceDir);
  const rendered = await renderIlmuSkill(paths);
  const existing = await safeReadFile(skillPath);
  if (existing === rendered) {
    return { path: skillPath, action: "noop-content-match" };
  }
  await mkdir(dirname(skillPath), { recursive: true });
  await writeFile(skillPath, rendered, "utf8");
  return { path: skillPath, action: "wrote" };
}

async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
