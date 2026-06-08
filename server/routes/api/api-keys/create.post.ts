import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { query, queryOne } from "../../../db/postgres";
import { requireAdminAuth } from "../../../middleware/auth";

function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const randomPart = Array.from({ length: 24 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join("");
  return `ppulse-sk-${randomPart}`;
}

export default defineHandler(async (event) => {
  const jwt = await requireAdminAuth(event);

  const body = await readBody<{ label?: string }>(event);
  const label = body?.label || `Key ${new Date().toISOString().slice(0, 10)}`;

  const rawKey = generateApiKey();
  const keyPrefix = rawKey.slice(0, 11); // "ppulse-sk-x"

  // Store bcrypt hash
  await query(
    `INSERT INTO api_keys (key_prefix, key_hash, label, created_by)
     VALUES ($1, crypt($2, gen_salt('bf')), $3, $4)`,
    [keyPrefix, rawKey, label, jwt.sub],
  );

  // Return the raw key ONCE — it will never be shown again
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM api_keys WHERE key_prefix = $1 ORDER BY created_at DESC LIMIT 1`,
    [keyPrefix],
  );

  return {
    id: row?.id,
    api_key: rawKey,
    key_prefix: keyPrefix,
    label,
    warning: "Store this key securely. It will not be shown again.",
  };
});
