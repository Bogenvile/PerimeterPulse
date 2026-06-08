import { defineHandler } from "nitro";
import { getRouterParam, getQuery, createError } from "nitro/h3";
import { requireAuth } from "../../../../middleware/auth";
import { queryMetrics } from "../../../../db/influx";

export default defineHandler(async (event) => {
  await requireAuth(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "id is required" });
  }

  const q = getQuery(event);
  // Default to last 1 hour
  const rangeStart = (q.range as string) || "-1h";

  const data = await queryMetrics(id, rangeStart);
  return data;
});
