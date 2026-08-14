import { query, queryOne, hashSecret, columnExists } from "./mysql";

export interface InitStep {
  name: string;
  status: "ok" | "skipped" | "error";
  detail?: string;
}

export interface InitReport {
  ok: boolean;
  steps: InitStep[];
  seeded_users: string[];
  api_key?: string;
  message: string;
}

export interface DbStatus {
  ok: boolean;
  initialized: boolean;
  missing_tables: string[];
  error?: string;
}

export const REQUIRED_TABLES = [
  "users",
  "api_keys",
  "assets",
  "agent_metrics",
  "agent_locations",
  "agent_error_logs",
  "agent_commands",
  "app_settings",
] as const;

const BASE_TABLES: Array<[string, string]> = [
  [
    "users",
    `CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
      username VARCHAR(64) NOT NULL UNIQUE,
      display_name VARCHAR(128) NOT NULL DEFAULT '',
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'viewer') NOT NULL DEFAULT 'viewer',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME NULL,
      INDEX idx_username (username),
      INDEX idx_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ],
  [
    "api_keys",
    `CREATE TABLE IF NOT EXISTS api_keys (
      id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
      key_prefix VARCHAR(11) NOT NULL,
      key_hash VARCHAR(255) NOT NULL,
      label VARCHAR(128) NOT NULL DEFAULT '',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME NULL,
      created_by CHAR(36) NULL,
      INDEX idx_prefix (key_prefix),
      INDEX idx_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ],
  [
    "assets",
    `CREATE TABLE IF NOT EXISTS assets (
      id CHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
      agent_id VARCHAR(64) NOT NULL UNIQUE,
      hostname VARCHAR(255) NOT NULL,
      os VARCHAR(128) NOT NULL DEFAULT '',
      os_version VARCHAR(64) NOT NULL DEFAULT '',
      agent_version VARCHAR(32) NOT NULL DEFAULT '',
      mac_addresses JSON NOT NULL,
      ip_addresses JSON NOT NULL,
      cpu_model VARCHAR(255) NOT NULL DEFAULT '',
      cpu_cores INT UNSIGNED NOT NULL DEFAULT 0,
      ram_total_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      storage_total_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      disk_model VARCHAR(255) NOT NULL DEFAULT '',
      disk_type VARCHAR(32) NOT NULL DEFAULT 'unknown',
      disk_health_status VARCHAR(32) NOT NULL DEFAULT 'ok',
      disk_temperature_c DECIMAL(6,2) NULL,
      wifi_ssid VARCHAR(255) NOT NULL DEFAULT '',
      wifi_signal_dbm SMALLINT NULL,
      network_speed_mbps INT UNSIGNED NOT NULL DEFAULT 0,
      status ENUM('online','offline','warning','critical') NOT NULL DEFAULT 'offline',
      last_seen_at DATETIME NULL,
      last_location_lat DECIMAL(10,7) NULL,
      last_location_lng DECIMAL(10,7) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_hostname (hostname),
      INDEX idx_last_seen (last_seen_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ],
  [
    "agent_metrics",
    `CREATE TABLE IF NOT EXISTS agent_metrics (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      agent_id VARCHAR(64) NOT NULL,
      cpu_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      ram_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      ram_used_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      ram_total_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      storage_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      storage_used_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      storage_total_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      uptime_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
      network_status VARCHAR(32) NOT NULL DEFAULT 'up',
      network_latency_ms DECIMAL(10,2) NOT NULL DEFAULT 0,
      recorded_at DATETIME(3) NOT NULL,
      INDEX idx_agent_time (agent_id, recorded_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ],
  [
    "agent_locations",
    `CREATE TABLE IF NOT EXISTS agent_locations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      agent_id VARCHAR(64) NOT NULL,
      latitude DECIMAL(10,7) NOT NULL,
      longitude DECIMAL(10,7) NOT NULL,
      accuracy_meters INT UNSIGNED NOT NULL DEFAULT 0,
      source VARCHAR(16) NOT NULL DEFAULT 'geoip',
      recorded_at DATETIME(3) NOT NULL,
      INDEX idx_agent_time (agent_id, recorded_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ],
];

const AUX_TABLES: Array<[string, string]> = [
  [
    "agent_error_logs",
    `CREATE TABLE IF NOT EXISTS agent_error_logs (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    "agent_commands",
    `CREATE TABLE IF NOT EXISTS agent_commands (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      agent_id VARCHAR(64) NOT NULL,
      command TEXT NOT NULL,
      status ENUM('pending', 'running', 'completed', 'failed', 'timeout') NOT NULL DEFAULT 'pending',
      output MEDIUMTEXT DEFAULT NULL,
      error TEXT DEFAULT NULL,
      exit_code INT DEFAULT NULL,
      created_by VARCHAR(64) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME DEFAULT NULL,
      completed_at DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      INDEX idx_agent_commands_agent_id (agent_id),
      INDEX idx_agent_commands_status (agent_id, status),
      INDEX idx_agent_commands_created (agent_id, created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
  [
    "app_settings",
    `CREATE TABLE IF NOT EXISTS app_settings (
      \`key\` VARCHAR(255) NOT NULL,
      \`value\` TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`key\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ],
];

// Migrations v2 + v6 — safe (skips columns that already exist, never drops data)
const ADD_COLUMNS: Array<[string, string, string]> = [
  ["assets", "tags", "JSON DEFAULT ('[]')"],
  ["assets", "last_status_change", "DATETIME DEFAULT NULL"],
  ["assets", "accuracy_meters", "DOUBLE NOT NULL DEFAULT 0"],
  ["assets", "location_source", "VARCHAR(32) NOT NULL DEFAULT 'unknown'"],
  ["assets", "wifi_ip", "VARCHAR(45) DEFAULT ''"],
  ["assets", "gateway_ip", "VARCHAR(45) DEFAULT ''"],
  ["assets", "ping_latency_ms", "DOUBLE DEFAULT 0"],
  ["assets", "error_count", "INT DEFAULT 0"],
  ["assets", "city", "VARCHAR(128) NOT NULL DEFAULT ''"],
  ["assets", "country", "VARCHAR(128) NOT NULL DEFAULT ''"],
  ["assets", "disk_health_percent", "DECIMAL(5,2) DEFAULT NULL"],
  ["assets", "process_list", "JSON DEFAULT ('[]')"],
  ["agent_metrics", "disk_health_percent", "DECIMAL(5,2) DEFAULT NULL"],
  ["agent_metrics", "ping_latency_ms", "DOUBLE DEFAULT NULL"],
  ["agent_metrics", "error_count", "INT DEFAULT NULL"],
  ["agent_metrics", "disk_health_status", "VARCHAR(32) DEFAULT NULL"],
  ["agent_metrics", "disk_temperature_c", "DOUBLE DEFAULT NULL"],
  ["agent_metrics", "gateway_reachable", "TINYINT(1) DEFAULT NULL"],
  ["agent_metrics", "dns_working", "TINYINT(1) DEFAULT NULL"],
  ["agent_metrics", "internet_reachable", "TINYINT(1) DEFAULT NULL"],
  ["agent_metrics", "default_gateway", "VARCHAR(45) DEFAULT NULL"],
  ["agent_locations", "accuracy_meters", "DOUBLE NOT NULL DEFAULT 0"],
  ["agent_locations", "source", "VARCHAR(32) NOT NULL DEFAULT 'unknown'"],
];

export async function getDbStatus(): Promise<DbStatus> {
  try {
    const placeholders = REQUIRED_TABLES.map(() => "?").join(", ");
    const rows = await query<{ name: string }>(
      `SELECT TABLE_NAME AS name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`,
      [...REQUIRED_TABLES] as unknown[],
    );
    const present = new Set(rows.map((r) => r.name));
    const missing = REQUIRED_TABLES.filter((t) => !present.has(t));
    return {
      ok: true,
      initialized: missing.length === 0,
      missing_tables: missing,
    };
  } catch (err) {
    return {
      ok: false,
      initialized: false,
      missing_tables: [...REQUIRED_TABLES],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Idempotent, non-destructive: creates missing tables, adds missing columns,
// and seeds defaults only when the tables are empty. Safe to run on an
// existing database with years of data.
export async function initializeDatabase(): Promise<InitReport> {
  const steps: InitStep[] = [];
  const seededUsers: string[] = [];
  let apiKey: string | undefined;
  let failed = false;

  async function run(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
      steps.push({ name, status: "ok" });
    } catch (err) {
      failed = true;
      steps.push({
        name,
        status: "error",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  for (const [name, ddl] of BASE_TABLES) {
    await run(`Create table ${name}`, async () => {
      await query(ddl);
    });
  }

  for (const [name, ddl] of AUX_TABLES) {
    await run(`Create table ${name}`, async () => {
      await query(ddl);
    });
  }

  for (const [table, column, definition] of ADD_COLUMNS) {
    const exists = await columnExists(table, column);
    if (exists) {
      steps.push({ name: `Column ${table}.${column}`, status: "skipped", detail: "already exists" });
      continue;
    }
    await run(`Add column ${table}.${column}`, async () => {
      await query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    });
  }

  try {
    const row = await queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM users`);
    if ((row?.cnt ?? 0) === 0) {
      const pwHash = hashSecret("password");
      await query(
        `INSERT INTO users (username, display_name, password_hash, role, is_active)
         VALUES (?, ?, ?, 'admin', 1), (?, ?, ?, 'viewer', 1)`,
        ["admin", "Administrator", pwHash, "viewer", "Viewer", pwHash],
      );
      seededUsers.push("admin", "viewer");
      steps.push({
        name: "Seed default users",
        status: "ok",
        detail: "admin + viewer created (default password: 'password')",
      });
    } else {
      steps.push({ name: "Seed default users", status: "skipped", detail: "users already exist" });
    }
  } catch (err) {
    failed = true;
    steps.push({
      name: "Seed default users",
      status: "error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const row = await queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM api_keys`);
    if ((row?.cnt ?? 0) === 0) {
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      const randomPart = Array.from({ length: 24 }, () =>
        chars[Math.floor(Math.random() * chars.length)],
      ).join("");
      const rawKey = `ppulse-sk-${randomPart}`;
      await query(
        `INSERT INTO api_keys (key_prefix, key_hash, label, is_active)
         VALUES (?, ?, 'Default Agent Key', 1)`,
        [rawKey.slice(0, 11), hashSecret(rawKey)],
      );
      apiKey = rawKey;
      steps.push({
        name: "Seed default API key",
        status: "ok",
        detail: "created a default agent API key",
      });
    } else {
      steps.push({ name: "Seed default API key", status: "skipped", detail: "API keys already exist" });
    }
  } catch (err) {
    failed = true;
    steps.push({
      name: "Seed default API key",
      status: "error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    ok: !failed,
    steps,
    seeded_users: seededUsers,
    api_key: apiKey,
    message: failed
      ? "Initialization finished with errors — review the steps below."
      : "Database initialized successfully.",
  };
}
