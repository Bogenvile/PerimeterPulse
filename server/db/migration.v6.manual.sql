-- ──── Migration v6: Tags + App Settings + Last Status Change ────
-- Jalankan manual di MySQL jika auto-migrasi gagal

-- 1. Tambah kolom tags di tabel assets
-- (skip jika sudah ada — akan error "Duplicate column name" tapi aman)
ALTER TABLE assets ADD COLUMN tags JSON DEFAULT ('[]');

-- 2. Tambah kolom last_status_change di tabel assets
ALTER TABLE assets ADD COLUMN last_status_change DATETIME DEFAULT NULL;

-- 3. Buat tabel app_settings (untuk AI key, Telegram, SMTP, dll)
CREATE TABLE IF NOT EXISTS app_settings (
  `key` VARCHAR(255) NOT NULL,
  `value` TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Buat tabel agent_commands (remote commands)
CREATE TABLE IF NOT EXISTS agent_commands (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  agent_id VARCHAR(64) NOT NULL,
  command TEXT NOT NULL,
  status ENUM('pending','running','completed','failed','timeout') NOT NULL DEFAULT 'pending',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Buat tabel agent_error_logs
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Verifikasi
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'assets'
  AND COLUMN_NAME IN ('tags', 'last_status_change');

SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('app_settings', 'agent_commands', 'agent_error_logs');