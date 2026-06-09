import { defineHandler } from "nitro";
import { getRouterParam, createError } from "nitro/h3";
import { requireAdminAuth } from "../../../../lib/auth";
import { query, queryOne } from "../../../../db/mysql";

export default defineHandler(async (event) => {
  await requireAdminAuth(event);

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

  const agentId = asset.agent_id;

  await query(`DELETE FROM agent_metrics WHERE agent_id = ?`, [agentId]);
  await query(`DELETE FROM agent_locations WHERE agent_id = ?`, [agentId]);
  try {
    await query(`DELETE FROM agent_error_logs WHERE agent_id = ?`, [agentId]);
  } catch {
    // table might not exist yet
  }
  await query(`DELETE FROM assets WHERE agent_id = ?`, [agentId]);

  return { ok: true, deleted: agentId };
});