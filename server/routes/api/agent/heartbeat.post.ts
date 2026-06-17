import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { queryOne, query, insertMetrics, insertLocation, insertErrorLogs, ensureV6Schema, columnExists } from "../../../db/mysql";
import { validateApiKeyByValue } from "../../../lib/auth";
import { notifyStatusChange } from "../../../services/notifications";

interface HeartbeatBody {
  agent_id: string;
  api_key: string;
  hostname?: string;
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

/** Check if a hostname looks like an auto-generated placeholder */
function isPlaceholderHostname(hn: string): boolean {
  if (!hn) return true;
  const trimmed = hn.trim();
  if (!trimmed) return true;
  // Matches "Host-abc12345" pattern
  if (/^Host-[a-f0-9]{6,12}$/i.test(trimmed)) return true;
  // Matches "Unknown-..." or generic placeholders
  if (/^(Unknown|Agent|PC)-[a-f0-9-]+$/i.test(trimmed)) return true;
  return false;
}

export default defineHandler(async (event) => {
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

    // Always store metrics regardless of asset status
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

    // ── Step 1: Look up by agent_id ──
    let asset = await queryOne<{
      id: string; agent_id: string; status: string; hostname: string; last_status_change: string | null;
    }>(
      `SELECT id, agent_id, status, hostname, last_status_change FROM assets WHERE agent_id = ?`,
      [body.agent_id],
    );

    // Determine the "real" hostname from the payload (skip placeholders)
    const payloadHostname = body.hostname?.trim();
    const realHostname = (payloadHostname && !isPlaceholderHostname(payloadHostname))
      ? payloadHostname
      : null;

    // ── Step 2: If not found by agent_id, try matching by hostname ──
    if (!asset && realHostname) {
      console.log(`[heartbeat] agent_id ${body.agent_id} not found, trying hostname: "${realHostname}"`);

      const byHostname = await queryOne<{
        id: string; agent_id: string; status: string; hostname: string; last_status_change: string | null;
      }>(
        `SELECT id, agent_id, status, hostname, last_status_change FROM assets WHERE hostname = ? ORDER BY last_seen_at DESC LIMIT 1`,
        [realHostname],
      );

      if (byHostname) {
        const oldAgentId = byHostname.agent_id;
        console.log(`[heartbeat] Hostname match found: "${realHostname}" was ${oldAgentId}, now ${body.agent_id}`);

        // Update agent_id on existing asset
        await query(`UPDATE assets SET agent_id = ? WHERE id = ?`, [body.agent_id, byHostname.id]);

        // Reassign all time-series data
        await query(`UPDATE agent_metrics SET agent_id = ? WHERE agent_id = ?`, [body.agent_id, oldAgentId]);
        await query(`UPDATE agent_locations SET agent_id = ? WHERE agent_id = ?`, [body.agent_id, oldAgentId]);
        await query(`UPDATE agent_error_logs SET agent_id = ? WHERE agent_id = ?`, [body.agent_id, oldAgentId]);
        try { await query(`UPDATE agent_commands SET agent_id = ? WHERE agent_id = ?`, [body.agent_id, oldAgentId]); } catch {}

        asset = { ...byHostname, agent_id: body.agent_id };
      }
    }

    // ── Step 3: Still not found — create new asset ──
    if (!asset) {
      // Use real hostname if available, otherwise use a sensible fallback
      const agentSuffix = body.agent_id.replace(/^agent-/, "").slice(0, 8);
      const hostname = realHostname || `PC-${agentSuffix}`;
      const os = n.os || m.os || "unknown";
      const osVersion = n.os_version || m.os_version || "";

      console.log(`[heartbeat] Auto-creating asset: "${hostname}" (agent_id: ${body.agent_id})`);

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
            body.agent_id, hostname, os, osVersion, "unknown",
            macAddresses, ipAddresses,
            m.cpu_model || "Unknown", m.cpu_cores || 0,
            m.ram_total_bytes || 0, m.storage_total_bytes || 0,
            m.disk_model || "", m.disk_type || "unknown",
            safeMetrics.disk_health_status, safeMetrics.disk_temperature_c,
            n.wifi_ssid || "", n.wifi_signal_dbm ?? null,
            n.network_speed_mbps ?? 0, "online",
          ],
        );
      } catch (insertErr) {
        console.warn("[heartbeat] Full insert failed, trying minimal:", insertErr);
        await query(
          `INSERT INTO assets
            (agent_id, hostname, os, os_version, agent_version,
             mac_addresses, ip_addresses, cpu_model,
             ram_total_bytes, storage_total_bytes,
             disk_type, status, last_seen_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
          [
            body.agent_id, hostname, os, osVersion, "unknown",
            macAddresses, ipAddresses, "Unknown", 0, 0, "unknown", "online",
          ],
        );
      }

      if (validLocation) {
        await updateLocation(body.agent_id, l);
      }
      await updateNetwork(body.agent_id, n, m);

      return { ok: true, server_time: new Date().toISOString(), action: "auto_registered" };
    }

    // ── Asset found — update it ──
    const oldStatus = asset.status;
    const newStatus = determineStatus(safeMetrics);

    const updateFields: string[] = ["status=?", "last_seen_at=NOW()"];
    const updateValues: any[] = [newStatus];

    // Update hostname ONLY if the payload has a real hostname AND the current one is a placeholder
    // or if the real hostname differs from current (and current is not already a real name from another agent)
    if (realHostname && realHostname !== asset.hostname) {
      // Check if current hostname is a placeholder — always allow overwriting placeholders
      const currentIsPlaceholder = isPlaceholderHostname(asset.hostname);

      if (currentIsPlaceholder) {
        // Current hostname is a placeholder (e.g. "Host-xxxxx") — fix it with the real name
        console.log(`[heartbeat] Fixing placeholder hostname: "${asset.hostname}" → "${realHostname}"`);
        updateFields.push("hostname=?");
        updateValues.push(realHostname);
      } else {
        // Current hostname is a real name — only update if no conflict
        const conflict = await queryOne<{ id: string }>(
          `SELECT id FROM assets WHERE hostname = ? AND id != ?`,
          [realHostname, asset.id],
        );
        if (!conflict) {
          console.log(`[heartbeat] Updating hostname for ${body.agent_id}: "${asset.hostname}" → "${realHostname}"`);
          updateFields.push("hostname=?");
          updateValues.push(realHostname);
        }
      }
    }

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

    if (oldStatus !== newStatus && (newStatus === "warning" || newStatus === "critical")) {
      if (await columnExists("assets", "last_status_change")) {
        updateFields.push("last_status_change=NOW()");
      }
    }

    updateValues.push(asset.agent_id);
    await query(
      `UPDATE assets SET ${updateFields.join(", ")} WHERE agent_id=?`,
      updateValues,
    );

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

async function updateLocation(agentId: string, l: any): Promise<void> {
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

  locValues.push(agentId);
  await query(`UPDATE assets SET ${locFields.join(", ")} WHERE agent_id=?`, locValues);
}

async function updateNetwork(agentId: string, n: any, m: any): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  if (n.wifi_ssid) { fields.push("wifi_ssid=?"); values.push(n.wifi_ssid); }
  if (n.wifi_signal_dbm != null) { fields.push("wifi_signal_dbm=?"); values.push(n.wifi_signal_dbm); }
  if (n.network_speed_mbps) { fields.push("network_speed_mbps=?"); values.push(n.network_speed_mbps); }
  if (n.ip_addresses) { fields.push("ip_addresses=?"); values.push(JSON.stringify(n.ip_addresses)); }

  if (await columnExists("assets", "wifi_ip") && n.wifi_ip) {
    fields.push("wifi_ip=?"); values.push(n.wifi_ip);
  }
  if (await columnExists("assets", "gateway_ip") && n.gateway_ip) {
    fields.push("gateway_ip=?"); values.push(n.gateway_ip);
  }
  if (await columnExists("assets", "ping_latency_ms")) {
    fields.push("ping_latency_ms=?"); values.push(m.ping_latency_ms ?? 0);
  }
  if (await columnExists("assets", "error_count")) {
    fields.push("error_count=?"); values.push(m.error_count ?? 0);
  }

  if (fields.length > 0) {
    values.push(agentId);
    await query(`UPDATE assets SET ${fields.join(", ")} WHERE agent_id=?`, values);
  }
}

function determineStatus(m: any): "online" | "warning" | "critical" {
  if (!m) return "online";
  const cpu = m.cpu_percent || 0;
  const ram = m.ram_percent || 0;
  const storage = m.storage_percent || 0;

  if (cpu > 98 || ram > 98 || storage > 99 || m.disk_health_status === "critical") return "critical";
  if (cpu > 90 || ram > 90 || storage > 95 || m.disk_health_status === "warning") return "warning";
  return "online";
}