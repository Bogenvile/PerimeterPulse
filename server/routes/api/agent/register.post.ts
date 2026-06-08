import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { queryOne, query } from "../../../db/postgres";

interface RegisterBody {
  hostname: string;
  os: string;
  os_version: string;
  agent_version: string;
  api_key: string;
  mac_addresses: string[];
  ip_addresses?: string[];
  cpu_model: string;
  cpu_cores?: number;
  ram_total_bytes: number;
  storage_total_bytes: number;
  disk_model?: string;
  disk_type?: string;
  wifi_ssid?: string;
  wifi_signal_dbm?: number;
  network_speed_mbps?: number;
}

export default defineHandler(async (event) => {
  const body = await readBody<RegisterBody>(event);

  if (!body?.hostname || !body?.api_key) {
    throw createError({ statusCode: 400, statusMessage: "hostname and api_key required" });
  }

  // Validate API key
  const keyRow = await queryOne<{ id: string }>(
    `SELECT id FROM api_keys WHERE key_hash = crypt($1, key_hash) AND is_active = true`,
    [body.api_key],
  );

  if (!keyRow) {
    throw createError({ statusCode: 401, statusMessage: "Invalid API key" });
  }

  // Update last_used_at
  await query(`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, [keyRow.id]);

  // Generate deterministic agent_id
  const fingerprint = body.hostname + (body.mac_addresses || []).join(",");
  const agentId = simpleHash(fingerprint);

  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM assets WHERE agent_id = $1`,
    [agentId],
  );

  if (existing) {
    await query(
      `UPDATE assets SET
        hostname = $2, os = $3, os_version = $4, agent_version = $5,
        mac_addresses = $6, ip_addresses = $7, cpu_model = $8, cpu_cores = $9,
        ram_total_bytes = $10, storage_total_bytes = $11,
        disk_model = $12, disk_type = $13,
        wifi_ssid = $14, wifi_signal_dbm = $15, network_speed_mbps = $16
       WHERE agent_id = $1`,
      [
        agentId,
        body.hostname,
        body.os,
        body.os_version || "",
        body.agent_version || "1.0.0",
        body.mac_addresses || [],
        body.ip_addresses || [],
        body.cpu_model || "",
        body.cpu_cores || 0,
        body.ram_total_bytes || 0,
        body.storage_total_bytes || 0,
        body.disk_model || "",
        body.disk_type || "unknown",
        body.wifi_ssid || "",
        body.wifi_signal_dbm ?? null,
        body.network_speed_mbps || 0,
      ],
    );
  } else {
    await query(
      `INSERT INTO assets
        (agent_id, hostname, os, os_version, agent_version,
         mac_addresses, ip_addresses, cpu_model, cpu_cores,
         ram_total_bytes, storage_total_bytes,
         disk_model, disk_type, wifi_ssid, wifi_signal_dbm, network_speed_mbps, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'offline')`,
      [
        agentId,
        body.hostname,
        body.os,
        body.os_version || "",
        body.agent_version || "1.0.0",
        body.mac_addresses || [],
        body.ip_addresses || [],
        body.cpu_model || "",
        body.cpu_cores || 0,
        body.ram_total_bytes || 0,
        body.storage_total_bytes || 0,
        body.disk_model || "",
        body.disk_type || "unknown",
        body.wifi_ssid || "",
        body.wifi_signal_dbm ?? null,
        body.network_speed_mbps || 0,
      ],
    );
  }

  return { ok: true, agent_id: agentId };
});

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return "agent-" + Math.abs(hash).toString(16).padStart(8, "0");
}
