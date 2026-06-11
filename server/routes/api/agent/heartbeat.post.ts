import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { queryOne, query, insertMetrics, insertLocation, insertErrorLogs } from "../../../db/mysql";
import { validateApiKeyByValue } from "../../../lib/auth";

interface HeartbeatBody {
  agent_id: string; 
  api_key: string;
  metrics?: any;
  location?: any;
  network_info?: any;
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

  try {
    const m = body.metrics || {};
    const n = body.network_info || {};
    const l = body.location || {};

    // 1. Sanitize Metrics object to ensure no 'undefined' values reach the DB
    const safeMetrics = {
      cpu_percent: m.cpu_percent ?? 0,
      ram_percent: m.ram_percent ?? 0,
      ram_used_bytes: m.ram_used_bytes ?? 0,
      ram_total_bytes: m.ram_total_bytes ?? 0,
      storage_percent: m.storage_percent ?? 0,
      storage_used_bytes: m.storage_used_bytes ?? 0,
      storage_total_bytes: m.storage_total_bytes ?? 0,
      uptime_seconds: m.uptime_seconds ?? 0,
      network_status: m.network_status || "unknown",
      network_latency_ms: m.network_latency_ms ?? 0,
      ping_latency_ms: m.ping_latency_ms ?? null,
      error_count: m.error_count ?? 0,
      // Booleans
      gateway_reachable: m.gateway_reachable != null ? !!m.gateway_reachable : null,
      dns_working: m.dns_working != null ? !!m.dns_working : null,
      internet_reachable: m.internet_reachable != null ? !!m.internet_reachable : null,
      default_gateway: m.default_gateway || null,
      disk_health_status: m.disk_health_status || "unknown",
      disk_temperature_c: m.disk_temperature_c != null ? Number(m.disk_temperature_c) : null,
      timestamp: m.timestamp || new Date().toISOString(),
    };

    if (body.metrics) {
      await insertMetrics(body.agent_id, safeMetrics);
      if (body.metrics.error_logs && body.metrics.error_logs.length > 0) {
        await insertErrorLogs(body.agent_id, body.metrics.error_logs);
      }
    }

    // 2. Sanitize Location object
    if (body.location) {
      const safeLocation = {
        latitude: l.latitude ?? 0,
        longitude: l.longitude ?? 0,
        accuracy_meters: l.accuracy_meters ?? 0,
        source: l.source || "unknown",
        timestamp: l.timestamp || new Date().toISOString(),
      };
      await insertLocation(body.agent_id, safeLocation);
    }

    // 3. Update Asset Info (Sanitized)
    const asset = await queryOne<{ id: string }>(
      `SELECT id FROM assets WHERE agent_id = ?`, [body.agent_id],
    );

    if (asset) {
      const status = determineStatus(safeMetrics);
      
      // Extract network info safely
      const wifiSsid = n.wifi_ssid || null;
      const wifiSignal = n.wifi_signal_dbm != null ? n.wifi_signal_dbm : null;
      const wifiIp = n.wifi_ip || null;
      const gatewayIp = n.gateway_ip || null;
      const netSpeed = n.network_speed_mbps != null ? n.network_speed_mbps : null;
      const ipAddr = n.ip_addresses ? JSON.stringify(n.ip_addresses) : null;

      await query(
        `UPDATE assets SET
          status=?, last_seen_at=NOW(),
          last_location_lat=COALESCE(?, last_location_lat),
          last_location_lng=COALESCE(?, last_location_lng),
          city=COALESCE(NULLIF(?, ''), city),
          country=COALESCE(NULLIF(?, ''), country),
          disk_health_status=COALESCE(?, disk_health_status),
          disk_temperature_c=COALESCE(?, disk_temperature_c),
          wifi_ssid=COALESCE(NULLIF(?, ''), wifi_ssid),
          wifi_signal_dbm=COALESCE(?, wifi_signal_dbm),
          wifi_ip=COALESCE(NULLIF(?, ''), wifi_ip),
          gateway_ip=COALESCE(NULLIF(?, ''), gateway_ip),
          network_speed_mbps=COALESCE(?, COALESCE(network_speed_mbps, 0)),
          ping_latency_ms=COALESCE(?, COALESCE(ping_latency_ms, 0)),
          error_count=COALESCE(?, COALESCE(error_count, 0)),
          ip_addresses=COALESCE(?, ip_addresses)
         WHERE agent_id=?`,
        [
          status,
          safeMetrics.latitude ?? l.latitude, safeMetrics.longitude ?? l.longitude, // Using sanitized values if available
          l.city || null, l.country || null,
          safeMetrics.disk_health_status, safeMetrics.disk_temperature_c,
          wifiSsid, wifiSignal,
          wifiIp, gatewayIp,
          netSpeed,
          safeMetrics.ping_latency_ms, safeMetrics.error_count,
          ipAddr,
          body.agent_id,
        ],
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Heartbeat DB Error:", msg, err);
    throw createError({
      statusCode: 500,
      statusMessage: "Database error: " + msg,
    });
  }

  return { ok: true, server_time: new Date().toISOString() };
});

function determineStatus(m: any): "online" | "warning" | "critical" {
  if (!m) return "online";
  const cpu = m.cpu_percent || 0;
  const ram = m.ram_percent || 0;
  const storage = m.storage_percent || 0;
  
  if (cpu > 98 || ram > 98 || storage > 99 || m.disk_health_status === "critical") return "critical";
  if (cpu > 90 || ram > 90 || storage > 95 || m.disk_health_status === "warning") return "warning";
  return "online";
}