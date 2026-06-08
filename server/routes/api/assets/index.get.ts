import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { query } from "../../../db/postgres";
import { requireUserAuth } from "../../../middleware/auth";

export default defineHandler(async (event) => {
  await requireUserAuth(event);

  const rows = await query(
    `SELECT id, agent_id, hostname, os, os_version, agent_version,
            mac_addresses, ip_addresses, cpu_model, cpu_cores,
            ram_total_bytes, storage_total_bytes,
            disk_model, disk_type, disk_health_status, disk_temperature_c,
            wifi_ssid, wifi_signal_dbm, network_speed_mbps,
            status, last_seen_at, last_location_lat, last_location_lng,
            created_at, updated_at
     FROM assets
     ORDER BY hostname ASC`,
  );

  return rows.map((r) => ({
    ...r,
    created_at: (r.created_at as Date).toISOString(),
    updated_at: (r.updated_at as Date).toISOString(),
    last_seen_at: r.last_seen_at ? (r.last_seen_at as Date).toISOString() : null,
  }));
});
