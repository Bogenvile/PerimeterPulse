import { defineHandler } from "nitro";
import { getRouterParam, createError } from "nitro/h3";
import { queryOne } from "../../../db/postgres";
import { requireUserAuth } from "../../../middleware/auth";

export default defineHandler(async (event) => {
  await requireUserAuth(event);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "id is required" });
  }

  const row = await queryOne(
    `SELECT id, agent_id, hostname, os, os_version, agent_version,
            mac_addresses, ip_addresses, cpu_model, cpu_cores,
            ram_total_bytes, storage_total_bytes,
            disk_model, disk_type, disk_health_status, disk_temperature_c,
            wifi_ssid, wifi_signal_dbm, network_speed_mbps,
            status, last_seen_at, last_location_lat, last_location_lng,
            created_at, updated_at
     FROM assets
     WHERE id = $1 OR agent_id = $1`,
    [id],
  );

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: "Asset not found" });
  }

  return {
    ...row,
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
    last_seen_at: row.last_seen_at ? (row.last_seen_at as Date).toISOString() : null,
  };
});
