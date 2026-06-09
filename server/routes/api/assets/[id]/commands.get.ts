import { defineHandler } from "nitro";
import { getRouterParam, getQuery, createError } from "nitro/h3";
import { requireUserAuth } from "../../../../lib/auth";
import { queryOne } from "../../../../db/mysql";
import { getCommandHistory, ensureAgentCommandsTable } from "../../../../db/commands";

export default defineHandler(async (event) => {
  await requireUserAuth(event);

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

  const q = getQuery(event);
  const limit = parseInt((q.limit as string) || "50", 10);

  try {
    await ensureAgentCommandsTable();
  } catch {
    // table might already exist
  }

  const history = await getCommandHistory(asset.agent_id, limit);
  return history;
});