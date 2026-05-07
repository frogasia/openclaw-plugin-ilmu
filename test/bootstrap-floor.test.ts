import { describe, expect, it } from "vitest";
import {
  ILMU_BOOTSTRAP_MAX_CHARS_FLOOR,
  ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR,
  computeBootstrapFloorPlan,
  summarizeBootstrapFloorPlan,
} from "../src/bootstrap-floor.ts";

describe("computeBootstrapFloorPlan", () => {
  it("raises both fields when unset (greenfield install)", () => {
    const { plan, next } = computeBootstrapFloorPlan({});
    expect(plan.raisedMaxChars).toBe(true);
    expect(plan.raisedTotalMaxChars).toBe(true);
    expect(next.bootstrapMaxChars).toBe(ILMU_BOOTSTRAP_MAX_CHARS_FLOOR);
    expect(next.bootstrapTotalMaxChars).toBe(ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR);
  });

  it("raises only fields below the floor, leaves others alone", () => {
    const { plan, next } = computeBootstrapFloorPlan({
      bootstrapMaxChars: 8000,
      bootstrapTotalMaxChars: ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR + 50000,
    });
    expect(plan.raisedMaxChars).toBe(true);
    expect(plan.raisedTotalMaxChars).toBe(false);
    expect(next.bootstrapMaxChars).toBe(ILMU_BOOTSTRAP_MAX_CHARS_FLOOR);
    expect(next.bootstrapTotalMaxChars).toBe(ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR + 50000);
  });

  it("never lowers values above the floor (raise-only invariant)", () => {
    const current = {
      bootstrapMaxChars: 1_000_000,
      bootstrapTotalMaxChars: 5_000_000,
    };
    const { plan, next } = computeBootstrapFloorPlan(current);
    expect(plan.raisedMaxChars).toBe(false);
    expect(plan.raisedTotalMaxChars).toBe(false);
    expect(next.bootstrapMaxChars).toBe(1_000_000);
    expect(next.bootstrapTotalMaxChars).toBe(5_000_000);
  });

  it("treats values exactly at the floor as no-op (>= comparison)", () => {
    const { plan } = computeBootstrapFloorPlan({
      bootstrapMaxChars: ILMU_BOOTSTRAP_MAX_CHARS_FLOOR,
      bootstrapTotalMaxChars: ILMU_BOOTSTRAP_TOTAL_MAX_CHARS_FLOOR,
    });
    expect(plan.raisedMaxChars).toBe(false);
    expect(plan.raisedTotalMaxChars).toBe(false);
  });

  it("respects custom floors when supplied", () => {
    const { plan, next } = computeBootstrapFloorPlan(
      { bootstrapMaxChars: 5000 },
      { maxChars: 10_000, totalMaxChars: 50_000 },
    );
    expect(plan.raisedMaxChars).toBe(true);
    expect(next.bootstrapMaxChars).toBe(10_000);
    expect(next.bootstrapTotalMaxChars).toBe(50_000);
  });
});

describe("summarizeBootstrapFloorPlan", () => {
  it("describes a no-op plan", () => {
    const msg = summarizeBootstrapFloorPlan({
      raisedMaxChars: false,
      raisedTotalMaxChars: false,
    });
    expect(msg).toContain("already met");
  });

  it("describes a partial raise (only one field)", () => {
    const msg = summarizeBootstrapFloorPlan({
      raisedMaxChars: true,
      raisedTotalMaxChars: false,
      fromMaxChars: 8000,
      toMaxChars: 32000,
    });
    expect(msg).toContain("bootstrapMaxChars 8000 -> 32000");
    expect(msg).not.toContain("bootstrapTotalMaxChars");
  });

  it("describes a full raise from unset values", () => {
    const msg = summarizeBootstrapFloorPlan({
      raisedMaxChars: true,
      raisedTotalMaxChars: true,
      toMaxChars: 32000,
      toTotalMaxChars: 200000,
    });
    expect(msg).toContain("(unset) -> 32000");
    expect(msg).toContain("(unset) -> 200000");
  });
});
