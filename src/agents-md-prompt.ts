import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export const ILMU_PLATFORM_PROMPT_VERSION = "1";
const TAG_NAME = "ilmu-platform-prompt";

export type IlmuAgentsMdPaths = {
  workspaceDir: string;
  configPath: string;
  skillsDir: string;
  skillPath: string;
};

export type AgentsMdSpliceResult = {
  next: string;
  action: "noop-hash-match" | "appended" | "replaced";
  hash: string;
};

const TEMPLATE_URL = new URL("./templates/agents-md-block.tmpl", import.meta.url);
const BLOCK_REGEX = new RegExp(
  `<${TAG_NAME}\\b[^>]*>[\\s\\S]*?<\\/${TAG_NAME}>`,
  "m",
);
const HASH_ATTR_REGEX = /\bhash="([0-9a-f]{64})"/;

let cachedTemplate: string | undefined;

async function loadTemplate(): Promise<string> {
  if (cachedTemplate === undefined) {
    cachedTemplate = await readFile(TEMPLATE_URL, "utf8");
  }
  return cachedTemplate;
}

function applyPlaceholders(template: string, paths: IlmuAgentsMdPaths): string {
  return template
    .replaceAll("{{workspaceDir}}", paths.workspaceDir)
    .replaceAll("{{configPath}}", paths.configPath)
    .replaceAll("{{skillsDir}}", paths.skillsDir)
    .replaceAll("{{skillPath}}", paths.skillPath);
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function renderIlmuPlatformPromptBody(
  paths: IlmuAgentsMdPaths,
): Promise<string> {
  const template = await loadTemplate();
  return applyPlaceholders(template, paths).trimEnd();
}

export async function renderIlmuPlatformPromptBlock(
  paths: IlmuAgentsMdPaths,
): Promise<{ block: string; hash: string }> {
  const body = await renderIlmuPlatformPromptBody(paths);
  const hash = sha256(body);
  const block = `<${TAG_NAME} version="${ILMU_PLATFORM_PROMPT_VERSION}" hash="${hash}">\n${body}\n</${TAG_NAME}>`;
  return { block, hash };
}

export function spliceIlmuPlatformPromptBlock(
  existing: string,
  block: string,
  hash: string,
): AgentsMdSpliceResult {
  const match = BLOCK_REGEX.exec(existing);
  if (match) {
    const recordedHash = HASH_ATTR_REGEX.exec(match[0])?.[1];
    if (recordedHash === hash) {
      return { next: existing, action: "noop-hash-match", hash };
    }
    const next =
      existing.slice(0, match.index) + block + existing.slice(match.index + match[0].length);
    return { next, action: "replaced", hash };
  }

  const trimmedRight = existing.replace(/\s+$/u, "");
  const separator = trimmedRight.length === 0 ? "" : "\n\n";
  const next = `${trimmedRight}${separator}${block}\n`;
  return { next, action: "appended", hash };
}

export async function applyAgentsMdMutation(
  agentsMdPath: string,
  paths: IlmuAgentsMdPaths,
): Promise<AgentsMdSpliceResult["action"]> {
  const { block, hash } = await renderIlmuPlatformPromptBlock(paths);
  const existing = await safeReadFile(agentsMdPath);
  const result = spliceIlmuPlatformPromptBlock(existing ?? "", block, hash);
  if (result.action === "noop-hash-match") {
    return result.action;
  }
  await mkdir(dirname(agentsMdPath), { recursive: true });
  await writeFile(agentsMdPath, result.next, "utf8");
  return result.action;
}

async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
