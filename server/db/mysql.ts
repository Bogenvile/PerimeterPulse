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

export function hashSecret(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifySecret(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

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

export function parseTagsArray(val: unknown): string[] {
  return parseJsonArray(val);
}

export function tagsToJson(tags: string[]): string {
  return JSON.stringify(tags.filter((t) => t.trim().length > 0));
}

// ──── Safe column migration helper ────

async function safeAddColumn(
  table: string,
  column: string,
  definition: string,
): Promise<boolean> {
  const exists = await columnExists(table, column);
  if (exists) return true;

  try {
    await query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[migration] ✅ Added column ${table}.${column}`);
    return true;
  } catch (err: unknown) {
    const errno = typeof err === "object" && err !== null && "errno" in err
      ? (err as { errno: number }).errno
      : null;
    const code = typeof err === "object" && err !== null && "code" in err
      ? (err as { code: string }).code
      : null;

    if (errno === 1060 || code === "ER_DUP_FIELDNAME") return true;

    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[migration] ❌ FAILED to add ${table}.${column}: ${msg}`);
    return false;
  }
}

export async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    const rows = await query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return (rows[0]?.cnt ?? 0) > 0;
  } catch {
    return false;
  }
}

async function tableExists(table: string): Promise<boolean> {
  try {
    const rows = await query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    return (rows[0]?.cnt ?? 0) > 0;
  } catch {
    return false;
  }
}

// ──── Auto-migration v6 ────

let v6Done = false;

export async function ensureV6Schema(): Promise<void> {
  if (v6Done) return;

  console.log("[migration] Running v6 schema check...");

  const results: boolean[] = [];

  results.push(await safeAddColumn("assets", "tags", "JSON DEFAULT ('[]')"));

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        \`key\` VARCHAR(255) NOT NULL,
        \`value\` TEXT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (err) {
    console.error("[migration] ❌ Failed to create app_settings:", err);
    results.push(false);
  }

  results.push(await safeAddColumn("assets", "last_status_change", "DATETIME DEFAULT NULL"));
  results.push(await safeAddColumn("assets", "accuracy_meters", "DOUBLE NOT NULL DEFAULT 0"));
  results.push(await safeAddColumn("assets", "location_source", "VARCHAR(32) NOT NULL DEFAULT 'unknown'"));
  results.push(await safeAddColumn("assets", "wifi_ip", "VARCHAR(45) DEFAULT ''"));
  results.push(await safeAddColumn("assets", "gateway_ip", "VARCHAR(45) DEFAULT ''"));
  results.push(await safeAddColumn("assets", "ping_latency_ms", "DOUBLE DEFAULT 0"));
  results.push(await safeAddColumn("assets", "error_count", "INT DEFAULT 0"));

  results.push(await safeAddColumn("assets", "disk_health_percent", "DECIMAL(5,2) DEFAULT NULL"));
  results.push(await safeAddColumn("agent_metrics", "disk_health_percent", "DECIMAL(5,2) DEFAULT NULL"));

  results.push(await safeAddColumn("agent_locations", "accuracy_meters", "DOUBLE NOT NULL DEFAULT 0"));
  results.push(await safeAddColumn("agent_locations", "source", "VARCHAR(32) NOT NULL DEFAULT 'unknown'"));

  results.push(await safeAddColumn("agent_metrics", "ping_latency_ms", "DOUBLE DEFAULT NULL"));
  results.push(await safeAddColumn("agent_metrics", "error_count", "INT DEFAULT NULL"));
  results.push(await safeAddColumn("agent_metrics", "disk_health_status", "VARCHAR(32) DEFAULT NULL"));
  results.push(await safeAddColumn("agent_metrics", "disk_temperature_c", "DOUBLE DEFAULT NULL"));
  results.push(await safeAddColumn("agent_metrics", "gateway_reachable", "TINYINT(1) DEFAULT NULL"));
  results.push(await safeAddColumn("agent_metrics", "dns_working", "TINYINT(1) DEFAULT NULL"));
  results.push(await safeAddColumn("agent_metrics", "internet_reachable", "TINYINT(1) DEFAULT NULL"));
  results.push(await safeAddColumn("agent_metrics", "default_gateway", "VARCHAR(45) DEFAULT NULL"));

  if (results.every((r) => r)) {
    v6Done = true;
    console.log("[migration] ✅ v6 schema check complete");
  } else {
    console.error("[migration] ⚠️ Some migrations failed — will retry on next request");
  }
}

// ──── App Settings ────

export async function getSetting(key: string): Promise<string | null> {
  const row = await queryOne<{ value: string }>(
    `SELECT value FROM app_settings WHERE \`key\` = ?`,
    [key],
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO app_settings (\`key\`, \`value\`) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
    [key, value],
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await query<{ key: string; value: string }>(
    `SELECT \`key\`, \`value\` FROM app_settings`,
  );
  const settings: Record<string, string> = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  return settings;
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
  disk_health_percent?: number;
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
        disk_health_status, disk_health_percent, disk_temperature_c, recorded_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
     [
       agentId,
       m.cpu_percent, m.ram_percent, m.ram_used_bytes, m.ram_total_bytes,
       m.storage_percent, m.storage_used_bytes, m.storage_total_bytes,
       m.uptime_seconds, m.network_status, m.network_latency_ms,
       m.ping_latency_ms ?? null, m.error_count ?? null,
       m.gateway_reachable ?? null, m.dns_working ?? null, m.internet_reachable ?? null,
       m.default_gateway ?? null,
       m.disk_health_status ?? null, m.disk_health_percent ?? null, m.disk_temperature_c ?? null,
      m.timestamp ? new Date(m.timestamp) : new Date(),
    ],
  );
}

export async function queryMetrics(
  agentId: string,
  hours: number,
): Promise<Record<string, unknown>[]> {
  const safeHours = Math.min(Math.max(parseInt(String(hours), 10) || 24, 1), 720);
  const rows = await query<Record<string, unknown>>(
    `SELECT
       recorded_at AS time,
       cpu_percent, ram_percent, storage_percent,
      network_status, network_latency_ms, ping_latency_ms, error_count,
        disk_health_status, disk_health_percent, disk_temperature_c
     FROM agent_metrics
     WHERE agent_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL ${safeHours} HOUR)
     ORDER BY recorded_at ASC`,
    [agentId],
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
  const safeHours = Math.min(Math.max(parseInt(String(hours), 10) || 24, 1), 720);
  const rows = await query<Record<string, unknown>>(
    `SELECT
       recorded_at AS time,
       latitude, longitude, accuracy_meters, source
     FROM agent_locations
     WHERE agent_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL ${safeHours} HOUR)
     ORDER BY recorded_at ASC`,
    [agentId],
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
  const safeLimit = Math.min(Math.max(parseInt(String(limit), 10) || 100, 1), 1000);
  const rows = await query<Record<string, unknown>>(
    `SELECT
       id, error_time AS time, error_id AS event_id,
       error_level AS level, error_source AS source, error_message AS message,
       created_at
     FROM agent_error_logs
     WHERE agent_id = ?
     ORDER BY error_time DESC
     LIMIT ${safeLimit}`,
    [agentId],
  );
  return rows.map((r) => ({
    ...r,
    time: r.time instanceof Date ? r.time.toISOString() : r.time,
  }));
}

export async function ensureErrorLogsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS agent_error_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      agent_id VARCHAR(64) NOT NULL,
      error_time DATETIME NOT NULL,
      error_id INT UNSIGNED NOT NULL DEFAULT 0,
      error_level VARCHAR(32) NOT NULL DEFAULT 'Error',
      error_source VARCHAR(255) NOT NULL DEFAULT '',
      error_message TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_agent_error_logs_agent_id (agent_id),
      INDEX idx_agent_error_logs_time (agent_id, error_time DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

// ──── AI Context — compatible with MySQL 8.0 ────

export async function getAssetSummaryContext(): Promise<string> {
  try {
    // Use subquery approach compatible with MySQL 8.0 (no LATERAL JOIN)
    const assets = await query(`
      SELECT
        a.agent_id, a.hostname, a.os, a.status, a.last_seen_at,
        a.cpu_model, a.cpu_cores,
        a.ram_total_bytes, a.storage_total_bytes,
        a.disk_health_status, a.disk_temperature_c,
        a.wifi_ssid, a.network_speed_mbps,
        a.ping_latency_ms, a.error_count
      FROM assets a
      ORDER BY a.hostname
    `);

    if (assets.length === 0) return "No assets registered.";

    let summary = `Total Assets: ${assets.length}\n\n`;
    for (const a of assets) {
      summary += `- ${a.hostname} (${a.os}) | Status: ${a.status}`;
      if (a.disk_health_status && a.disk_health_status !== "ok")
        summary += ` | Disk: ${a.disk_health_status}`;
      summary += `\n`;
    }
    return summary;
  } catch (err) {
    console.error("[AI] getAssetSummaryContext failed:", err);
    return "Asset data temporarily unavailable.";
  }
}