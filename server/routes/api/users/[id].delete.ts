import { defineHandler } from "nitro";
import { getRouterParam, createError } from "nitro/h3";
import { query, queryOne } from "../../../../db/mysql";
import { requireAdminAuth } from "../../../../lib/auth";

export default defineHandler(async (event) => {
  const jwt = await requireAdminAuth(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "id is required" });
  }

  if (id === jwt.sub) {
    throw createError({ statusCode: 400, statusMessage: "Cannot delete your own account" });
  }

  const user = await queryOne<{ id: string }>(
    `SELECT id FROM users WHERE id = ?`,
    [id],
  );
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }

  await query(`DELETE FROM users WHERE id = ?`, [id]);

  return { ok: true, deleted: id };
});