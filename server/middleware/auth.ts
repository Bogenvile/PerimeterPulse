import { defineHandler } from "nitro";
import { getRequestHeaders, createError } from "nitro/h3";
import { queryOne } from "../db/postgres";
import * as jose from "jose";

// ──── JWT Secret ────
const JWT_SECRET = new TextEncoder().encode(
  process.env.NITRO_JWT_SECRET || "perimeterpulse-jwt-secret-change-in-production",
);

// ──── Token Helpers ────

export function getBearerToken(
  event: Parameters<Parameters<typeof defineHandler>[0]>[0],
): string | null {
  const headers = getRequestHeaders(event);
  const auth = headers["authorization"] || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

// ──── JWT User Auth ────

export interface JwtPayload {
  sub: string; // user id
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
  return new jose.SignJWT({
    username: user.username,
    role: user.role,
  })
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

// ──── User Authentication Middleware ────

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

// ──── API Key Validation (for agents) ────

export async function validateApiKey(
  event: Parameters<Parameters<typeof defineHandler>[0]>[0],
): Promise<boolean> {
  const token = getBearerToken(event);
  if (!token) return false;

  const row = await queryOne<{ id: string; is_active: boolean }>(
    `SELECT id, is_active FROM api_keys
     WHERE key_hash = crypt($1, key_hash) AND is_active = true`,
    [token],
  );

  return !!row;
}

export async function requireApiKey(
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
