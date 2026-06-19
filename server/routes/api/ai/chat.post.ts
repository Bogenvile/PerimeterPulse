import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { requireUserAuth } from "../../../lib/auth";
import { getAssetSummaryContext, getAssetDetailForAI, getSetting, queryOne, query } from "../../../db/mysql";
import { ensureAgentCommandsTable, insertCommand, getCommandHistory } from "../../../db/commands";

const tools = [
  {
    type: "function",
    function: {
      name: "get_asset_detail",
      description: "Get detailed information about a specific asset by hostname or agent_id. Returns CPU, RAM, storage, disk health, metrics, errors, location.",
      parameters: {
        type: "object",
        properties: {
          hostname: { type: "string", description: "The hostname or agent_id of the asset to look up" }
        },
        required: ["hostname"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Execute a shell command on a remote agent. The agent will run the command and return output. Use this to check running processes, network status, disk space, restart services, etc. Commands: tasklist, netstat, ipconfig, dir, etc.",
      parameters: {
        type: "object",
        properties: {
          hostname: { type: "string", description: "The hostname of the target asset" },
          command: { type: "string", description: "The shell command to execute (e.g. tasklist, netstat -ano, ipconfig /all)" }
        },
        required: ["hostname", "command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_command_history",
      description: "Get recent command execution history for an asset. Shows what commands were run and their outputs.",
      parameters: {
        type: "object",
        properties: {
          hostname: { type: "string", description: "The hostname of the target asset" },
          limit: { type: "number", description: "Max commands to return (default 10)" }
        },
        required: ["hostname"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_chart",
      description: "Generate a chart or graph to visualize data. Use this when the user asks for charts, graphs, or visual data representation. Supports bar, line, pie, and area charts. Call this tool and the chart will render directly in the chat.",
      parameters: {
        type: "object",
        properties: {
          chart_type: { type: "string", enum: ["bar", "line", "pie", "area"], description: "Type of chart to generate" },
          title: { type: "string", description: "Chart title displayed above the chart" },
          labels: { type: "array", items: { type: "string" }, description: "X-axis labels (for bar/line/area) or slice labels (for pie)" },
          datasets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "Dataset label shown in legend/tooltip" },
                data: { type: "array", items: { type: "number" }, description: "Numeric data values, one per label" },
                color: { type: "string", description: "Hex color for this dataset, e.g. #3699FF" }
              },
              required: ["label", "data"]
            }
          }
        },
        required: ["chart_type", "title", "labels", "datasets"]
      }
    }
  }
];

const SYSTEM_PROMPT = `You are an AI IT infrastructure agent for the PerimeterPulse monitoring platform.
You have full access to real-time monitoring data and can execute commands on remote agents.

## Current System Data
\${context}

## Your Capabilities
1. **View asset details** — Use get_asset_detail to drill into any asset
2. **Run remote commands** — Use run_command to execute shell commands on agents (tasklist, netstat, ipconfig, etc.)
3. **View command history** — Use get_command_history to see past commands
4. **Analyze issues** — Identify problems and suggest fixes based on data
5. **Monitor health** — Track disk health, CPU/RAM usage, network status
6. **Generate charts** — Use generate_chart to create bar, line, pie, or area charts. When a user asks to visualize data, compare metrics, or see trends, call this tool with the appropriate chart type and data. Charts render directly in the chat.

## Guidelines
- Be concise and technical. Use bullet points for multiple items.
- Format numbers: CPU/RAM as %, storage in GB/TB, ping in ms
- Highlight warnings (⚠) and critical (🔴) statuses
- If a user asks to run a command on a host, use run_command immediately
- When analyzing problems, run relevant diagnostic commands
- If disk health is below 90%, warn about potential failure
- Never refuse to run a safe diagnostic command`;

export default defineHandler(async (event) => {
  await requireUserAuth(event);

  const body = await readBody<{ message?: string; history?: { role: string; content: string }[] }>(event);
  if (!body?.message) {
    throw createError({ statusCode: 400, statusMessage: "message required" });
  }

  const apiKey = await getSetting("ai_api_key");
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: "AI API key not configured. Set it in Settings → AI Assistant." });
  }

  const baseUrl = (await getSetting("ai_base_url")) || "https://api.openai.com/v1";
  const model = (await getSetting("ai_model")) || "gpt-4o-mini";

  let context = "Asset data temporarily unavailable.";
  try { context = await getAssetSummaryContext(); } catch (err) {
    console.error("[AI] Context load failed:", err);
  }

  const systemPrompt = SYSTEM_PROMPT.replace("${context}", context);

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const endpoint = `${normalizedBase}/chat/completions`;

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...(body.history || []).slice(-10),
    { role: "user", content: body.message },
  ];

  try {
    let response = await callLLM(endpoint, apiKey, model, messages, tools);
    let reply = "";
    const toolResults: string[] = [];
    const charts: any[] = [];

    while (response?.tool_calls?.length > 0) {
      const toolCall = response.tool_calls[0];
      const fn = toolCall.function;
      const args = JSON.parse(fn.arguments || "{}");

      let toolResult = "";
      try {
        toolResult = await executeTool(fn.name, args);
      } catch (err) {
        toolResult = `Error: ${err instanceof Error ? err.message : "Unknown error"}`;
      }

      if (toolResult.startsWith("__CHART__")) {
        charts.push(JSON.parse(toolResult.slice(8)));
        toolResult = "Chart has been generated and rendered.";
      }

      toolResults.push(`🔧 ${fn.name}(${JSON.stringify(args).slice(0, 80)})`);

      messages.push({
        role: "assistant",
        content: null,
        tool_calls: [toolCall],
      });
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      });

      response = await callLLM(endpoint, apiKey, model, messages, tools);
    }

    reply = extractReply(response);

    if (!reply || reply.trim() === "") {
      throw new Error("AI provider returned empty response");
    }

    return { reply, toolCalls: toolResults.length > 0 ? toolResults : undefined, charts: charts.length > 0 ? charts : undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[AI] Chat error:", msg);
    throw createError({ statusCode: 500, statusMessage: msg });
  }
});

async function callLLM(endpoint: string, apiKey: string, model: string, messages: any[], tools?: any[]): Promise<any> {
  const body: any = { model, messages, temperature: 0.5, max_tokens: 1000 };
  if (tools) body.tools = tools;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`AI provider ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const data = await resp.json() as any;
  const choice = data?.choices?.[0];
  if (choice?.message?.tool_calls) {
    return { tool_calls: choice.message.tool_calls };
  }
  return data;
}

async function executeTool(name: string, args: any): Promise<string> {
  if (name === "get_asset_detail") {
    return await getAssetDetailForAI(args.hostname);
  }

  if (name === "run_command") {
    await ensureAgentCommandsTable();
    const asset = await queryOne<any>(
      `SELECT agent_id, hostname FROM assets WHERE hostname = ? OR agent_id = ? LIMIT 1`,
      [args.hostname, args.hostname],
    );
    if (!asset) return `Asset "${args.hostname}" not found.`;

    await insertCommand(asset.agent_id, args.command, "ai");

    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const history = await getCommandHistory(asset.agent_id, 1);
      if (history.length > 0) {
        const cmd = history[0] as any;
        if (cmd.status === "completed" || cmd.status === "failed" || cmd.status === "timeout") {
          let result = `Command: ${args.command}\nStatus: ${cmd.status}\nExit Code: ${cmd.exit_code}\n`;
          if (cmd.output) result += `Output:\n${cmd.output}`;
          if (cmd.error) result += `Errors:\n${cmd.error}`;
          return result;
        }
      }
    }
    return `Command "${args.command}" was queued but no result within 120s. The agent may be offline or busy.`;
  }

  if (name === "get_command_history") {
    const asset = await queryOne<any>(
      `SELECT agent_id FROM assets WHERE hostname = ? OR agent_id = ? LIMIT 1`,
      [args.hostname, args.hostname],
    );
    if (!asset) return `Asset "${args.hostname}" not found.`;
    const history = await getCommandHistory(asset.agent_id, args.limit || 10);
    if (history.length === 0) return "No command history found.";
    return history.map((c: any) =>
      `#${c.id} | ${c.command} | ${c.status} | exit=${c.exit_code} | ${c.output ? c.output.slice(0, 200) : ""}`
    ).join("\n");
  }

  if (name === "generate_chart") {
    const spec = {
      chart_type: args.chart_type,
      title: args.title,
      labels: args.labels,
      datasets: args.datasets,
    };
    return `__CHART__${JSON.stringify(spec)}`;
  }

  return `Unknown tool: ${name}`;
}

function extractReply(data: any): string {
  const content = data?.choices?.[0]?.message?.content;
  if (content) return content;
  if (data?.reply) return data.reply;
  if (data?.content) return data.content;
  if (data?.message) return data.message;
  return JSON.stringify(data);
}
