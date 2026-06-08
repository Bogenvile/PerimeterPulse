import { defineHandler } from "nitro";
import { getRouterParam, getQuery, createError } from "nitro/h3";
import { requireAuth } from "../../../../middleware/auth";
import { queryLocations } from "../../../../db/mysql";

function parseRangeToHours(range: string): number {
  const match = range.match(/^-(\d+)(h|d)$/);
  if (!match) return 24;
  const num = parseInt(match[1]);
  const unit = match[2];
  return unit === "d" ? num * 24 : num;
}

export default defineHandler(async (event) => {
  await requireAuth(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "id is required" });
  }

  const q = getQuery(event);
  const rangeStr = (q.range as string) || "-24h";
  const hours = parseRangeToHours(rangeStr);

  const data = await queryLocations(id, hours);
  return data;
});