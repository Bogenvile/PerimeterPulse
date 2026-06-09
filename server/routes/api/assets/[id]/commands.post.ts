import { defineHandler } from "nitro";
import { getRouterParam, readBody, createError } from "nitro/h3";
import { requireAdminAuth } from "../../../../lib/auth";
import { queryOne } from "../../../../db/mysql";
import { insertCommand, ensureAgentCommandsTable } from "../../../../db/commands";

export default defineHandler(async (event) => {
  const jwt = await requireAdminAuth(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "id is required" });
  }

  const asset = await queryOne<{ agent_id: string }>(
    `SELECT agent_id FROM assets WHERE id = ? OR agent_id = ?`,
    [id, id],
  );
  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: "Asset not found" });
  }

  const body = await readBody<{ command?: string }>(event);
  if (!body?.command || !body.command.trim()) {
    throw createError({ statusCode: 400, statusMessage: "command is required" });
  }

  if (body.command.length > 4096) {
    throw createError({ statusCode: 400, statusMessage: "Command too long (max 4096 chars)" });
  }

  try {
    await ensureAgentCommandsTable();
  } catch {
    // table might already exist
  }

  const result = await insertCommand(asset.agent_id, body.command.trim(), jwt.sub);

  return {
    ok: true,
    id: result.id,
    agent_id: asset.agent_id,
    command: body.command.trim(),
    status: "pending",
    message: "Command queued. The agent will pick it up on the next heartbeat.",
  };
});