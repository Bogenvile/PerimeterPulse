import { defineHandler } from "nitro";
import { getRouterParam, getQuery, createError } from "nitro/h3";
import { requireUserAuth } from "../../../../middleware/auth";
import { queryMetrics } from "../../../../db/mysql";

function parseRangeToHours(range: string): number {
  const match = range.match(/^-(\d+)(h|d)$/);
  if (!match) return 1;
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

  const q = getQuery(event);
  const rangeStr = (q.range as string) || "-1h";
  const hours = parseRangeToHours(rangeStr);

  const data = await queryMetrics(id, hours);
  return data;
});