-- ============================================================
-- PerimeterPulse Database Schema
-- Run this against PostgreSQL to initialize the system.
-- ============================================================

-- ──── API Keys (for agent authentication) ────
CREATE TABLE IF NOT EXISTS api_keys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash    TEXT NOT NULL UNIQUE,          -- bcrypt hash of the API key
    label       TEXT NOT NULL DEFAULT '',       -- human-readable label
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

-- ──── Assets (static PC inventory) ────
CREATE TABLE IF NOT EXISTS assets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id            TEXT NOT NULL UNIQUE,
    hostname            TEXT NOT NULL,
    os                  TEXT NOT NULL,
    os_version          TEXT NOT NULL DEFAULT '',
    agent_version       TEXT NOT NULL DEFAULT '1.0.0',
    mac_addresses       TEXT[] NOT NULL DEFAULT '{}',
    cpu_model           TEXT NOT NULL DEFAULT '',
    ram_total_bytes     BIGINT NOT NULL DEFAULT 0,
    storage_total_bytes BIGINT NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'offline'
                        CHECK (status IN ('online','offline','warning','critical')),
    last_seen_at        TIMESTAMPTZ,
    last_location_lat   DOUBLE PRECISION,
    last_location_lng   DOUBLE PRECISION,
    registered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_agent_id ON assets(agent_id);

-- ──── Trigger to auto-update updated_at ────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
