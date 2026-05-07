import { mutateConfigFile } from "openclaw/plugin-sdk/config-mutation";

export const BEGINNER_TOOL_ALLOWLIST: readonly string[] = [
  "read",
  "write",
  "edit",
  "exec",
  "cron",
  "sessions_spawn",
  "sessions_send",
  "sessions_list",
  "sessions_history",
  "memory_search",
  "memory_get",
  "message",
  "web_search",
  "web_fetch",
] as const;

export const BEGINNER_TOOL_DENYLIST: readonly string[] = ["canvas", "apply_patch"] as const;

export type ToolPolicy = {
  allow?: readonly string[];
  deny?: readonly string[];
};

export type ToolAllowlistPlan = {
  writeAllow: boolean;
  writeDeny: boolean;
  toAllow?: readonly string[];
  toDeny?: readonly string[];
};

export type ToolAllowlistTargets = {
  allow: readonly string[];
  deny: readonly string[];
};

export const DEFAULT_TOOL_ALLOWLIST_TARGETS: ToolAllowlistTargets = {
  allow: BEGINNER_TOOL_ALLOWLIST,
  deny: BEGINNER_TOOL_DENYLIST,
};

function arraysEqual(a: readonly string[] | undefined, b: readonly string[]): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function computeToolAllowlistPlan(
  current: ToolPolicy,
  targets: ToolAllowlistTargets = DEFAULT_TOOL_ALLOWLIST_TARGETS,
): ToolAllowlistPlan {
  const plan: ToolAllowlistPlan = { writeAllow: false, writeDeny: false };
  if (!arraysEqual(current.allow, targets.allow)) {
    plan.writeAllow = true;
    plan.toAllow = targets.allow;
  }
  if (!arraysEqual(current.deny, targets.deny)) {
    plan.writeDeny = true;
    plan.toDeny = targets.deny;
  }
  return plan;
}

export function summarizeToolAllowlistPlan(plan: ToolAllowlistPlan): string {
  if (!plan.writeAllow && !plan.writeDeny) {
    return "ilmu plugin: tool allowlist already matches beginner profile, no change.";
  }
  const parts: string[] = [];
  if (plan.writeAllow) parts.push(`tools.allow (${plan.toAllow?.length ?? 0} entries)`);
  if (plan.writeDeny) parts.push(`tools.deny (${plan.toDeny?.length ?? 0} entries)`);
  return `ilmu plugin: applied beginner ${parts.join(", ")}.`;
}

export async function applyToolAllowlistMutation(
  targets: ToolAllowlistTargets = DEFAULT_TOOL_ALLOWLIST_TARGETS,
): Promise<ToolAllowlistPlan> {
  const captured: { plan: ToolAllowlistPlan } = {
    plan: { writeAllow: false, writeDeny: false },
  };
  await mutateConfigFile({
    afterWrite: {
      mode: "none",
      reason: "ilmu plugin: beginner tool allowlist (no restart needed)",
    },
    mutate: (draft) => {
      const tools = ((draft as { tools?: ToolPolicy }).tools ?? {}) as ToolPolicy;
      const plan = computeToolAllowlistPlan(tools, targets);
      captured.plan = plan;
      if (!plan.writeAllow && !plan.writeDeny) return;
      (draft as { tools?: ToolPolicy }).tools = {
        ...tools,
        ...(plan.writeAllow ? { allow: [...targets.allow] } : {}),
        ...(plan.writeDeny ? { deny: [...targets.deny] } : {}),
      };
    },
  });
  return captured.plan;
}
