-- Migration v3: Agent Error Logs table

CREATE TABLE IF NOT EXISTS agent_error_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  agent_id VARCHAR(64) NOT NULL,
  error_time DATETIME(3) NOT NULL,
  error_id INT UNSIGNED NOT NULL DEFAULT 0,
  error_level VARCHAR(16) NOT NULL DEFAULT 'Error',
  error_source VARCHAR(255) NOT NULL DEFAULT '',
  error_message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agent_time (agent_id, error_time DESC),
  INDEX idx_agent_created (agent_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
