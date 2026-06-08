-- ============================================================
-- PerimeterPulse Database Schema — MySQL 8.0+
--
-- Setup:
--   mysql -u root -p < server/db/schema.mysql.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS perimeterpulse
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE perimeterpulse;

-- ──── Users (dashboard login) ────
CREATE TABLE IF NOT EXISTS users (
    id            CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    username      VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,          -- bcrypt hash
    display_name  VARCHAR(128) NOT NULL DEFAULT '',
    role          ENUM('admin','viewer') NOT NULL DEFAULT 'viewer',
    is_active     TINYINT(1) NOT NULL DEFAULT 1,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL DEFAULT NULL
) ENGINE=InnoDB;

-- Default admin (password: admin123)
INSERT INTO users (username, password_hash, display_name, role)
VALUES ('admin', '$2a$10$placeholder_hash_admin123', 'Administrator', 'admin')
ON DUPLICATE KEY UPDATE username=username;

-- Default viewer (password: viewer123)
INSERT INTO users (username, password_hash, display_name, role)
VALUES ('viewer', '$2a$10$placeholder_hash_viewer123', 'Viewer User', 'viewer')
ON DUPLICATE KEY UPDATE username=username;

-- ──── API Keys (agent authentication) ────
CREATE TABLE IF NOT EXISTS api_keys (
    id          CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    key_prefix  VARCHAR(16) NOT NULL,
    key_hash    VARCHAR(255) NOT NULL UNIQUE,      -- bcrypt hash
    label       VARCHAR(128) NOT NULL DEFAULT '',
    created_by  CHAR(36) NULL,
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Default agent key (raw: ppulse-sk-a1b2c3d4e5f6g7h8)
INSERT INTO api_keys (key_prefix, key_hash, label)
VALUES ('ppulse-s', '$2a$10$PlaceholderHashForDefaultAgentKey', 'Default Agent Key')
ON DUPLICATE KEY UPDATE key_prefix=key_prefix;

-- ──── Assets (PC inventory with extended hardware info) ────
CREATE TABLE IF NOT EXISTS assets (
    id                    CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    agent_id              VARCHAR(32) NOT NULL UNIQUE,
    hostname              VARCHAR(255) NOT NULL,
    os                    VARCHAR(64) NOT NULL,
    os_version            VARCHAR(128) NOT NULL DEFAULT '',
    agent_version         VARCHAR(16) NOT NULL DEFAULT '1.0.0',
    mac_addresses         JSON NOT NULL DEFAULT ('[]'),
    ip_addresses          JSON NOT NULL DEFAULT ('[]'),
    cpu_model             VARCHAR(255) NOT NULL DEFAULT '',
    cpu_cores             INT NOT NULL DEFAULT 0,
    ram_total_bytes       BIGINT NOT NULL DEFAULT 0,
    storage_total_bytes   BIGINT NOT NULL DEFAULT 0,
    -- Disk details
    disk_model            VARCHAR(255) NOT NULL DEFAULT '',
    disk_type             ENUM('SSD','HDD','NVMe','unknown') NOT NULL DEFAULT 'unknown',
    disk_health_status    ENUM('ok','warning','critical','unknown') NOT NULL DEFAULT 'unknown',
    disk_temperature_c    DOUBLE NULL,
    -- Network details
    wifi_ssid             VARCHAR(128) NOT NULL DEFAULT '',
    wifi_signal_dbm       INT NULL,
    network_speed_mbps    DOUBLE NOT NULL DEFAULT 0,
    -- Status & location
    status                ENUM('online','offline','warning','critical') NOT NULL DEFAULT 'offline',
    last_seen_at          TIMESTAMP NULL DEFAULT NULL,
    last_location_lat     DOUBLE NULL,
    last_location_lng     DOUBLE NULL,
    registered_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_assets_status (status),
    INDEX idx_assets_agent_id (agent_id)
) ENGINE=InnoDB;
