import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { query } from "../../../db/postgres";
import { requireAuth } from "../../../middleware/auth";

export default defineHandler(async (event) => {
  await requireAuth(event);

  const rows = await query(
    `SELECT id, agent_id, hostname, os, os_version, agent_version,
            mac_addresses, cpu_model, ram_total_bytes, storage_total_bytes,
            status, last_seen_at, last_location_lat, last_location_lng,
            created_at, updated_at
     FROM assets
     ORDER BY hostname ASC`,
  );

  return rows.map((r) => ({
    ...r,
    created_at: (r.created_at as Date).toISOString(),
    updated_at: (r.updated_at as Date).toISOString(),
    last_seen_at: r.last_seen_at
      ? (r.last_seen_at as Date).toISOString()
      : null,
  }));
});
