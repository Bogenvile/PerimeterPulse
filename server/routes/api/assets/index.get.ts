import { defineHandler } from "nitro";
import { requireUserAuth } from "../../../middleware/auth";
import { query, parseJsonArray } from "../../../db/mysql";

export default defineHandler(async (event) => {
  await requireUserAuth(event);

  const rows = await query<Record<string, unknown>>(
    `SELECT id, agent_id, hostname, os, os_version, agent_version,
            mac_addresses, ip_addresses, cpu_model, cpu_cores,
            ram_total_bytes, storage_total_bytes,
            disk_model, disk_type, disk_health_status, disk_temperature_c,
            wifi_ssid, wifi_signal_dbm, network_speed_mbps,
            status, last_seen_at, last_location_lat, last_location_lng,
            created_at, updated_at
     FROM assets ORDER BY hostname ASC`,
  );

  return rows.map((r) => ({
    ...r,
    mac_addresses: parseJsonArray(r.mac_addresses),
    ip_addresses: parseJsonArray(r.ip_addresses),
    created_at: toIso(r.created_at),
    updated_at: toIso(r.updated_at),
    last_seen_at: r.last_seen_at ? toIso(r.last_seen_at) : null,
    cpu_cores: r.cpu_cores ?? 0,
    wifi_signal_dbm: r.wifi_signal_dbm ?? null,
    disk_temperature_c: r.disk_temperature_c ?? null,
  }));
});

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString();
    return v;
  }
  return "";
}
