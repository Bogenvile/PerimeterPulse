import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { queryOne, query, insertMetrics, insertLocation, insertErrorLogs, ensureV6Schema } from "../../../db/mysql";
import { validateApiKeyByValue } from "../../../lib/auth";
import { notifyStatusChange } from "../../../services/notifications";

interface HeartbeatBody {
  agent_id: string;
  api_key: string;
  metrics?: any;
  location?: any;
  network_info?: any;
}

function isValidLatitude(lat: number): boolean {
  return typeof lat === "number" && !isNaN(lat) && lat >= -90 && lat <= 90 && lat !== 0;
}

function isValidLongitude(lng: number): boolean {
  return typeof lng === "number" && !isNaN(lng) && lng >= -180 && lng <= 180 && lng !== 0;
}

function isValidLocation(loc: any): boolean {
  if (!loc) return false;
  return isValidLatitude(loc.latitude) && isValidLongitude(loc.longitude);
}

export default defineHandler(async (event) => {
  // Auto-migration v6
  await ensureV6Schema();

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
      ping_latency_ms: m.ping_latency_ms ?? 0,
      error_count: m.error_count ?? 0,
      gateway_reachable: m.gateway_reachable != null ? !!m.gateway_reachable : null,
      dns_working: m.dns_working != null ? !!m.dns_working : null,
      internet_reachable: m.internet_reachable != null ? !!m.internet_reachable : null,
      default_gateway: m.default_gateway || null,
      disk_health_status: m.disk_health_status || "unknown",
      disk_temperature_c: m.disk_temperature_c != null ? Number(m.disk_temperature_c) : 0,
      timestamp: m.timestamp || new Date().toISOString(),
    };

    if (body.metrics) {
      await insertMetrics(body.agent_id, safeMetrics);
      if (body.metrics.error_logs && body.metrics.error_logs.length > 0) {
        await insertErrorLogs(body.agent_id, body.metrics.error_logs);
      }
    }

    const validLocation = isValidLocation(l);
    if (validLocation) {
      await insertLocation(body.agent_id, {
        latitude: Number(l.latitude),
        longitude: Number(l.longitude),
        accuracy_meters: l.accuracy_meters ?? 0,
        source: l.source || "unknown",
        timestamp: l.timestamp || new Date().toISOString(),
      });
    }

    const asset = await queryOne<{
      id: string; status: string; hostname: string; last_status_change: string | null;
    }>(
      `SELECT id, status, hostname, last_status_change FROM assets WHERE agent_id = ?`,
      [body.agent_id],
    );

    if (asset) {
      const oldStatus = asset.status;
      const newStatus = determineStatus(safeMetrics);

      const updateFields: string[] = ["status=?", "last_seen_at=NOW()"];
      const updateValues: any[] = [newStatus];

      if (validLocation) {
        updateFields.push(
          "last_location_lat=?", "last_location_lng=?",
          "accuracy_meters=COALESCE(?, accuracy_meters)",
          "location_source=COALESCE(NULLIF(?,''), location_source)",
          "city=COALESCE(NULLIF(?, ''), city)",
          "country=COALESCE(NULLIF(?, ''), country)",
        );
        updateValues.push(
          Number(l.latitude), Number(l.longitude),
          l.accuracy_meters ?? 0, l.source || null,
          l.city || null, l.country || null,
        );
      }

      updateFields.push(
        "disk_health_status=COALESCE(?, disk_health_status)",
        "disk_temperature_c=COALESCE(?, disk_temperature_c)",
        "wifi_ssid=COALESCE(NULLIF(?, ''), wifi_ssid)",
        "wifi_signal_dbm=COALESCE(?, wifi_signal_dbm)",
        "wifi_ip=COALESCE(NULLIF(?, ''), wifi_ip)",
        "gateway_ip=COALESCE(NULLIF(?, ''), gateway_ip)",
        "network_speed_mbps=COALESCE(?, COALESCE(network_speed_mbps, 0))",
        "ping_latency_ms=COALESCE(?, COALESCE(ping_latency_ms, 0))",
        "error_count=COALESCE(?, COALESCE(error_count, 0))",
        "ip_addresses=COALESCE(?, ip_addresses)",
      );
      updateValues.push(
        safeMetrics.disk_health_status, safeMetrics.disk_temperature_c,
        n.wifi_ssid || null, n.wifi_signal_dbm ?? null,
        n.wifi_ip || null, n.gateway_ip || null,
        n.network_speed_mbps ?? null,
        m.ping_latency_ms ?? 0, m.error_count ?? 0,
        n.ip_addresses ? JSON.stringify(n.ip_addresses) : null,
      );

      // Track status change
      if (oldStatus !== newStatus && (newStatus === "warning" || newStatus === "critical")) {
        updateFields.push("last_status_change=NOW()");
      }

      updateValues.push(body.agent_id);
      await query(
        `UPDATE assets SET ${updateFields.join(", ")} WHERE agent_id=?`,
        updateValues,
      );

      // Send notification on status change to warning/critical
      if (oldStatus !== newStatus && (newStatus === "warning" || newStatus === "critical")) {
        notifyStatusChange(asset.hostname || body.agent_id, oldStatus, newStatus, safeMetrics).catch((e) => {
          console.error("Notification failed:", e);
        });
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Heartbeat DB Error:", msg, err);
    throw createError({ statusCode: 500, statusMessage: "Database error: " + msg });
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