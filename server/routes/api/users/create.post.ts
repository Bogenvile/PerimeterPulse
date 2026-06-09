import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { query, queryOne, hashSecret } from "../../../db/mysql";
import { requireAdminAuth } from "../../../lib/auth";

export default defineHandler(async (event) => {
  await requireAdminAuth(event);
  const body = await readBody<{
    username?: string;
    display_name?: string;
    password?: string;
    role?: "admin" | "viewer";
  }>(event);

  if (!body?.username || !body?.password) {
    throw createError({ statusCode: 400, statusMessage: "username and password are required" });
  }

  if (body.username.length < 3) {
    throw createError({ statusCode: 400, statusMessage: "Username must be at least 3 characters" });
  }

  if (body.password.length < 6) {
    throw createError({ statusCode: 400, statusMessage: "Password must be at least 6 characters" });
  }

  if (!["admin", "viewer"].includes(body.role || "viewer")) {
    throw createError({ statusCode: 400, statusMessage: "Role must be 'admin' or 'viewer'" });
  }

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM users WHERE username = ?`,
    [body.username],
  );

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: "Username already exists" });
  }

  const passwordHash = hashSecret(body.password);
  const displayName = body.display_name || body.username;

  const result = await query<{ insertId: number }>(
    `INSERT INTO users (username, display_name, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [body.username, displayName, passwordHash, body.role || "viewer"],
  );

  return {
    ok: true,
    id: result.insertId,
    username: body.username,
    display_name: displayName,
    role: body.role || "viewer",
  };
});