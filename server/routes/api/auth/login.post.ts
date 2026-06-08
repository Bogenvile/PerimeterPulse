import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { queryOne, query } from "../../../db/postgres";
import { signJwt } from "../../../middleware/auth";

export default defineHandler(async (event) => {
  const body = await readBody<{ username?: string; password?: string }>(event);

  if (!body?.username || !body?.password) {
    throw createError({ statusCode: 400, statusMessage: "username and password required" });
  }

  // Verify credentials using pgcrypto
  const user = await queryOne<{
    id: string;
    username: string;
    display_name: string;
    role: string;
    is_active: boolean;
    created_at: Date;
    last_login_at: Date | null;
  }>(
    `SELECT id, username, display_name, role, is_active, created_at, last_login_at
     FROM users
     WHERE username = $1 AND password_hash = crypt($2, password_hash)`,
    [body.username, body.password],
  );

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Invalid username or password" });
  }

  if (!user.is_active) {
    throw createError({ statusCode: 403, statusMessage: "Account is disabled" });
  }

  // Update last login
  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

  // Generate JWT
  const token = await signJwt({
    id: user.id,
    username: user.username,
    role: user.role as "admin" | "viewer",
  });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at.toISOString(),
      last_login_at: user.last_login_at?.toISOString() ?? null,
    },
  };
});
