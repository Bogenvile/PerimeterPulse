import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { queryOne, query, verifySecret, hashSecret } from "../../../db/mysql";
import { requireUserAuth } from "../../../lib/auth";

export default defineHandler(async (event) => {
  const jwt = await requireUserAuth(event);
  const body = await readBody<{ current_password?: string; new_password?: string }>(event);

  if (!body?.current_password || !body?.new_password) {
    throw createError({
      statusCode: 400,
      statusMessage: "current_password and new_password are required",
    });
  }

  if (body.new_password.length < 6) {
    throw createError({
      statusCode: 400,
      statusMessage: "New password must be at least 6 characters",
    });
  }

  const user = await queryOne<{ id: string; password_hash: string }>(
    `SELECT id, password_hash FROM users WHERE id = ? AND is_active = 1`,
    [jwt.sub],
  );

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }

  if (!verifySecret(body.current_password, user.password_hash)) {
    throw createError({ statusCode: 401, statusMessage: "Current password is incorrect" });
  }

  const newHash = hashSecret(body.new_password);
  await query(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, user.id]);

  return { ok: true, message: "Password changed successfully" };
});