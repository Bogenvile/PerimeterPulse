import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { requireUserAuth } from "../../../lib/auth";
import { query, parseJsonArray, ensureV6Schema } from "../../../db/mysql";

export default defineHandler(async (event) => {
  await requireUserAuth(event);

  // Ensure tags column and other v6 schema additions exist
  await ensureV6Schema();

  const q = getQuery(event);
  const filterTags: string[] = [];
  if (typeof q.tags === "string" && q.tags.trim()) {
    filterTags.push(...q.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean));
  }

  // Build query based on tags filter
  let sql = `SELECT id, agent_id, hostname, os, os_version, agent_version,
            mac_addresses, ip_addresses, cpu_model, cpu_cores,
            ram_total_bytes, storage_total_bytes,
            disk_model, disk_type, disk_health_status, disk_temperature_c,
            wifi_ssid, wifi_signal_dbm, wifi_ip, gateway_ip,
            network_speed_mbps, ping_latency_ms, error_count,
            status, last_seen_at, last_location_lat, last_location_lng,
            city, country, tags,
            created_at, updated_at
     FROM assets`;
  const params: unknown[] = [];

  if (filterTags.length > 0) {
    // Filter assets yang mengandung setidaknya satu tags dari list
    const conditions = filterTags.map(() => `JSON_CONTAINS(tags, JSON_QUOTE(?))`).join(" OR ");
    sql += ` WHERE (${conditions})`;
    params.push(...filterTags);
  }

  sql += ` ORDER BY hostname ASC`;

  const rows = await query<Record<string, unknown>>(sql, params);

  return rows.map((r) => ({
    ...r,
    mac_addresses: parseJsonArray(r.mac_addresses),
    ip_addresses: parseJsonArray(r.ip_addresses),
    tags: parseJsonArray(r.tags),
    created_at: toIso(r.created_at),
    updated_at: toIso(r.updated_at),
    last_seen_at: r.last_seen_at ? toIso(r.last_seen_at) : null,
    cpu_cores: r.cpu_cores ?? 0,
    wifi_signal_dbm: r.wifi_signal_dbm ?? null,
    disk_temperature_c: r.disk_temperature_c ?? null,
    ping_latency_ms: r.ping_latency_ms ?? null,
    error_count: r.error_count ?? 0,
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