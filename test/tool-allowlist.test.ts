import { describe, expect, it } from "vitest";
import {
  BEGINNER_TOOL_ALLOWLIST,
  BEGINNER_TOOL_DENYLIST,
  computeToolAllowlistPlan,
  summarizeToolAllowlistPlan,
} from "../src/tool-allowlist.ts";

describe("BEGINNER_TOOL_ALLOWLIST", () => {
  it("matches the cookbook install.sh exactly (14 entries)", () => {
    expect([...BEGINNER_TOOL_ALLOWLIST]).toEqual([
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
    ]);
  });

  it("denylist matches the cookbook install.sh exactly", () => {
    expect([...BEGINNER_TOOL_DENYLIST]).toEqual(["canvas", "apply_patch"]);
  });
});

describe("computeToolAllowlistPlan", () => {
  it("writes both fields when current is empty (greenfield install)", () => {
    const plan = computeToolAllowlistPlan({});
    expect(plan.writeAllow).toBe(true);
    expect(plan.writeDeny).toBe(true);
    expect(plan.toAllow).toBe(BEGINNER_TOOL_ALLOWLIST);
    expect(plan.toDeny).toBe(BEGINNER_TOOL_DENYLIST);
  });

  it("is a no-op when both arrays already match exactly (idempotent)", () => {
    const plan = computeToolAllowlistPlan({
      allow: [...BEGINNER_TOOL_ALLOWLIST],
      deny: [...BEGINNER_TOOL_DENYLIST],
    });
    expect(plan.writeAllow).toBe(false);
    expect(plan.writeDeny).toBe(false);
  });

  it("rewrites when allow array has missing entries", () => {
    const plan = computeToolAllowlistPlan({
      allow: ["read", "write"],
      deny: [...BEGINNER_TOOL_DENYLIST],
    });
    expect(plan.writeAllow).toBe(true);
    expect(plan.writeDeny).toBe(false);
  });

  it("rewrites when deny array has extra entries", () => {
    const plan = computeToolAllowlistPlan({
      allow: [...BEGINNER_TOOL_ALLOWLIST],
      deny: ["canvas", "apply_patch", "extra_tool"],
    });
    expect(plan.writeAllow).toBe(false);
    expect(plan.writeDeny).toBe(true);
  });

  it("rewrites when allow array order differs (strict order match)", () => {
    const reversed = [...BEGINNER_TOOL_ALLOWLIST].reverse();
    const plan = computeToolAllowlistPlan({
      allow: reversed,
      deny: [...BEGINNER_TOOL_DENYLIST],
    });
    expect(plan.writeAllow).toBe(true);
  });

  it("respects custom targets when supplied", () => {
    const plan = computeToolAllowlistPlan(
      { allow: ["x"], deny: [] },
      { allow: ["x"], deny: ["y"] },
    );
    expect(plan.writeAllow).toBe(false);
    expect(plan.writeDeny).toBe(true);
    expect(plan.toDeny).toEqual(["y"]);
  });
});

describe("summarizeToolAllowlistPlan", () => {
  it("describes a no-op plan", () => {
    const msg = summarizeToolAllowlistPlan({ writeAllow: false, writeDeny: false });
    expect(msg).toContain("already matches");
  });

  it("describes an allow-only write", () => {
    const msg = summarizeToolAllowlistPlan({
      writeAllow: true,
      writeDeny: false,
      toAllow: BEGINNER_TOOL_ALLOWLIST,
    });
    expect(msg).toContain("tools.allow (14 entries)");
    expect(msg).not.toContain("tools.deny");
  });

  it("describes a full write (allow + deny)", () => {
    const msg = summarizeToolAllowlistPlan({
      writeAllow: true,
      writeDeny: true,
      toAllow: BEGINNER_TOOL_ALLOWLIST,
      toDeny: BEGINNER_TOOL_DENYLIST,
    });
    expect(msg).toContain("tools.allow (14 entries)");
    expect(msg).toContain("tools.deny (2 entries)");
  });
});
