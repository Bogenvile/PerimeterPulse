-- Migration v2: Add new fields for WiFi IP, Gateway, Ping Latency, Error Count, Location City/Country

ALTER TABLE agent_metrics
  ADD COLUMN IF NOT EXISTS ping_latency_ms DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER network_latency_ms,
  ADD COLUMN IF NOT EXISTS error_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER disk_temperature_c;

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS wifi_ip VARCHAR(64) NOT NULL DEFAULT '' AFTER wifi_signal_dbm,
  ADD COLUMN IF NOT EXISTS gateway_ip VARCHAR(64) NOT NULL DEFAULT '' AFTER wifi_ip,
  ADD COLUMN IF NOT EXISTS ping_latency_ms DECIMAL(10,2) NULL AFTER network_speed_mbps,
  ADD COLUMN IF NOT EXISTS error_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER ping_latency_ms,
  ADD COLUMN IF NOT EXISTS city VARCHAR(128) NOT NULL DEFAULT '' AFTER last_location_lng,
  ADD COLUMN IF NOT EXISTS country VARCHAR(128) NOT NULL DEFAULT '' AFTER city;
