import { describe, expect, it } from "vitest";
import {
  ILMU_BOOTSTRAP_MAX_CHARS_FLOOR,
  ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR,
  ILMU_THINKING_DEFAULT,
  computeBootstrapFloorPlan,
  summarizeBootstrapFloorPlan,
} from "../src/bootstrap-floor.ts";

describe("computeBootstrapFloorPlan", () => {
  it("raises both fields and sets thinkingDefault when unset (greenfield install)", () => {
    const { plan, next } = computeBootstrapFloorPlan({});
    expect(plan.raisedMaxChars).toBe(true);
    expect(plan.raisedTotalMaxChars).toBe(true);
    expect(plan.setThinkingDefault).toBe(true);
    expect(next.bootstrapMaxChars).toBe(ILMU_BOOTSTRAP_MAX_CHARS_FLOOR);
    expect(next.bootstrapTotalMaxChars).toBe(ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR);
    expect(next.thinkingDefault).toBe(ILMU_THINKING_DEFAULT);
  });

  it("raises only fields below the floor, leaves others alone", () => {
    const { plan, next } = computeBootstrapFloorPlan({
      bootstrapMaxChars: 8000,
      bootstrapTotalMaxChars: ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR + 50000,
      thinkingDefault: ILMU_THINKING_DEFAULT,
    });
    expect(plan.raisedMaxChars).toBe(true);
    expect(plan.raisedTotalMaxChars).toBe(false);
    expect(plan.setThinkingDefault).toBe(false);
    expect(next.bootstrapMaxChars).toBe(ILMU_BOOTSTRAP_MAX_CHARS_FLOOR);
    expect(next.bootstrapTotalMaxChars).toBe(ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR + 50000);
    expect(next.thinkingDefault).toBe(ILMU_THINKING_DEFAULT);
  });

  it("never lowers values above the floor (raise-only invariant)", () => {
    const current = {
      bootstrapMaxChars: 1_000_000,
      bootstrapTotalMaxChars: 5_000_000,
      thinkingDefault: ILMU_THINKING_DEFAULT,
    };
    const { plan, next } = computeBootstrapFloorPlan(current);
    expect(plan.raisedMaxChars).toBe(false);
    expect(plan.raisedTotalMaxChars).toBe(false);
    expect(plan.setThinkingDefault).toBe(false);
    expect(next.bootstrapMaxChars).toBe(1_000_000);
    expect(next.bootstrapTotalMaxChars).toBe(5_000_000);
  });

  it("treats values exactly at the floor as no-op (>= comparison)", () => {
    const { plan } = computeBootstrapFloorPlan({
      bootstrapMaxChars: ILMU_BOOTSTRAP_MAX_CHARS_FLOOR,
      bootstrapTotalMaxChars: ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR,
      thinkingDefault: ILMU_THINKING_DEFAULT,
    });
    expect(plan.raisedMaxChars).toBe(false);
    expect(plan.raisedTotalMaxChars).toBe(false);
    expect(plan.setThinkingDefault).toBe(false);
  });

  it("respects custom floors when supplied", () => {
    const { plan, next } = computeBootstrapFloorPlan(
      { bootstrapMaxChars: 5000 },
      { maxChars: 10_000, totalMaxChars: 50_000, thinkingDefault: "high" },
    );
    expect(plan.raisedMaxChars).toBe(true);
    expect(plan.setThinkingDefault).toBe(true);
    expect(next.bootstrapMaxChars).toBe(10_000);
    expect(next.bootstrapTotalMaxChars).toBe(50_000);
    expect(next.thinkingDefault).toBe("high");
  });

  it("preserves a user-set non-adaptive thinkingDefault (no overwrite)", () => {
    const { plan, next } = computeBootstrapFloorPlan({
      bootstrapMaxChars: ILMU_BOOTSTRAP_MAX_CHARS_FLOOR,
      bootstrapTotalMaxChars: ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR,
      thinkingDefault: "high",
    });
    expect(plan.setThinkingDefault).toBe(false);
    expect(next.thinkingDefault).toBe("high");
  });

  it("sets thinkingDefault even when bootstrap floors are already met", () => {
    const { plan } = computeBootstrapFloorPlan({
      bootstrapMaxChars: ILMU_BOOTSTRAP_MAX_CHARS_FLOOR,
      bootstrapTotalMaxChars: ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR,
    });
    expect(plan.raisedMaxChars).toBe(false);
    expect(plan.raisedTotalMaxChars).toBe(false);
    expect(plan.setThinkingDefault).toBe(true);
  });
});

describe("summarizeBootstrapFloorPlan", () => {
  it("describes a no-op plan", () => {
    const msg = summarizeBootstrapFloorPlan({
      raisedMaxChars: false,
      raisedTotalMaxChars: false,
      setThinkingDefault: false,
    });
    expect(msg).toContain("already met");
  });

  it("describes a partial raise (only one field)", () => {
    const msg = summarizeBootstrapFloorPlan({
      raisedMaxChars: true,
      raisedTotalMaxChars: false,
      setThinkingDefault: false,
      fromMaxChars: 8000,
      toMaxChars: 32000,
    });
    expect(msg).toContain("bootstrapMaxChars 8000 -> 32000");
    expect(msg).not.toContain("bootstrapTotalMaxChars");
    expect(msg).not.toContain("thinkingDefault");
  });

  it("describes a full raise from unset values including thinkingDefault", () => {
    const msg = summarizeBootstrapFloorPlan({
      raisedMaxChars: true,
      raisedTotalMaxChars: true,
      setThinkingDefault: true,
      toMaxChars: 32000,
      toTotalMaxChars: 200000,
      toThinkingDefault: "adaptive",
    });
    expect(msg).toContain("(unset) -> 32000");
    expect(msg).toContain("(unset) -> 200000");
    expect(msg).toContain("thinkingDefault (unset) -> adaptive");
  });

  it("describes a thinkingDefault-only raise (floors already met)", () => {
    const msg = summarizeBootstrapFloorPlan({
      raisedMaxChars: false,
      raisedTotalMaxChars: false,
      setThinkingDefault: true,
      toThinkingDefault: "adaptive",
    });
    expect(msg).toContain("thinkingDefault (unset) -> adaptive");
    expect(msg).not.toContain("bootstrapMaxChars");
    expect(msg).not.toContain("bootstrapTotalMaxChars");
  });
});
