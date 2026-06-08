import { defineHandler } from "nitro";
import { query } from "../../../db/mysql";
import { requireAdminAuth } from "../../../middleware/auth";

export default defineHandler(async (event) => {
  await requireAdminAuth(event);
  const rows = await query<Record<string, unknown>>(
    `SELECT id, key_prefix, label, is_active, created_at, last_used_at
     FROM api_keys ORDER BY created_at DESC`,
  );
  return rows.map((r) => ({
    ...r,
    is_active: !!r.is_active,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    last_used_at: r.last_used_at instanceof Date ? r.last_used_at.toISOString() : r.last_used_at,
  }));
});
