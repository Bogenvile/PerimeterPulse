import { defineHandler } from "nitro";
import { query } from "../../../db/mysql";
import { requireAdminAuth } from "../../../lib/auth";

export default defineHandler(async (event) => {
  await requireAdminAuth(event);
  const rows = await query<Record<string, unknown>>(
    `SELECT id, username, display_name, role, is_active, created_at, last_login_at
     FROM users ORDER BY created_at DESC`,
  );
  return rows.map((r) => ({
    ...r,
    is_active: !!r.is_active,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    last_login_at: r.last_login_at instanceof Date ? r.last_login_at.toISOString() : r.last_login_at,
  }));
});