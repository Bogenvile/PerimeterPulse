import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { queryOne } from "../../../db/mysql";
import { requireUserAuth } from "../../../middleware/auth";

export default defineHandler(async (event) => {
  const jwt = await requireUserAuth(event);
  const user = await queryOne<{
    id: string; username: string; display_name: string;
    role: string; is_active: number; created_at: string; last_login_at: string | null;
  }>(
    `SELECT id, username, display_name, role, is_active, created_at, last_login_at
     FROM users WHERE id = ?`,
    [jwt.sub],
  );
  if (!user) throw createError({ statusCode: 404, statusMessage: "User not found" });
  return {
    id: user.id, username: user.username, display_name: user.display_name,
    role: user.role, is_active: !!user.is_active,
    created_at: user.created_at, last_login_at: user.last_login_at,
  };
});
