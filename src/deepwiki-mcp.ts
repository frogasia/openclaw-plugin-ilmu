import { mutateConfigFile } from "openclaw/plugin-sdk/config-mutation";

export const DEEPWIKI_MCP_SERVER_NAME = "deepwiki";

export type DeepwikiMcpEntry = {
  url: string;
  transport: string;
};

export const DEEPWIKI_MCP_ENTRY: DeepwikiMcpEntry = {
  url: "https://mcp.deepwiki.com/mcp",
  transport: "streamable-http",
};

export type McpServersShape = Record<string, Record<string, unknown> | undefined>;

export type DeepwikiMcpPlan = {
  write: boolean;
  toEntry?: DeepwikiMcpEntry;
};

function entriesMatch(
  current: Record<string, unknown> | undefined,
  target: DeepwikiMcpEntry,
): boolean {
  if (!current) return false;
  return current.url === target.url && current.transport === target.transport;
}

export function computeDeepwikiMcpPlan(
  servers: McpServersShape | undefined,
  target: DeepwikiMcpEntry = DEEPWIKI_MCP_ENTRY,
): DeepwikiMcpPlan {
  const current = servers?.[DEEPWIKI_MCP_SERVER_NAME];
  if (entriesMatch(current, target)) {
    return { write: false };
  }
  return { write: true, toEntry: target };
}

export function summarizeDeepwikiMcpPlan(plan: DeepwikiMcpPlan): string {
  if (!plan.write) {
    return "ilmu plugin: deepwiki MCP already registered, no change.";
  }
  return `ilmu plugin: registered mcp.servers.${DEEPWIKI_MCP_SERVER_NAME} -> ${plan.toEntry?.url}.`;
}

export async function applyDeepwikiMcpMutation(
  target: DeepwikiMcpEntry = DEEPWIKI_MCP_ENTRY,
): Promise<DeepwikiMcpPlan> {
  const captured: { plan: DeepwikiMcpPlan } = { plan: { write: false } };
  await mutateConfigFile({
    afterWrite: {
      mode: "none",
      reason: "ilmu plugin: deepwiki MCP registration (no restart needed)",
    },
    mutate: (draft) => {
      const mcp = ((draft as { mcp?: { servers?: McpServersShape } }).mcp ?? {}) as {
        servers?: McpServersShape;
      };
      const servers = mcp.servers ?? {};
      const plan = computeDeepwikiMcpPlan(servers, target);
      captured.plan = plan;
      if (!plan.write) return;
      (draft as { mcp?: { servers?: McpServersShape } }).mcp = {
        ...mcp,
        servers: {
          ...servers,
          [DEEPWIKI_MCP_SERVER_NAME]: { ...target },
        },
      };
    },
  });
  return captured.plan;
}
