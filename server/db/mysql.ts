import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL || "";
    if (url) {
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

// ──── Time-Series: Agent Metrics ────

interface MetricsInput {
  cpu_percent: number;
  ram_percent: number;
  ram_used_bytes: number;
  ram_total_bytes: number;
  storage_percent: number;
  storage_used_bytes: number;
  storage_total_bytes: number;
  uptime_seconds: number;
  network_status: string;
  network_latency_ms: number;
  ping_latency_ms?: number;
  error_count?: number;
  gateway_reachable?: boolean;
  dns_working?: boolean;
  internet_reachable?: boolean;
  default_gateway?: string;
  disk_health_status?: string;
  disk_temperature_c?: number;
  timestamp: string;
}

export async function insertMetrics(agentId: string, m: MetricsInput): Promise<void> {
  await query(
    `INSERT INTO agent_metrics
      (agent_id, cpu_percent, ram_percent, ram_used_bytes, ram_total_bytes,
       storage_percent, storage_used_bytes, storage_total_bytes,
       uptime_seconds, network_status, network_latency_ms,
       ping_latency_ms, error_count,
       gateway_reachable, dns_working, internet_reachable, default_gateway,
       disk_health_status, disk_temperature_c, recorded_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      agentId,
      m.cpu_percent, m.ram_percent, m.ram_used_bytes, m.ram_total_bytes,
      m.storage_percent, m.storage_used_bytes, m.storage_total_bytes,
      m.uptime_seconds, m.network_status, m.network_latency_ms,
      m.ping_latency_ms ?? null, m.error_count ?? null,
      m.gateway_reachable ?? null, m.dns_working ?? null, m.internet_reachable ?? null,
      m.default_gateway ?? null,
      m.disk_health_status ?? null, m.disk_temperature_c ?? null,
      m.timestamp ? new Date(m.timestamp) : new Date(),
    ],
  );
}

export async function queryMetrics(
  agentId: string,
  hours: number,
): Promise<Record<string, unknown>[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT
       recorded_at AS time,
       cpu_percent, ram_percent, storage_percent,
       network_status, network_latency_ms, ping_latency_ms, error_count,
       disk_health_status, disk_temperature_c
     FROM agent_metrics
     WHERE agent_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     ORDER BY recorded_at ASC`,
    [agentId, hours],
  );
  return rows.map((r) => ({
    ...r,
    time: r.time instanceof Date ? r.time.toISOString() : r.time,
  }));
}

// ──── Time-Series: Agent Location ────

interface LocationInput {
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  source: string;
  timestamp: string;
}

export async function insertLocation(agentId: string, loc: LocationInput): Promise<void> {
  await query(
    `INSERT INTO agent_locations
      (agent_id, latitude, longitude, accuracy_meters, source, recorded_at)
     VALUES (?,?,?,?,?,?)`,
    [
      agentId,
      loc.latitude, loc.longitude, loc.accuracy_meters, loc.source,
      loc.timestamp ? new Date(loc.timestamp) : new Date(),
    ],
  );
}

export async function queryLocations(
  agentId: string,
  hours: number,
): Promise<Record<string, unknown>[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT
       recorded_at AS time,
       latitude, longitude, accuracy_meters, source
     FROM agent_locations
     WHERE agent_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     ORDER BY recorded_at ASC`,
    [agentId, hours],
  );
  return rows.map((r) => ({
    ...r,
    time: r.time instanceof Date ? r.time.toISOString() : r.time,
  }));
}

// ──── Agent Error Logs ────

interface ErrorLogInput {
  time: string;
  id: number;
  level: string;
  source: string;
  message: string;
}

export async function insertErrorLogs(agentId: string, logs: ErrorLogInput[]): Promise<void> {
  if (logs.length === 0) return;

  const values = logs.map(() => "(?,?,?,?,?,?)").join(",");
  const params: unknown[] = [];
  for (const log of logs) {
    params.push(
      agentId,
      log.time ? new Date(log.time) : new Date(),
      log.id ?? 0,
      log.level ?? "Error",
      log.source ?? "",
      log.message ?? "",
    );
  }

  await query(
    `INSERT INTO agent_error_logs
      (agent_id, error_time, error_id, error_level, error_source, error_message)
     VALUES ${values}`,
    params,
  );
}

export async function queryErrorLogs(
  agentId: string,
  limit = 100,
): Promise<Record<string, unknown>[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT
       id, error_time AS time, error_id AS event_id,
       error_level AS level, error_source AS source, error_message AS message,
       created_at
     FROM agent_error_logs
     WHERE agent_id = ?
     ORDER BY error_time DESC
     LIMIT ?`,
    [agentId, limit],
  );
  return rows.map((r) => ({
    ...r,
    time: r.time instanceof Date ? r.time.toISOString() : r.time,
  }));
}
