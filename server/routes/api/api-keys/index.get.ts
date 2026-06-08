import { defineHandler } from "nitro";
import { query } from "../../../db/postgres";
import { requireAdminAuth } from "../../../middleware/auth";

export default defineHandler(async (event) => {
  await requireAdminAuth(event);

  const rows = await query<{
    id: string;
    key_prefix: string;
    label: string;
    is_active: boolean;
    created_at: Date;
    last_used_at: Date | null;
  }>(
    `SELECT id, key_prefix, label, is_active, created_at, last_used_at
     FROM api_keys ORDER BY created_at DESC`,
  );

  return rows.map((r) => ({
    ...r,
    created_at: r.created_at.toISOString(),
    last_used_at: r.last_used_at?.toISOString() ?? null,
  }));
});
