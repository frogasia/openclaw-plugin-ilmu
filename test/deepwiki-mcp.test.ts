import { describe, expect, it } from "vitest";
import {
  DEEPWIKI_MCP_ENTRY,
  DEEPWIKI_MCP_SERVER_NAME,
  computeDeepwikiMcpPlan,
  summarizeDeepwikiMcpPlan,
} from "../src/deepwiki-mcp.ts";

describe("DEEPWIKI_MCP_ENTRY", () => {
  it("matches the cookbook install.sh _mcp_set arguments exactly", () => {
    expect(DEEPWIKI_MCP_ENTRY).toEqual({
      url: "https://mcp.deepwiki.com/mcp",
      transport: "streamable-http",
    });
    expect(DEEPWIKI_MCP_SERVER_NAME).toBe("deepwiki");
  });
});

describe("computeDeepwikiMcpPlan", () => {
  it("writes when servers map is undefined (greenfield install)", () => {
    const plan = computeDeepwikiMcpPlan(undefined);
    expect(plan.write).toBe(true);
    expect(plan.toEntry).toEqual(DEEPWIKI_MCP_ENTRY);
  });

  it("writes when deepwiki server is absent (other servers present)", () => {
    const plan = computeDeepwikiMcpPlan({
      otherserver: { url: "https://example.com", transport: "stdio" },
    });
    expect(plan.write).toBe(true);
  });

  it("is a no-op when entry already matches exactly (idempotent)", () => {
    const plan = computeDeepwikiMcpPlan({
      [DEEPWIKI_MCP_SERVER_NAME]: { ...DEEPWIKI_MCP_ENTRY },
    });
    expect(plan.write).toBe(false);
    expect(plan.toEntry).toBeUndefined();
  });

  it("writes when url drifts from target", () => {
    const plan = computeDeepwikiMcpPlan({
      [DEEPWIKI_MCP_SERVER_NAME]: {
        url: "https://mcp.deepwiki.com/old",
        transport: "streamable-http",
      },
    });
    expect(plan.write).toBe(true);
  });

  it("writes when transport drifts from target", () => {
    const plan = computeDeepwikiMcpPlan({
      [DEEPWIKI_MCP_SERVER_NAME]: {
        url: DEEPWIKI_MCP_ENTRY.url,
        transport: "stdio",
      },
    });
    expect(plan.write).toBe(true);
  });

  it("ignores extra properties on the deepwiki entry (only url + transport are checked)", () => {
    const plan = computeDeepwikiMcpPlan({
      [DEEPWIKI_MCP_SERVER_NAME]: {
        ...DEEPWIKI_MCP_ENTRY,
        custom: "extra",
      },
    });
    expect(plan.write).toBe(false);
  });

  it("respects custom target when supplied", () => {
    const customTarget = { url: "https://internal/mcp", transport: "stdio" };
    const plan = computeDeepwikiMcpPlan(
      { [DEEPWIKI_MCP_SERVER_NAME]: { ...customTarget } },
      customTarget,
    );
    expect(plan.write).toBe(false);
  });
});

describe("summarizeDeepwikiMcpPlan", () => {
  it("describes a no-op plan", () => {
    const msg = summarizeDeepwikiMcpPlan({ write: false });
    expect(msg).toContain("already registered");
  });

  it("describes a write that registers the deepwiki server", () => {
    const msg = summarizeDeepwikiMcpPlan({ write: true, toEntry: DEEPWIKI_MCP_ENTRY });
    expect(msg).toContain("mcp.servers.deepwiki");
    expect(msg).toContain(DEEPWIKI_MCP_ENTRY.url);
  });
});
