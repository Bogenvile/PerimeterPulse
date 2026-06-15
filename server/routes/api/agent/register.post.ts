import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { queryOne, query } from "../../../db/mysql";
import { validateApiKeyByValue } from "../../../lib/auth";

interface RegisterBody {
  hostname: string; os: string; os_version: string; agent_version: string;
  api_key: string; mac_addresses: string[]; ip_addresses?: string[];
  agent_id?: string;
  cpu_model: string; cpu_cores?: number;
  ram_total_bytes: number; storage_total_bytes: number;
  disk_model?: string; disk_type?: string;
  wifi_ssid?: string; wifi_signal_dbm?: number; network_speed_mbps?: number;
}

export default defineHandler(async (event) => {
  try {
    const body = await readBody<RegisterBody>(event);
    if (!body?.hostname || !body?.api_key) {
      throw createError({ statusCode: 400, statusMessage: "hostname and api_key required" });
    }

    const keyId = await validateApiKeyByValue(body.api_key);
    if (!keyId) {
      throw createError({ statusCode: 401, statusMessage: "Invalid API key" });
    }

    const hostname = body.hostname.trim();
    const agentId = body.agent_id?.trim() || simpleHash(hostname + (body.mac_addresses || []).join(","));
    const macsJson = JSON.stringify(body.mac_addresses || []);
    const ipsJson = JSON.stringify(body.ip_addresses || []);

    // ── Primary lookup: by hostname ──
    const existing = await queryOne<{ id: string; agent_id: string }>(
      `SELECT id, agent_id FROM assets WHERE hostname = ? ORDER BY last_seen_at DESC LIMIT 1`,
      [hostname],
    );

    if (existing) {
      // Asset exists with this hostname — update it, including the agent_id
      console.log(`[register] Updating existing asset "${hostname}" (${existing.agent_id} → ${agentId})`);

      // Clean up any OTHER duplicates with same hostname (keep the one we're updating)
      const duplicates = await query<{ id: string; agent_id: string }>(
        `SELECT id, agent_id FROM assets WHERE hostname = ? AND id != ?`,
        [hostname, existing.id],
      );
      for (const dup of duplicates) {
        // Reassign metrics/locations/errors to the surviving asset
        await query(`UPDATE agent_metrics SET agent_id = ? WHERE agent_id = ?`, [agentId, dup.agent_id]);
        await query(`UPDATE agent_locations SET agent_id = ? WHERE agent_id = ?`, [agentId, dup.agent_id]);
        await query(`UPDATE agent_error_logs SET agent_id = ? WHERE agent_id = ?`, [agentId, dup.agent_id]);
        try { await query(`UPDATE agent_commands SET agent_id = ? WHERE agent_id = ?`, [agentId, dup.agent_id]); } catch {}
        await query(`DELETE FROM agent_metrics WHERE agent_id = ?`, [dup.agent_id]);
        await query(`DELETE FROM agent_locations WHERE agent_id = ?`, [dup.agent_id]);
        await query(`DELETE FROM agent_error_logs WHERE agent_id = ?`, [dup.agent_id]);
        try { await query(`DELETE FROM agent_commands WHERE agent_id = ?`, [dup.agent_id]); } catch {}
        await query(`DELETE FROM assets WHERE id = ?`, [dup.id]);
        console.log(`[register] Removed duplicate: ${dup.agent_id} (${hostname})`);
      }

      await query(
        `UPDATE assets SET
          agent_id=?, hostname=?, os=?, os_version=?, agent_version=?,
          mac_addresses=?, ip_addresses=?, cpu_model=?, cpu_cores=?,
          ram_total_bytes=?, storage_total_bytes=?,
          disk_model=?, disk_type=?,
          wifi_ssid=?, wifi_signal_dbm=?, network_speed_mbps=?
         WHERE id=?`,
        [
          agentId, hostname, body.os, body.os_version || "", body.agent_version || "1.0.0",
          macsJson, ipsJson, body.cpu_model || "", body.cpu_cores || 0,
          body.ram_total_bytes || 0, body.storage_total_bytes || 0,
          body.disk_model || "", body.disk_type || "unknown",
          body.wifi_ssid || "", body.wifi_signal_dbm ?? null, body.network_speed_mbps || 0,
          existing.id,
        ],
      );
    } else {
      // No asset with this hostname — create new
      console.log(`[register] Creating new asset: "${hostname}" (${agentId})`);
      await query(
        `INSERT INTO assets
          (agent_id, hostname, os, os_version, agent_version,
           mac_addresses, ip_addresses, cpu_model, cpu_cores,
           ram_total_bytes, storage_total_bytes,
           disk_model, disk_type, wifi_ssid, wifi_signal_dbm, network_speed_mbps, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'offline')`,
        [
          agentId, hostname, body.os, body.os_version || "", body.agent_version || "1.0.0",
          macsJson, ipsJson, body.cpu_model || "", body.cpu_cores || 0,
          body.ram_total_bytes || 0, body.storage_total_bytes || 0,
          body.disk_model || "", body.disk_type || "unknown",
          body.wifi_ssid || "", body.wifi_signal_dbm ?? null, body.network_speed_mbps || 0,
        ],
      );
    }

    return { ok: true, agent_id: agentId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Agent register error:", msg, err);
    throw createError({
      statusCode: 500,
      statusMessage: "Internal server error: " + msg,
    });
  }
});

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return "agent-" + Math.abs(hash).toString(16).padStart(8, "0");
}