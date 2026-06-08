import { defineHandler } from "nitro";
import { getRouterParam, getQuery, createError } from "nitro/h3";
import { requireAuth } from "../../../../middleware/auth";
import { queryLocations } from "../../../../db/influx";

export default defineHandler(async (event) => {
  await requireAuth(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "id is required" });
  }

  const q = getQuery(event);
  // Default to last 24 hours for location history
  const rangeStart = (q.range as string) || "-24h";

  const data = await queryLocations(id, rangeStart);
  return data;
});
