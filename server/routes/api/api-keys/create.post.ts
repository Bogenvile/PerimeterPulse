import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { query, queryOne, hashSecret } from "../../../db/mysql";
import { requireAdminAuth } from "../../../middleware/auth";

export default defineHandler(async (event) => {
  const jwt = await requireAdminAuth(event);
  const body = await readBody<{ label?: string }>(event);
  const label = body?.label || `Key ${new Date().toISOString().slice(0, 10)}`;

  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const randomPart = Array.from({ length: 24 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join("");
  const rawKey = `ppulse-sk-${randomPart}`;
  const keyPrefix = rawKey.slice(0, 11);
  const keyHash = hashSecret(rawKey);

  await query(
    `INSERT INTO api_keys (key_prefix, key_hash, label, created_by)
     VALUES (?, ?, ?, ?)`,
    [keyPrefix, keyHash, label, jwt.sub],
  );

  const row = await queryOne<{ id: string }>(
    `SELECT id FROM api_keys WHERE key_prefix = ? ORDER BY created_at DESC LIMIT 1`,
    [keyPrefix],
  );

  return {
    id: row?.id, api_key: rawKey, key_prefix: keyPrefix, label,
    warning: "Store this key securely. It will not be shown again.",
  };
});
