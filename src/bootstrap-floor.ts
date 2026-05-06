import { mutateConfigFile } from "openclaw/plugin-sdk/config-mutation";

export const ILMU_BOOTSTRAP_MAX_CHARS_FLOOR = 32_000;
export const ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR = 200_000;

export type BootstrapFloorPlan = {
  raisedMaxChars: boolean;
  raisedTotalMaxChars: boolean;
  fromMaxChars?: number;
  toMaxChars?: number;
  fromTotalMaxChars?: number;
  toTotalMaxChars?: number;
};

export type BootstrapDefaults = {
  bootstrapMaxChars?: number;
  bootstrapTotalMaxChars?: number;
};

export function computeBootstrapFloorPlan(
  current: BootstrapDefaults,
  floors: { maxChars: number; totalMaxChars: number } = {
    maxChars: ILMU_BOOTSTRAP_MAX_CHARS_FLOOR,
    totalMaxChars: ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR,
  },
): { plan: BootstrapFloorPlan; next: BootstrapDefaults } {
  const plan: BootstrapFloorPlan = {
    raisedMaxChars: false,
    raisedTotalMaxChars: false,
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

  return { plan, next };
}

export function summarizeBootstrapFloorPlan(plan: BootstrapFloorPlan): string {
  if (!plan.raisedMaxChars && !plan.raisedTotalMaxChars) {
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
  return `ilmu plugin: raised ${parts.join(", ")}.`;
}

export async function applyBootstrapFloorMutation(
  floors: { maxChars: number; totalMaxChars: number } = {
    maxChars: ILMU_BOOTSTRAP_MAX_CHARS_FLOOR,
    totalMaxChars: ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR,
  },
): Promise<BootstrapFloorPlan> {
  const captured: { plan: BootstrapFloorPlan } = {
    plan: { raisedMaxChars: false, raisedTotalMaxChars: false },
  };
  await mutateConfigFile({
    afterWrite: { mode: "none", reason: "ilmu plugin: bootstrap floor raise (no restart needed)" },
    mutate: (draft) => {
      const defaults = (draft.agents?.defaults ?? {}) as BootstrapDefaults & Record<string, unknown>;
      const { plan, next } = computeBootstrapFloorPlan(defaults, floors);
      captured.plan = plan;
      if (!plan.raisedMaxChars && !plan.raisedTotalMaxChars) return;
      draft.agents = {
        ...draft.agents,
        defaults: {
          ...draft.agents?.defaults,
          ...(plan.raisedMaxChars ? { bootstrapMaxChars: next.bootstrapMaxChars } : {}),
          ...(plan.raisedTotalMaxChars
            ? { bootstrapTotalMaxChars: next.bootstrapTotalMaxChars }
            : {}),
        },
      };
    },
  });
  return captured.plan;
}
