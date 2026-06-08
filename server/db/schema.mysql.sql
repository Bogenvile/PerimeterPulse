-- ============================================================================
-- PerimeterPulse — MySQL Schema
-- ============================================================================

CREATE DATABASE IF NOT EXISTS perimeterpulse
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE perimeterpulse;

-- ──── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  username      VARCHAR(64)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(128) NOT NULL DEFAULT '',
  role          ENUM('admin','viewer') NOT NULL DEFAULT 'viewer',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ──── API Keys ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id           CHAR(36)    NOT NULL DEFAULT (UUID()),
  key_prefix   VARCHAR(12) NOT NULL,
  key_hash     VARCHAR(255) NOT NULL,
  label        VARCHAR(128) NOT NULL DEFAULT '',
  is_active    TINYINT(1)  NOT NULL DEFAULT 1,
  created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP   NULL DEFAULT NULL,
  created_by   CHAR(36)    NULL,
  PRIMARY KEY (id),
  INDEX idx_api_keys_prefix (key_prefix)
) ENGINE=InnoDB;

-- ──── Assets (PC Inventory) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id                  CHAR(36)     NOT NULL DEFAULT (UUID()),
  agent_id            VARCHAR(128) NOT NULL UNIQUE,
  hostname            VARCHAR(255) NOT NULL,
  os                  VARCHAR(64)  NOT NULL DEFAULT '',
  os_version          VARCHAR(32)  NOT NULL DEFAULT '',
  agent_version       VARCHAR(16)  NOT NULL DEFAULT '1.0.0',
  mac_addresses       JSON         NULL,
  ip_addresses        JSON         NULL,
  cpu_model           VARCHAR(128) NOT NULL DEFAULT '',
  cpu_cores           INT          NOT NULL DEFAULT 0,
  ram_total_bytes     BIGINT       NOT NULL DEFAULT 0,
  storage_total_bytes BIGINT       NOT NULL DEFAULT 0,
  disk_model          VARCHAR(128) NOT NULL DEFAULT '',
  disk_type           VARCHAR(16)  NOT NULL DEFAULT 'unknown',
  disk_health_status  VARCHAR(16)  NULL DEFAULT NULL,
  disk_temperature_c  DECIMAL(5,1) NULL DEFAULT NULL,
  wifi_ssid           VARCHAR(128) NOT NULL DEFAULT '',
  wifi_signal_dbm     INT          NULL DEFAULT NULL,
  network_speed_mbps  INT          NOT NULL DEFAULT 0,
  status              ENUM('online','offline','warning','critical') NOT NULL DEFAULT 'offline',
  last_seen_at        TIMESTAMP    NULL DEFAULT NULL,
  last_location_lat   DECIMAL(10,7) NULL DEFAULT NULL,
  last_location_lng   DECIMAL(10,7) NULL DEFAULT NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_assets_agent_id (agent_id),
  INDEX idx_assets_status (status)
) ENGINE=InnoDB;

-- ──── Time-Series: Agent Metrics ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_metrics (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  agent_id          VARCHAR(128) NOT NULL,
  cpu_percent       DECIMAL(5,1) NOT NULL DEFAULT 0,
  ram_percent       DECIMAL(5,1) NOT NULL DEFAULT 0,
  ram_used_bytes    BIGINT       NOT NULL DEFAULT 0,
  ram_total_bytes   BIGINT       NOT NULL DEFAULT 0,
  storage_percent   DECIMAL(5,1) NOT NULL DEFAULT 0,
  storage_used_bytes BIGINT      NOT NULL DEFAULT 0,
  storage_total_bytes BIGINT     NOT NULL DEFAULT 0,
  uptime_seconds    BIGINT       NOT NULL DEFAULT 0,
  network_status    VARCHAR(16)  NOT NULL DEFAULT 'unknown',
  network_latency_ms DECIMAL(8,2) NOT NULL DEFAULT 0,
  gateway_reachable TINYINT(1)   NULL DEFAULT NULL,
  dns_working       TINYINT(1)   NULL DEFAULT NULL,
  internet_reachable TINYINT(1)  NULL DEFAULT NULL,
  default_gateway   VARCHAR(45)  NULL DEFAULT NULL,
  disk_health_status VARCHAR(16) NULL DEFAULT NULL,
  disk_temperature_c DECIMAL(5,1) NULL DEFAULT NULL,
  recorded_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_metrics_agent_time (agent_id, recorded_at),
  INDEX idx_metrics_time (recorded_at)
) ENGINE=InnoDB;

-- ──── Time-Series: Agent Locations ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_locations (
  id               BIGINT        NOT NULL AUTO_INCREMENT,
  agent_id         VARCHAR(128)  NOT NULL,
  latitude         DECIMAL(10,7) NOT NULL,
  longitude        DECIMAL(10,7) NOT NULL,
  accuracy_meters  DECIMAL(8,1)  NOT NULL DEFAULT 0,
  source           VARCHAR(16)   NOT NULL DEFAULT 'unknown',
  recorded_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_locations_agent_time (agent_id, recorded_at),
  INDEX idx_locations_time (recorded_at)
) ENGINE=InnoDB;

-- ──── Default Users ──────────────────────────────────────────────────────────
-- Password hashes dibuat dengan bcrypt (cost 10). 
-- Jalankan seed script untuk update hash yang benar.
INSERT IGNORE INTO users (username, password_hash, display_name, role) VALUES
  ('admin',  '$2a$10$PLACEHOLDER_ADMIN_HASH',  'Administrator', 'admin'),
  ('viewer', '$2a$10$PLACEHOLDER_VIEWER_HASH', 'Viewer',        'viewer');