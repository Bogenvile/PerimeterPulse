import { defineHandler } from "nitro";
import { getRouterParam, readBody, createError } from "nitro/h3";
import { validateApiKeyByValue } from "../../../../lib/auth";
import { markCommandRunning, completeCommand, ensureAgentCommandsTable } from "../../../../db/commands";

export default defineHandler(async (event) => {
  const commandId = parseInt(getRouterParam(event, "commandId") || "", 10);
  if (isNaN(commandId)) {
    throw createError({ statusCode: 400, statusMessage: "valid commandId is required" });
  }

  const body = await readBody<{
    agent_id?: string;
    api_key?: string;
    action?: "start" | "complete" | "fail" | "timeout";
    output?: string;
    error?: string;
    exit_code?: number;
  }>(event);

  if (!body?.agent_id || !body?.api_key) {
    throw createError({ statusCode: 400, statusMessage: "agent_id and api_key required" });
  }

  const keyId = await validateApiKeyByValue(body.api_key);
  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: "Invalid API key" });
  }

  try {
    await ensureAgentCommandsTable();
  } catch {
    // ignore
  }

  if (body.action === "start") {
    await markCommandRunning(commandId);
    return { ok: true };
  }

  if (body.action === "complete" || body.action === "fail" || body.action === "timeout") {
    const status = body.action === "timeout" ? "timeout" : undefined;
    if (status) {
      const { query: q } = await import("../../../../db/mysql");
      await q(
        `UPDATE agent_commands SET status = 'timeout', completed_at = NOW() WHERE id = ? AND status = 'running'`,
        [commandId],
      );
      return { ok: true };
    }
    const updated = await completeCommand(
      commandId,
      body.agent_id,
      body.output ?? null,
      body.error ?? null,
      body.exit_code ?? null,
    );
    if (!updated) {
      throw createError({ statusCode: 409, statusMessage: "Command not found or already completed" });
    }
    return { ok: true };
  }

  throw createError({ statusCode: 400, statusMessage: "action must be 'start', 'complete', 'fail', or 'timeout'" });
});