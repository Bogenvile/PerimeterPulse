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
  cpu_model: string;
  ram_total_bytes: number;
  storage_total_bytes: number;
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

  // Generate a deterministic agent_id from hostname + mac addresses
  const fingerprint = body.hostname + (body.mac_addresses || []).join(",");
  const agentId = simpleHash(fingerprint);

  // Upsert the asset
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM assets WHERE agent_id = $1`,
    [agentId],
  );

  if (existing) {
    await query(
      `UPDATE assets SET
        hostname = $2, os = $3, os_version = $4, agent_version = $5,
        mac_addresses = $6, cpu_model = $7,
        ram_total_bytes = $8, storage_total_bytes = $9
       WHERE agent_id = $1`,
      [
        agentId,
        body.hostname,
        body.os,
        body.os_version || "",
        body.agent_version || "1.0.0",
        body.mac_addresses || [],
        body.cpu_model || "",
        body.ram_total_bytes || 0,
        body.storage_total_bytes || 0,
      ],
    );
  } else {
    await query(
      `INSERT INTO assets
        (agent_id, hostname, os, os_version, agent_version, mac_addresses,
         cpu_model, ram_total_bytes, storage_total_bytes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'offline')`,
      [
        agentId,
        body.hostname,
        body.os,
        body.os_version || "",
        body.agent_version || "1.0.0",
        body.mac_addresses || [],
        body.cpu_model || "",
        body.ram_total_bytes || 0,
        body.storage_total_bytes || 0,
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
