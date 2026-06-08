import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { queryOne, query } from "../../../db/postgres";
import { writeMetric, writeLocation, flushWrites } from "../../../db/influx";

interface HeartbeatBody {
  agent_id: string;
  api_key: string;
  metrics: {
    cpu_percent: number;
    ram_percent: number;
    ram_used_bytes: number;
    ram_total_bytes: number;
    storage_percent: number;
    storage_used_bytes: number;
    storage_total_bytes: number;
    uptime_seconds: number;
    network_status: "up" | "down" | "degraded";
    network_latency_ms: number;
    disk_health_status?: string;
    disk_temperature_c?: number;
    timestamp: string;
  };
  location: {
    latitude: number;
    longitude: number;
    accuracy_meters: number;
    source: "os" | "geoip";
    timestamp: string;
  };
  network_info?: {
    wifi_ssid: string;
    wifi_signal_dbm: number;
    network_speed_mbps: number;
    ip_addresses: string[];
  };
}

export default defineHandler(async (event) => {
  const body = await readBody<HeartbeatBody>(event);

  if (!body?.agent_id || !body?.api_key) {
    throw createError({ statusCode: 400, statusMessage: "agent_id and api_key required" });
  }

  // Validate API key
  const keyRow = await queryOne<{ id: string }>(
    `SELECT id FROM api_keys
     WHERE key_hash = crypt($1, key_hash) AND is_active = true`,
    [body.api_key],
  );

  if (!keyRow) {
    throw createError({ statusCode: 401, statusMessage: "Invalid API key" });
  }

  await query(`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, [keyRow.id]);

  // Store metrics + location in InfluxDB
  if (body.metrics) {
    writeMetric(body.agent_id, body.metrics);
  }

  if (body.location) {
    writeLocation(body.agent_id, body.location);
  }

  // Update asset status + extended info in PostgreSQL
  const asset = await queryOne<{ id: string }>(
    `SELECT id FROM assets WHERE agent_id = $1`,
    [body.agent_id],
  );

  if (asset) {
    const status = determineStatus(body.metrics);
    const net = body.network_info;

    await query(
      `UPDATE assets SET
        status = $2,
        last_seen_at = now(),
        last_location_lat = COALESCE($3, last_location_lat),
        last_location_lng = COALESCE($4, last_location_lng),
        disk_health_status = COALESCE($5, disk_health_status),
        disk_temperature_c = COALESCE($6, disk_temperature_c),
        wifi_ssid = COALESCE(NULLIF($7, ''), wifi_ssid),
        wifi_signal_dbm = COALESCE($8, wifi_signal_dbm),
        network_speed_mbps = COALESCE($9, network_speed_mbps),
        ip_addresses = COALESCE($10, ip_addresses)
       WHERE agent_id = $1`,
      [
        body.agent_id,
        status,
        body.location?.latitude ?? null,
        body.location?.longitude ?? null,
        body.metrics?.disk_health_status ?? null,
        body.metrics?.disk_temperature_c ?? null,
        net?.wifi_ssid ?? null,
        net?.wifi_signal_dbm ?? null,
        net?.network_speed_mbps ?? null,
        net?.ip_addresses ?? null,
      ],
    );
  }

  await flushWrites();

  return { ok: true, server_time: new Date().toISOString() };
});

function determineStatus(
  metrics?: HeartbeatBody["metrics"],
): "online" | "warning" | "critical" {
  if (!metrics) return "online";
  if (
    metrics.cpu_percent > 95 ||
    metrics.ram_percent > 95 ||
    metrics.storage_percent > 98 ||
    metrics.disk_health_status === "critical"
  )
    return "critical";
  if (
    metrics.cpu_percent > 80 ||
    metrics.ram_percent > 80 ||
    metrics.storage_percent > 90 ||
    metrics.disk_health_status === "warning"
  )
    return "warning";
  return "online";
}
