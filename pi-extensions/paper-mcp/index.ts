import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const PAPER_MCP_URL = "http://127.0.0.1:29979/mcp";
const PROTOCOL_VERSION = "2025-03-26";

type McpTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

type McpRpcResponse = {
  result?: any;
  error?: { code?: number; message?: string; data?: unknown };
  id?: string | number | null;
  jsonrpc?: string;
};

export default function paperMcpExtension(pi: ExtensionAPI) {
  let sessionId: string | null = null;
  let toolsRegistered = false;
  let loadPromise: Promise<void> | null = null;
  let rpcId = 0;
  const registeredToolNames = new Set<string>();

  function nextRpcId() {
    rpcId += 1;
    return rpcId;
  }

  function toPiContentItem(item: any): any {
    if (!item || typeof item !== "object") {
      return { type: "text", text: String(item) };
    }

    if (item.type === "text") {
      return { type: "text", text: typeof item.text === "string" ? item.text : JSON.stringify(item) };
    }

    if (item.type === "image") {
      const mimeType = item.mimeType ?? item.mime_type ?? "image/png";
      const data = item.data;
      if (typeof data === "string") {
        return { type: "image", data, mimeType };
      }
    }

    return { type: "text", text: JSON.stringify(item, null, 2) };
  }

  async function parseMcpResponse(response: Response): Promise<McpRpcResponse> {
    const text = await response.text();
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("text/event-stream")) {
      const messages: McpRpcResponse[] = [];
      let dataLines: string[] = [];

      const flush = () => {
        if (dataLines.length === 0) return;
        const data = dataLines.join("\n").trim();
        dataLines = [];
        if (!data) return;
        try {
          messages.push(JSON.parse(data));
        } catch {
          messages.push({ error: { message: `Failed to parse MCP SSE payload: ${data}` } });
        }
      };

      for (const line of text.split(/\r?\n/)) {
        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        } else if (line.trim() === "") {
          flush();
        }
      }
      flush();

      return messages[messages.length - 1] ?? { error: { message: "Empty MCP SSE response" } };
    }

    try {
      return JSON.parse(text);
    } catch {
      return { error: { message: `Failed to parse MCP response: ${text}` } };
    }
  }

  async function sendNotification(method: string, params?: Record<string, unknown>) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (sessionId) headers["mcp-session-id"] = sessionId;

    const response = await fetch(PAPER_MCP_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", method, params }),
    });

    const newSessionId = response.headers.get("mcp-session-id");
    if (newSessionId) sessionId = newSessionId;
  }

  async function rpc(method: string, params?: Record<string, unknown>, retry = true): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (sessionId) headers["mcp-session-id"] = sessionId;

    const response = await fetch(PAPER_MCP_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: nextRpcId(), method, params }),
    });

    const newSessionId = response.headers.get("mcp-session-id");
    if (newSessionId) sessionId = newSessionId;

    const payload = await parseMcpResponse(response);

    if (!response.ok) {
      throw new Error(payload.error?.message ?? `${method} failed with HTTP ${response.status}`);
    }

    if (payload.error) {
      const message = payload.error.message ?? `${method} failed`;
      const maybeSessionIssue = /session|initialize/i.test(message);
      if (retry && maybeSessionIssue) {
        sessionId = null;
        return rpc(method, params, false);
      }
      throw new Error(message);
    }

    return payload.result;
  }

  async function initializeServer() {
    if (sessionId) return;

    await rpc("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "pi-paper-mcp",
        version: "0.1.0",
      },
    }, false);

    try {
      await sendNotification("notifications/initialized", {});
    } catch {
      // Best-effort only.
    }
  }

  function registerPaperTool(tool: McpTool) {
    const toolName = `mcp__paper__${tool.name}`;
    if (registeredToolNames.has(toolName)) return;
    registeredToolNames.add(toolName);

    const parameters =
      tool.inputSchema && Object.keys(tool.inputSchema).length > 0
        ? (tool.inputSchema as any)
        : Type.Object({});

    pi.registerTool({
      name: toolName,
      label: `Paper ${tool.name}`,
      description: tool.description ?? `Paper MCP tool ${tool.name}`,
      promptSnippet: `Use ${toolName} for Paper design operations.`,
      parameters,
      async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
        await ensurePaperToolsLoaded();
        const result = await rpc("tools/call", {
          name: tool.name,
          arguments: params ?? {},
        });

        const content = Array.isArray(result?.content)
          ? result.content.map(toPiContentItem)
          : [{ type: "text", text: JSON.stringify(result, null, 2) }];

        return {
          content,
          details: result ?? {},
          isError: Boolean(result?.isError),
        };
      },
    });
  }

  async function loadPaperTools() {
    await initializeServer();
    const toolsResult = await rpc("tools/list", {});
    const tools: McpTool[] = Array.isArray(toolsResult?.tools) ? toolsResult.tools : [];
    for (const tool of tools) registerPaperTool(tool);
    toolsRegistered = tools.length > 0;
  }

  async function ensurePaperToolsLoaded() {
    if (toolsRegistered) return;
    if (loadPromise) return loadPromise;

    loadPromise = loadPaperTools().finally(() => {
      loadPromise = null;
    });

    return loadPromise;
  }

  pi.on("input", async (event, ctx) => {
    if (event.text.trim() !== "/paper-mcp-status") return { action: "continue" as const };

    try {
      await ensurePaperToolsLoaded();
      ctx.ui.notify(
        `Paper MCP ready: ${registeredToolNames.size} tools loaded from ${PAPER_MCP_URL}`,
        "success",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`Paper MCP unavailable: ${message}`, "error");
    }

    return { action: "handled" as const };
  });

  pi.on("session_start", async (_event, ctx: ExtensionContext) => {
    try {
      await ensurePaperToolsLoaded();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`Paper MCP not loaded yet: ${message}`, "warning");
    }
  });
}
