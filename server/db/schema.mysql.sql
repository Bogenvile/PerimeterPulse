-- PerimeterPulse Schema — MySQL 8.4

CREATE TABLE IF NOT EXISTS users (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_keys (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assets (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_metrics (
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
  gateway_reachable TINYINT(1) NULL,
  dns_working TINYINT(1) NULL,
  internet_reachable TINYINT(1) NULL,
  default_gateway VARCHAR(64) NULL,
  disk_health_status VARCHAR(32) NULL,
  disk_temperature_c DECIMAL(6,2) NULL,
  recorded_at DATETIME(3) NOT NULL,
  INDEX idx_agent_time (agent_id, recorded_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_locations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  agent_id VARCHAR(64) NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  accuracy_meters INT UNSIGNED NOT NULL DEFAULT 0,
  source VARCHAR(16) NOT NULL DEFAULT 'geoip',
  recorded_at DATETIME(3) NOT NULL,
  INDEX idx_agent_time (agent_id, recorded_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default users (bcrypt hashes will be replaced in production)
-- Default password for both: "password" (bcrypt hash)
INSERT IGNORE INTO users (id, username, display_name, password_hash, role, is_active) VALUES
  (UUID(), 'admin', 'Administrator', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', 1),
  (UUID(), 'viewer', 'Viewer', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'viewer', 1);

-- Create default API key
INSERT IGNORE INTO api_keys (id, key_prefix, key_hash, label, is_active)
VALUES (
  UUID(),
  'ppulse-s',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Default Agent Key',
  1
);