import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL || "";
    if (url) {
      // Parse mysql://user:pass@host:port/db format
      const parsed = new URL(url);
      pool = mysql.createPool({
        host: parsed.hostname || "localhost",
        port: parseInt(parsed.port || "3306"),
        user: parsed.username || "perimeterpulse",
        password: parsed.password || "perimeterpulse",
        database: parsed.pathname.replace("/", "") || "perimeterpulse",
        waitForConnections: true,
        connectionLimit: 10,
        timezone: "+00:00",
      });
    } else {
      pool = mysql.createPool({
        host: process.env.MYSQL_HOST || "localhost",
        port: parseInt(process.env.MYSQL_PORT || "3306"),
        user: process.env.MYSQL_USER || "perimeterpulse",
        password: process.env.MYSQL_PASSWORD || "perimeterpulse",
        database: process.env.MYSQL_DATABASE || "perimeterpulse",
        waitForConnections: true,
        connectionLimit: 10,
        timezone: "+00:00",
      });
    }
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// ──── Password / API Key hashing (bcrypt) ────

export function hashSecret(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifySecret(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

// ──── JSON helpers for array columns ────

export function parseJsonArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val as string[];
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
