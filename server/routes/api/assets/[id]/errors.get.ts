import { defineHandler } from "nitro";
import { getRouterParam, getQuery, createError } from "nitro/h3";
import { requireUserAuth } from "../../../../lib/auth";
import { queryErrorLogs, queryOne, ensureErrorLogsTable } from "../../../../db/mysql";

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
  const limit = parseInt((q.limit as string) || "100", 10);

  try {
    await ensureErrorLogsTable();
    const data = await queryErrorLogs(asset.agent_id, limit);
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Error logs query failed:", msg, err);
    // Return empty array instead of crashing
    return [];
  }
});