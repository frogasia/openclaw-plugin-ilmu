import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const ILMU_SKILL_SLUG = "ilmu-configuration";
export const OPENCLAW_SKILL_SLUG = "openclaw-configuration";
export const SKILL_FILENAME = "SKILL.md";

// Back-compat alias for callers / tests that imported the original constant.
export const ILMU_SKILL_FILENAME = SKILL_FILENAME;

export type SkillSpec = {
  slug: string;
  templateUrl: URL;
};

export const ILMU_SKILL: SkillSpec = {
  slug: ILMU_SKILL_SLUG,
  templateUrl: new URL("./templates/ilmu-configuration.skill.md.tmpl", import.meta.url),
};

export const OPENCLAW_SKILL: SkillSpec = {
  slug: OPENCLAW_SKILL_SLUG,
  templateUrl: new URL("./templates/openclaw-configuration.skill.md.tmpl", import.meta.url),
};

export const ALL_SKILLS: readonly SkillSpec[] = [ILMU_SKILL, OPENCLAW_SKILL];

export type SkillRenderPaths = {
  workspaceDir: string;
  configPath: string;
};

// Back-compat alias.
export type IlmuSkillPaths = SkillRenderPaths;

const templateCache = new Map<string, string>();

async function loadTemplate(url: URL): Promise<string> {
  const key = url.toString();
  let cached = templateCache.get(key);
  if (cached === undefined) {
    cached = await readFile(url, "utf8");
    templateCache.set(key, cached);
  }
  return cached;
}

export function resolveSkillsDir(workspaceDir: string): string {
  return join(workspaceDir, "skills");
}

export function resolveSkillPath(workspaceDir: string, slug: string): string {
  return join(workspaceDir, "skills", slug, SKILL_FILENAME);
}

export async function renderSkill(spec: SkillSpec, paths: SkillRenderPaths): Promise<string> {
  const template = await loadTemplate(spec.templateUrl);
  const skillPath = resolveSkillPath(paths.workspaceDir, spec.slug);
  return template
    .replaceAll("{{workspaceDir}}", paths.workspaceDir)
    .replaceAll("{{configPath}}", paths.configPath)
    .replaceAll("{{skillsDir}}", resolveSkillsDir(paths.workspaceDir))
    .replaceAll("{{skillPath}}", skillPath);
}

export async function applySkillWrite(
  spec: SkillSpec,
  paths: SkillRenderPaths,
): Promise<{ path: string; action: "wrote" | "noop-content-match" }> {
  const skillPath = resolveSkillPath(paths.workspaceDir, spec.slug);
  const rendered = await renderSkill(spec, paths);
  const existing = await safeReadFile(skillPath);
  if (existing === rendered) {
    return { path: skillPath, action: "noop-content-match" };
  }
  await mkdir(dirname(skillPath), { recursive: true });
  await writeFile(skillPath, rendered, "utf8");
  return { path: skillPath, action: "wrote" };
}

// Back-compat helpers — preserve the ILMU-named exports the existing tests
// and orchestrator already call.

export function resolveIlmuSkillPath(workspaceDir: string): string {
  return resolveSkillPath(workspaceDir, ILMU_SKILL_SLUG);
}

export function resolveIlmuSkillsDir(workspaceDir: string): string {
  return resolveSkillsDir(workspaceDir);
}

export function resolveOpenclawSkillPath(workspaceDir: string): string {
  return resolveSkillPath(workspaceDir, OPENCLAW_SKILL_SLUG);
}

export async function renderIlmuSkill(paths: IlmuSkillPaths): Promise<string> {
  return renderSkill(ILMU_SKILL, paths);
}

export async function applyIlmuSkillWrite(
  paths: IlmuSkillPaths,
): Promise<{ path: string; action: "wrote" | "noop-content-match" }> {
  return applySkillWrite(ILMU_SKILL, paths);
}

async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
