import { defineHandler } from "nitro";
import { getRouterParam, getQuery, createError } from "nitro/h3";
import { requireUserAuth } from "../../../../lib/auth";
import { queryLocations, queryOne } from "../../../../db/mysql";

function parseRangeToHours(range: string): number {
  const match = range.match(/^-(\d+)(h|d)$/);
  if (!match) return 24;
  const num = parseInt(match[1]);
  const unit = match[2];
  return unit === "d" ? num * 24 : num;
}

export default defineHandler(async (event) => {
  await requireUserAuth(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "id is required" });
  }

  // Resolve UUID or agent_id to the actual agent_id
  const asset = await queryOne<{ agent_id: string }>(
    `SELECT agent_id FROM assets WHERE id = ? OR agent_id = ?`,
    [id, id],
  );
  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: "Asset not found" });
  }

  const q = getQuery(event);
  const rangeStr = (q.range as string) || "-24h";
  const hours = parseRangeToHours(rangeStr);

  const data = await queryLocations(asset.agent_id, hours);
  return data;
});