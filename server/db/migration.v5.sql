-- Migration v5: Remote Command Execution
-- Run this manually if upgrading from an older version

CREATE TABLE IF NOT EXISTS agent_commands (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;