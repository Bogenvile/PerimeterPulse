import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { queryOne, query, insertMetrics, insertLocation } from "../../../db/mysql";
import { validateApiKeyByValue } from "../../../lib/auth";

interface HeartbeatBody {
  agent_id: string; api_key: string;
  metrics?: {
    cpu_percent: number; ram_percent: number; ram_used_bytes: number; ram_total_bytes: number;
    storage_percent: number; storage_used_bytes: number; storage_total_bytes: number;
    uptime_seconds: number; network_status: "up" | "down" | "degraded";
    network_latency_ms: number;
    gateway_reachable?: boolean; dns_working?: boolean; internet_reachable?: boolean;
    default_gateway?: string;
    disk_health_status?: string; disk_temperature_c?: number;
    timestamp: string;
  };
  location?: {
    latitude: number; longitude: number; accuracy_meters: number;
    source: "os" | "geoip"; timestamp: string;
  };
  network_info?: {
    wifi_ssid: string; wifi_signal_dbm: number;
    network_speed_mbps: number; ip_addresses: string[];
  };
}

export default defineHandler(async (event) => {
  const body = await readBody<HeartbeatBody>(event);
  if (!body?.agent_id || !body?.api_key) {
    throw createError({ statusCode: 400, statusMessage: "agent_id and api_key required" });
  }

  const keyId = await validateApiKeyByValue(body.api_key);
  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: "Invalid API key" });
  }

  // Write metrics & location to MySQL
  if (body.metrics) await insertMetrics(body.agent_id, body.metrics);
  if (body.location) await insertLocation(body.agent_id, body.location);

  // Update asset record
  const asset = await queryOne<{ id: string }>(
    `SELECT id FROM assets WHERE agent_id = ?`, [body.agent_id],
  );

  if (asset) {
    const status = determineStatus(body.metrics);
    const net = body.network_info;
    await query(
      `UPDATE assets SET
        status=?, last_seen_at=NOW(),
        last_location_lat=COALESCE(?, last_location_lat),
        last_location_lng=COALESCE(?, last_location_lng),
        disk_health_status=COALESCE(?, disk_health_status),
        disk_temperature_c=COALESCE(?, disk_temperature_c),
        wifi_ssid=COALESCE(NULLIF(?,''), wifi_ssid),
        wifi_signal_dbm=COALESCE(?, wifi_signal_dbm),
        network_speed_mbps=COALESCE(?, network_speed_mbps),
        ip_addresses=COALESCE(?, ip_addresses)
       WHERE agent_id=?`,
      [
        status,
        body.location?.latitude ?? null, body.location?.longitude ?? null,
        body.metrics?.disk_health_status ?? null, body.metrics?.disk_temperature_c ?? null,
        net?.wifi_ssid ?? null, net?.wifi_signal_dbm ?? null,
        net?.network_speed_mbps ?? null,
        net?.ip_addresses ? JSON.stringify(net.ip_addresses) : null,
        body.agent_id,
      ],
    );
  }

  return { ok: true, server_time: new Date().toISOString() };
});

function determineStatus(m?: HeartbeatBody["metrics"]): "online"|"warning"|"critical" {
  if (!m) return "online";
  // Only mark critical if something is dangerously high
  if (m.cpu_percent > 98 || m.ram_percent > 98 || m.storage_percent > 99 || m.disk_health_status === "critical") return "critical";
  if (m.cpu_percent > 90 || m.ram_percent > 90 || m.storage_percent > 95 || m.disk_health_status === "warning") return "warning";
  return "online";
}