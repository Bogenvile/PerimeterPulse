import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { queryOne, query, insertMetrics, insertLocation, insertErrorLogs } from "../../../db/mysql";
import { validateApiKeyByValue } from "../../../lib/auth";

interface HeartbeatBody {
  agent_id: string; api_key: string;
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
    // Sanitize inputs to strictly avoid 'undefined' in SQL parameters
    const m = body.metrics || {};
    const n = body.network_info || {};
    const l = body.location || {};

    if (body.metrics) {
      await insertMetrics(body.agent_id, body.metrics);
      if (body.metrics.error_logs && body.metrics.error_logs.length > 0) {
        await insertErrorLogs(body.agent_id, body.metrics.error_logs);
      }
    }
    if (body.location) await insertLocation(body.agent_id, body.location);

    const asset = await queryOne<{ id: string }>(
      `SELECT id FROM assets WHERE agent_id = ?`, [body.agent_id],
    );

    if (asset) {
      const status = determineStatus(m);
      
      // Extract values safely, ensuring null is used for DB instead of undefined
      const locLat = l.latitude != null ? l.latitude : null;
      const locLng = l.longitude != null ? l.longitude : null;
      const locCity = l.city || null;
      const locCountry = l.country || null;
      
      const diskHealth = m.disk_health_status || null;
      const diskTemp = m.disk_temperature_c != null ? m.disk_temperature_c : null;
      const wifiSsid = n.wifi_ssid || null;
      const wifiSignal = n.wifi_signal_dbm != null ? n.wifi_signal_dbm : null;
      const wifiIp = n.wifi_ip || null;
      const gatewayIp = n.gateway_ip || null;
      const netSpeed = n.network_speed_mbps != null ? n.network_speed_mbps : null;
      const pingLat = m.ping_latency_ms != null ? m.ping_latency_ms : null;
      const errCount = m.error_count != null ? m.error_count : null;
      const ipAddr = n.ip_addresses ? JSON.stringify(n.ip_addresses) : null;

      await query(
        `UPDATE assets SET
          status=?, last_seen_at=NOW(),
          last_location_lat=COALESCE(?, last_location_lat),
          last_location_lng=COALESCE(?, last_location_lng),
          city=COALESCE(NULLIF(?,''), city),
          country=COALESCE(NULLIF(?,''), country),
          disk_health_status=COALESCE(?, disk_health_status),
          disk_temperature_c=COALESCE(?, disk_temperature_c),
          wifi_ssid=COALESCE(NULLIF(?,''), wifi_ssid),
          wifi_signal_dbm=COALESCE(?, wifi_signal_dbm),
          wifi_ip=COALESCE(NULLIF(?,''), wifi_ip),
          gateway_ip=COALESCE(NULLIF(?,''), gateway_ip),
          network_speed_mbps=COALESCE(?, COALESCE(network_speed_mbps, 0)),
          ping_latency_ms=COALESCE(?, COALESCE(ping_latency_ms, 0)),
          error_count=COALESCE(?, COALESCE(error_count, 0)),
          ip_addresses=COALESCE(?, ip_addresses)
         WHERE agent_id=?`,
        [
          status,
          locLat, locLng,
          locCity, locCountry,
          diskHealth, diskTemp,
          wifiSsid, wifiSignal,
          wifiIp, gatewayIp,
          netSpeed,
          pingLat, errCount,
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

function determineStatus(m?: any): "online"|"warning"|"critical" {
  if (!m) return "online";
  if (m.cpu_percent > 98 || m.ram_percent > 98 || m.storage_percent > 99 || m.disk_health_status === "critical") return "critical";
  if (m.cpu_percent > 90 || m.ram_percent > 90 || m.storage_percent > 95 || m.disk_health_status === "warning") return "warning";
  return "online";
}