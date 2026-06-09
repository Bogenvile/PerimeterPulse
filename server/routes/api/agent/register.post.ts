import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { queryOne, query, parseJsonArray } from "../../../db/mysql";
import { validateApiKeyByValue } from "../../../lib/auth";

interface RegisterBody {
  hostname: string; os: string; os_version: string; agent_version: string;
  api_key: string; mac_addresses: string[]; ip_addresses?: string[];
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

    const fingerprint = body.hostname + (body.mac_addresses || []).join(",");
    const agentId = simpleHash(fingerprint);

    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM assets WHERE agent_id = ?`, [agentId],
    );

    const macsJson = JSON.stringify(body.mac_addresses || []);
    const ipsJson = JSON.stringify(body.ip_addresses || []);

    if (existing) {
      await query(
        `UPDATE assets SET
          hostname=?, os=?, os_version=?, agent_version=?,
          mac_addresses=?, ip_addresses=?, cpu_model=?, cpu_cores=?,
          ram_total_bytes=?, storage_total_bytes=?,
          disk_model=?, disk_type=?,
          wifi_ssid=?, wifi_signal_dbm=?, network_speed_mbps=?
         WHERE agent_id=?`,
        [
          body.hostname, body.os, body.os_version || "", body.agent_version || "1.0.0",
          macsJson, ipsJson, body.cpu_model || "", body.cpu_cores || 0,
          body.ram_total_bytes || 0, body.storage_total_bytes || 0,
          body.disk_model || "", body.disk_type || "unknown",
          body.wifi_ssid || "", body.wifi_signal_dbm ?? null, body.network_speed_mbps || 0,
          agentId,
        ],
      );
    } else {
      await query(
        `INSERT INTO assets
          (agent_id, hostname, os, os_version, agent_version,
           mac_addresses, ip_addresses, cpu_model, cpu_cores,
           ram_total_bytes, storage_total_bytes,
           disk_model, disk_type, wifi_ssid, wifi_signal_dbm, network_speed_mbps, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'offline')`,
        [
          agentId, body.hostname, body.os, body.os_version || "", body.agent_version || "1.0.0",
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