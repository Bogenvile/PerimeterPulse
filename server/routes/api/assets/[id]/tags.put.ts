import { defineHandler } from "nitro";
import { getRouterParam, readBody, createError } from "nitro/h3";
import { requireAdminAuth } from "../../../../lib/auth";
import { queryOne, query, tagsToJson } from "../../../../db/mysql";

export default defineHandler(async (event) => {
  await requireAdminAuth(event);

  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "id is required" });

  const body = await readBody<{ tags?: string[] }>(event);
  if (!body?.tags || !Array.isArray(body.tags)) {
    throw createError({ statusCode: 400, statusMessage: "tags array required" });
  }

  const asset = await queryOne<{ agent_id: string }>(
    `SELECT agent_id FROM assets WHERE id = ? OR agent_id = ?`,
    [id, id],
  );
  if (!asset) throw createError({ statusCode: 404, statusMessage: "Asset not found" });

  const cleanTags = body.tags
    .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"))
    .filter((t) => t.length > 0 && t.length <= 32);

  await query(`UPDATE assets SET tags = ? WHERE agent_id = ?`, [tagsToJson(cleanTags), asset.agent_id]);

  return { tags: cleanTags };
});