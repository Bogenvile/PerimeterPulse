-- ============================================================
-- PerimeterPulse Database Schema v2
-- Run against PostgreSQL to initialize the system.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──── Users (dashboard authentication with roles) ────
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,                    -- bcrypt via crypt()
    display_name  TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('admin','viewer')),
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

-- Seed default admin user (password: admin123)
INSERT INTO users (username, password_hash, display_name, role)
VALUES ('admin', crypt('admin123', gen_salt('bf')), 'Administrator', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Seed default viewer user (password: viewer123)
INSERT INTO users (username, password_hash, display_name, role)
VALUES ('viewer', crypt('viewer123', gen_salt('bf')), 'Viewer User', 'viewer')
ON CONFLICT (username) DO NOTHING;

-- ──── API Keys (for agent authentication) ────
CREATE TABLE IF NOT EXISTS api_keys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_prefix  TEXT NOT NULL,                      -- first 8 chars for UI display
    key_hash    TEXT NOT NULL UNIQUE,               -- bcrypt hash of the full key
    label       TEXT NOT NULL DEFAULT '',
    created_by  UUID REFERENCES users(id),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

-- Seed default agent API key (raw: ppulse-sk-a1b2c3d4e5f6g7h8)
INSERT INTO api_keys (key_prefix, key_hash, label)
VALUES ('ppulse-s', crypt('ppulse-sk-a1b2c3d4e5f6g7h8', gen_salt('bf')), 'Default Agent Key')
ON CONFLICT (key_hash) DO NOTHING;

-- ──── Assets (extended PC inventory) ────
CREATE TABLE IF NOT EXISTS assets (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id              TEXT NOT NULL UNIQUE,
    hostname              TEXT NOT NULL,
    os                    TEXT NOT NULL,
    os_version            TEXT NOT NULL DEFAULT '',
    agent_version         TEXT NOT NULL DEFAULT '1.0.0',
    mac_addresses         TEXT[] NOT NULL DEFAULT '{}',
    ip_addresses          TEXT[] NOT NULL DEFAULT '{}',
    cpu_model             TEXT NOT NULL DEFAULT '',
    cpu_cores             INT NOT NULL DEFAULT 0,
    ram_total_bytes       BIGINT NOT NULL DEFAULT 0,
    storage_total_bytes   BIGINT NOT NULL DEFAULT 0,
    -- Disk details
    disk_model            TEXT NOT NULL DEFAULT '',
    disk_type             TEXT NOT NULL DEFAULT 'unknown'
                          CHECK (disk_type IN ('SSD','HDD','NVMe','unknown')),
    disk_health_status    TEXT NOT NULL DEFAULT 'unknown'
                          CHECK (disk_health_status IN ('ok','warning','critical','unknown')),
    disk_temperature_c    REAL,
    -- Network details
    wifi_ssid             TEXT NOT NULL DEFAULT '',
    wifi_signal_dbm       INT,                      -- dBm (e.g., -40 to -90)
    network_speed_mbps    REAL NOT NULL DEFAULT 0,
    -- Status & location
    status                TEXT NOT NULL DEFAULT 'offline'
                          CHECK (status IN ('online','offline','warning','critical')),
    last_seen_at          TIMESTAMPTZ,
    last_location_lat     DOUBLE PRECISION,
    last_location_lng     DOUBLE PRECISION,
    registered_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_agent_id ON assets(agent_id);

-- ──── Trigger to auto-update updated_at ────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assets_updated_at ON assets;
CREATE TRIGGER trg_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
