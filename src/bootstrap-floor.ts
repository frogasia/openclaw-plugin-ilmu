import { mutateConfigFile } from "openclaw/plugin-sdk/config-mutation";

export const ILMU_BOOTSTRAP_MAX_CHARS_FLOOR = 32_000;
export const ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR = 200_000;

export type ThinkingDefault =
  | "adaptive"
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

export const ILMU_THINKING_DEFAULT: ThinkingDefault = "adaptive";

export type BootstrapFloorPlan = {
  raisedMaxChars: boolean;
  raisedTotalMaxChars: boolean;
  setThinkingDefault: boolean;
  fromMaxChars?: number;
  toMaxChars?: number;
  fromTotalMaxChars?: number;
  toTotalMaxChars?: number;
  toThinkingDefault?: ThinkingDefault;
};

export type BootstrapDefaults = {
  bootstrapMaxChars?: number;
  bootstrapTotalMaxChars?: number;
  thinkingDefault?: ThinkingDefault;
};

export type BootstrapFloors = {
  maxChars: number;
  totalMaxChars: number;
  thinkingDefault: ThinkingDefault;
};

export const DEFAULT_BOOTSTRAP_FLOORS: BootstrapFloors = {
  maxChars: ILMU_BOOTSTRAP_MAX_CHARS_FLOOR,
  totalMaxChars: ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR,
  thinkingDefault: ILMU_THINKING_DEFAULT,
};

export function computeBootstrapFloorPlan(
  current: BootstrapDefaults,
  floors: BootstrapFloors = DEFAULT_BOOTSTRAP_FLOORS,
): { plan: BootstrapFloorPlan; next: BootstrapDefaults } {
  const plan: BootstrapFloorPlan = {
    raisedMaxChars: false,
    raisedTotalMaxChars: false,
    setThinkingDefault: false,
  };
  const next: BootstrapDefaults = { ...current };

  const currentMax = current.bootstrapMaxChars;
  if (currentMax === undefined || currentMax < floors.maxChars) {
    plan.raisedMaxChars = true;
    plan.fromMaxChars = currentMax;
    plan.toMaxChars = floors.maxChars;
    next.bootstrapMaxChars = floors.maxChars;
  }

  const currentTotal = current.bootstrapTotalMaxChars;
  if (currentTotal === undefined || currentTotal < floors.totalMaxChars) {
    plan.raisedTotalMaxChars = true;
    plan.fromTotalMaxChars = currentTotal;
    plan.toTotalMaxChars = floors.totalMaxChars;
    next.bootstrapTotalMaxChars = floors.totalMaxChars;
  }

  if (current.thinkingDefault === undefined) {
    plan.setThinkingDefault = true;
    plan.toThinkingDefault = floors.thinkingDefault;
    next.thinkingDefault = floors.thinkingDefault;
  }

  return { plan, next };
}

export function summarizeBootstrapFloorPlan(plan: BootstrapFloorPlan): string {
  if (!plan.raisedMaxChars && !plan.raisedTotalMaxChars && !plan.setThinkingDefault) {
    return "ilmu plugin: bootstrap floor already met, no change.";
  }
  const parts: string[] = [];
  if (plan.raisedMaxChars) {
    parts.push(`bootstrapMaxChars ${plan.fromMaxChars ?? "(unset)"} -> ${plan.toMaxChars}`);
  }
  if (plan.raisedTotalMaxChars) {
    parts.push(
      `bootstrapTotalMaxChars ${plan.fromTotalMaxChars ?? "(unset)"} -> ${plan.toTotalMaxChars}`,
    );
  }
  if (plan.setThinkingDefault) {
    parts.push(`thinkingDefault (unset) -> ${plan.toThinkingDefault}`);
  }
  return `ilmu plugin: raised ${parts.join(", ")}.`;
}

export async function applyBootstrapFloorMutation(
  floors: BootstrapFloors = DEFAULT_BOOTSTRAP_FLOORS,
): Promise<BootstrapFloorPlan> {
  const captured: { plan: BootstrapFloorPlan } = {
    plan: { raisedMaxChars: false, raisedTotalMaxChars: false, setThinkingDefault: false },
  };
  await mutateConfigFile({
    afterWrite: {
      mode: "none",
      reason: "ilmu plugin: agents.defaults curation (no restart needed)",
    },
    mutate: (draft) => {
      const defaults = (draft.agents?.defaults ?? {}) as BootstrapDefaults & Record<string, unknown>;
      const { plan, next } = computeBootstrapFloorPlan(defaults, floors);
      captured.plan = plan;
      if (!plan.raisedMaxChars && !plan.raisedTotalMaxChars && !plan.setThinkingDefault) return;
      draft.agents = {
        ...draft.agents,
        defaults: {
          ...draft.agents?.defaults,
          ...(plan.raisedMaxChars ? { bootstrapMaxChars: next.bootstrapMaxChars } : {}),
          ...(plan.raisedTotalMaxChars
            ? { bootstrapTotalMaxChars: next.bootstrapTotalMaxChars }
            : {}),
          ...(plan.setThinkingDefault ? { thinkingDefault: next.thinkingDefault } : {}),
        },
      };
    },
  });
  return captured.plan;
}
