import { defineHandler } from "nitro";
import { getRouterParam, createError } from "nitro/h3";
import { queryOne, parseJsonArray } from "../../../db/mysql";
import { requireUserAuth } from "../../../lib/auth";

export default defineHandler(async (event) => {
  await requireUserAuth(event);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "id is required" });

  const row = await queryOne<Record<string, unknown>>(
    `SELECT id, agent_id, hostname, os, os_version, agent_version,
            mac_addresses, ip_addresses, cpu_model, cpu_cores,
            ram_total_bytes, storage_total_bytes,
            disk_model, disk_type, disk_health_status, disk_temperature_c,
            wifi_ssid, wifi_signal_dbm, wifi_ip, gateway_ip,
            network_speed_mbps, ping_latency_ms, error_count,
            status, last_seen_at, last_location_lat, last_location_lng,
            city, country, tags,
            created_at, updated_at
     FROM assets WHERE id = ? OR agent_id = ?`,
    [id, id],
  );
  if (!row) throw createError({ statusCode: 404, statusMessage: "Asset not found" });

  return {
    ...row,
    mac_addresses: parseJsonArray(row.mac_addresses),
    ip_addresses: parseJsonArray(row.ip_addresses),
    tags: parseJsonArray(row.tags),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    last_seen_at: row.last_seen_at ? toIso(row.last_seen_at) : null,
    cpu_cores: row.cpu_cores ?? 0,
    wifi_signal_dbm: row.wifi_signal_dbm ?? null,
    disk_temperature_c: row.disk_temperature_c ?? null,
    ping_latency_ms: row.ping_latency_ms ?? null,
    error_count: row.error_count ?? 0,
  };
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