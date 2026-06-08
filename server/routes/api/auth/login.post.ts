import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { queryOne, query, verifySecret } from "../../../db/mysql";
import { signJwt } from "../../../middleware/auth";

export default defineHandler(async (event) => {
  const body = await readBody<{ username?: string; password?: string }>(event);
  if (!body?.username || !body?.password) {
    throw createError({ statusCode: 400, statusMessage: "username and password required" });
  }

  const user = await queryOne<{
    id: string; username: string; display_name: string;
    role: string; is_active: number; created_at: string; last_login_at: string | null;
  }>(
    `SELECT id, username, display_name, role, is_active, created_at, last_login_at
     FROM users WHERE username = ? AND is_active = 1`,
    [body.username],
  );

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Invalid username or password" });
  }

  // Fetch password hash separately for bcrypt verification
  const pwRow = await queryOne<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = ?`, [user.id],
  );
  if (!pwRow || !verifySecret(body.password, pwRow.password_hash)) {
    throw createError({ statusCode: 401, statusMessage: "Invalid username or password" });
  }

  await query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id]);

  const token = await signJwt({
    id: user.id, username: user.username, role: user.role as "admin" | "viewer",
  });

  return {
    token,
    user: {
      id: user.id, username: user.username, display_name: user.display_name,
      role: user.role, is_active: !!user.is_active,
      created_at: user.created_at, last_login_at: user.last_login_at,
    },
  };
});
