import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { queryOne, query, insertMetrics, insertLocation, insertErrorLogs, ensureV6Schema, columnExists } from "../../../db/mysql";
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

    // Always store metrics & location regardless of asset existence
    await insertMetrics(body.agent_id, safeMetrics);

    if (body.metrics?.error_logs && body.metrics.error_logs.length > 0) {
      await insertErrorLogs(body.agent_id, body.metrics.error_logs);
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

    // Check if asset exists
    let asset = await queryOne<{
      id: string; status: string; hostname: string; last_status_change: string | null;
    }>(
      `SELECT id, status, hostname, last_status_change FROM assets WHERE agent_id = ?`,
      [body.agent_id],
    );

    // ── Asset was deleted or never registered — recreate it ──
    if (!asset) {
      console.log(`[heartbeat] Asset not found for ${body.agent_id}, auto-creating...`);

      const hostname = n.hostname || body.agent_id;
      const os = n.os || "unknown";
      const osVersion = n.os_version || "";
      const ipAddresses = n.ip_addresses ? JSON.stringify(n.ip_addresses) : "[]";
      const macAddresses = n.mac_addresses ? JSON.stringify(n.mac_addresses) : "[]";

      try {
        await query(
          `INSERT INTO assets
            (agent_id, hostname, os, os_version, agent_version,
             mac_addresses, ip_addresses, cpu_model, cpu_cores,
             ram_total_bytes, storage_total_bytes,
             disk_model, disk_type, disk_health_status, disk_temperature_c,
             wifi_ssid, wifi_signal_dbm, network_speed_mbps,
             status, last_seen_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
          [
            body.agent_id,
            hostname,
            os,
            osVersion,
            "unknown",
            macAddresses,
            ipAddresses,
            m.cpu_model || "Unknown",
            m.cpu_cores || 0,
            m.ram_total_bytes || 0,
            m.storage_total_bytes || 0,
            m.disk_model || "",
            m.disk_type || "unknown",
            safeMetrics.disk_health_status,
            safeMetrics.disk_temperature_c,
            n.wifi_ssid || "",
            n.wifi_signal_dbm ?? null,
            n.network_speed_mbps ?? 0,
            "online",
          ],
        );
      } catch (insertErr) {
        // Might fail if columns don't match — try minimal insert
        console.warn("[heartbeat] Full insert failed, trying minimal:", insertErr);
        await query(
          `INSERT INTO assets
            (agent_id, hostname, os, os_version, agent_version,
             mac_addresses, ip_addresses, cpu_model,
             ram_total_bytes, storage_total_bytes,
             disk_type, status, last_seen_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
          [
            body.agent_id,
            hostname,
            os,
            osVersion,
            "unknown",
            macAddresses,
            ipAddresses,
            "Unknown",
            0,
            0,
            "unknown",
            "online",
          ],
        );
      }

      // If we have location data, update it on the newly created asset
      if (validLocation) {
        const locFields = [
          "last_location_lat=?", "last_location_lng=?",
          "city=COALESCE(NULLIF(?, ''), city)",
          "country=COALESCE(NULLIF(?, ''), country)",
        ];
        const locValues: any[] = [
          Number(l.latitude), Number(l.longitude),
          l.city || null, l.country || null,
        ];

        if (await columnExists("assets", "accuracy_meters")) {
          locFields.push("accuracy_meters=?");
          locValues.push(l.accuracy_meters ?? 0);
        }
        if (await columnExists("assets", "location_source")) {
          locFields.push("location_source=COALESCE(NULLIF(?, ''), location_source)");
          locValues.push(l.source || null);
        }

        locValues.push(body.agent_id);
        await query(
          `UPDATE assets SET ${locFields.join(", ")} WHERE agent_id=?`,
          locValues,
        );
      }

      // Update network info
      const netFields: string[] = [];
      const netValues: any[] = [];

      if (n.wifi_ssid) { netFields.push("wifi_ssid=?"); netValues.push(n.wifi_ssid); }
      if (n.wifi_signal_dbm != null) { netFields.push("wifi_signal_dbm=?"); netValues.push(n.wifi_signal_dbm); }
      if (n.network_speed_mbps) { netFields.push("network_speed_mbps=?"); netValues.push(n.network_speed_mbps); }
      if (n.ip_addresses) { netFields.push("ip_addresses=?"); netValues.push(JSON.stringify(n.ip_addresses)); }

      if (await columnExists("assets", "wifi_ip") && n.wifi_ip) {
        netFields.push("wifi_ip=?");
        netValues.push(n.wifi_ip);
      }
      if (await columnExists("assets", "gateway_ip") && n.gateway_ip) {
        netFields.push("gateway_ip=?");
        netValues.push(n.gateway_ip);
      }
      if (await columnExists("assets", "ping_latency_ms")) {
        netFields.push("ping_latency_ms=?");
        netValues.push(m.ping_latency_ms ?? 0);
      }
      if (await columnExists("assets", "error_count")) {
        netFields.push("error_count=?");
        netValues.push(m.error_count ?? 0);
      }

      if (netFields.length > 0) {
        netValues.push(body.agent_id);
        await query(
          `UPDATE assets SET ${netFields.join(", ")} WHERE agent_id=?`,
          netValues,
        );
      }

      console.log(`[heartbeat] ✅ Auto-created asset for ${body.agent_id} (${hostname})`);

      return { ok: true, server_time: new Date().toISOString(), action: "auto_registered" };
    }

    // ── Asset exists — normal update path ──
    const oldStatus = asset.status;
    const newStatus = determineStatus(safeMetrics);

    // Build UPDATE dynamically based on what columns exist
    const updateFields: string[] = ["status=?", "last_seen_at=NOW()"];
    const updateValues: any[] = [newStatus];

    if (validLocation) {
      updateFields.push(
        "last_location_lat=?", "last_location_lng=?",
        "city=COALESCE(NULLIF(?, ''), city)",
        "country=COALESCE(NULLIF(?, ''), country)",
      );
      updateValues.push(
        Number(l.latitude), Number(l.longitude),
        l.city || null, l.country || null,
      );

      if (await columnExists("assets", "accuracy_meters")) {
        updateFields.push("accuracy_meters=?");
        updateValues.push(l.accuracy_meters ?? 0);
      }

      if (await columnExists("assets", "location_source")) {
        updateFields.push("location_source=COALESCE(NULLIF(?, ''), location_source)");
        updateValues.push(l.source || null);
      }
    }

    // Always safe columns
    updateFields.push(
      "disk_health_status=COALESCE(?, disk_health_status)",
      "disk_temperature_c=COALESCE(?, disk_temperature_c)",
      "wifi_ssid=COALESCE(NULLIF(?, ''), wifi_ssid)",
      "wifi_signal_dbm=COALESCE(?, wifi_signal_dbm)",
      "network_speed_mbps=COALESCE(?, COALESCE(network_speed_mbps, 0))",
      "ip_addresses=COALESCE(?, ip_addresses)",
    );
    updateValues.push(
      safeMetrics.disk_health_status, safeMetrics.disk_temperature_c,
      n.wifi_ssid || null, n.wifi_signal_dbm ?? null,
      n.network_speed_mbps ?? null,
      n.ip_addresses ? JSON.stringify(n.ip_addresses) : null,
    );

    // Optional columns
    if (await columnExists("assets", "wifi_ip")) {
      updateFields.push("wifi_ip=COALESCE(NULLIF(?, ''), wifi_ip)");
      updateValues.push(n.wifi_ip || null);
    }

    if (await columnExists("assets", "gateway_ip")) {
      updateFields.push("gateway_ip=COALESCE(NULLIF(?, ''), gateway_ip)");
      updateValues.push(n.gateway_ip || null);
    }

    if (await columnExists("assets", "ping_latency_ms")) {
      updateFields.push("ping_latency_ms=COALESCE(?, COALESCE(ping_latency_ms, 0))");
      updateValues.push(m.ping_latency_ms ?? 0);
    }

    if (await columnExists("assets", "error_count")) {
      updateFields.push("error_count=COALESCE(?, COALESCE(error_count, 0))");
      updateValues.push(m.error_count ?? 0);
    }

    // Track status change
    if (oldStatus !== newStatus && (newStatus === "warning" || newStatus === "critical")) {
      if (await columnExists("assets", "last_status_change")) {
        updateFields.push("last_status_change=NOW()");
      }
    }

    updateValues.push(body.agent_id);
    await query(
      `UPDATE assets SET ${updateFields.join(", ")} WHERE agent_id=?`,
      updateValues,
    );

    // Send notification on status change
    if (oldStatus !== newStatus && (newStatus === "warning" || newStatus === "critical")) {
      notifyStatusChange(asset.hostname || body.agent_id, oldStatus, newStatus, safeMetrics).catch((e) => {
        console.error("Notification failed:", e);
      });
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