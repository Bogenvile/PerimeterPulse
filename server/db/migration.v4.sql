-- Migration v4: Create agent_error_logs table
-- This table stores system error logs reported by agents during heartbeats.

CREATE TABLE IF NOT EXISTS `agent_error_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `agent_id` VARCHAR(64) NOT NULL,
  `error_time` DATETIME NOT NULL,
  `error_id` INT UNSIGNED NOT NULL DEFAULT 0,
  `error_level` VARCHAR(32) NOT NULL DEFAULT 'Error',
  `error_source` VARCHAR(255) NOT NULL DEFAULT '',
  `error_message` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_agent_error_logs_agent_id` (`agent_id`),
  INDEX `idx_agent_error_logs_time` (`agent_id`, `error_time` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;