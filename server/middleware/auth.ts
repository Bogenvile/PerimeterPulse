import { defineHandler } from "nitro";
import { getRequestHeaders, createError } from "nitro/h3";
import { queryOne } from "../../db/postgres";

export function getBearerToken(event: Parameters<Parameters<typeof defineHandler>[0]>[0]): string | null {
  const headers = getRequestHeaders(event);
  const auth = headers["authorization"] || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export async function validateApiKey(
  event: Parameters<Parameters<typeof defineHandler>[0]>[0],
): Promise<boolean> {
  // For heartbeat endpoints, the API key is in the body
  // For other endpoints, it's in the Authorization header
  const token = getBearerToken(event);
  if (!token) return false;

  // Check against stored API keys (using a simple constant-time-resistant approach)
  const row = await queryOne<{ id: string; is_active: boolean }>(
    `SELECT id, is_active FROM api_keys
     WHERE key_hash = crypt($1, key_hash) AND is_active = true`,
    [token],
  );

  return !!row;
}

export async function requireAuth(
  event: Parameters<Parameters<typeof defineHandler>[0]>[0],
): Promise<void> {
  const valid = await validateApiKey(event);
  if (!valid) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized — invalid or missing API key",
    });
  }
}
