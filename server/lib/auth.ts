import { defineHandler } from "nitro";
import { getRequestHeaders, createError } from "nitro/h3";
import { queryOne, verifySecret } from "../db/mysql";
import * as jose from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NITRO_JWT_SECRET || "perimeterpulse-jwt-secret-change-in-production",
);

export function getBearerToken(
  event: Parameters<Parameters<typeof defineHandler>[0]>[0],
): string | null {
  const headers = getRequestHeaders(event);
  const auth = headers["authorization"] || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export interface JwtPayload {
  sub: string;
  username: string;
  role: "admin" | "viewer";
  iat: number;
  exp: number;
}

export async function signJwt(user: {
  id: string;
  username: string;
  role: "admin" | "viewer";
}): Promise<string> {
  return new jose.SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export async function requireUserAuth(
  event: Parameters<Parameters<typeof defineHandler>[0]>[0],
): Promise<JwtPayload> {
  const token = getBearerToken(event);
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: "Missing authorization token" });
  }
  const payload = await verifyJwt(token);
  if (!payload) {
    throw createError({ statusCode: 401, statusMessage: "Invalid or expired token" });
  }
  return payload;
}

export async function requireAdminAuth(
  event: Parameters<Parameters<typeof defineHandler>[0]>[0],
): Promise<JwtPayload> {
  const payload = await requireUserAuth(event);
  if (payload.role !== "admin") {
    throw createError({ statusCode: 403, statusMessage: "Admin access required" });
  }
  return payload;
}

// ──── API Key validation using bcrypt ────

export async function validateApiKeyByValue(rawKey: string): Promise<string | null> {
  // Fetch all active API key hashes and compare with bcrypt
  const rows = await queryOne<{ id: string; key_hash: string }[]>(
    `SELECT id, key_hash FROM api_keys WHERE is_active = 1`,
  );
  // Actually we need all rows, not just one
  const { query } = await import("../db/mysql");
  const allKeys = await query<{ id: string; key_hash: string }>(
    `SELECT id, key_hash FROM api_keys WHERE is_active = 1`,
  );
  for (const row of allKeys) {
    if (verifySecret(rawKey, row.key_hash)) {
      // Update last_used_at
      await query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = ?`, [row.id]);
      return row.id;
    }
  }
  return null;
}
