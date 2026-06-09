import { query, queryOne } from "./mysql";

export async function ensureAgentCommandsTable(): Promise<void> {
  await query(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function insertCommand(
  agentId: string,
  command: string,
  createdBy: string,
): Promise<{ id: number }> {
  const result = await query<{ insertId: number }>(
    `INSERT INTO agent_commands (agent_id, command, created_by) VALUES (?, ?, ?)`,
    [agentId, command, createdBy],
  );
  return { id: result.insertId };
}

export async function fetchPendingCommands(
  agentId: string,
): Promise<Record<string, unknown>[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT id, command, created_at
     FROM agent_commands
     WHERE agent_id = ? AND status = 'pending'
     ORDER BY created_at ASC
     LIMIT 10`,
    [agentId],
  );
  return rows.map((r) => ({
    ...r,
    id: Number(r.id),
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  }));
}

export async function markCommandRunning(commandId: number): Promise<void> {
  await query(
    `UPDATE agent_commands SET status = 'running', started_at = NOW() WHERE id = ? AND status = 'pending'`,
    [commandId],
  );
}

export async function completeCommand(
  commandId: number,
  agentId: string,
  output: string | null,
  error: string | null,
  exitCode: number | null,
): Promise<boolean> {
  const result = await query<{ affectedRows: number }>(
    `UPDATE agent_commands
     SET status = ?, output = ?, error = ?, exit_code = ?, completed_at = NOW()
     WHERE id = ? AND agent_id = ? AND status = 'running'`,
    [error ? "failed" : "completed", output, error, exitCode, commandId, agentId],
  );
  return result.affectedRows > 0;
}

export async function getCommandHistory(
  agentId: string,
  limit = 50,
): Promise<Record<string, unknown>[]> {
  const safeLimit = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 200);
  const rows = await query<Record<string, unknown>>(
    `SELECT id, command, status, output, error, exit_code,
            created_by, created_at, started_at, completed_at
     FROM agent_commands
     WHERE agent_id = ?
     ORDER BY created_at DESC
     LIMIT ${safeLimit}`,
    [agentId],
  );
  return rows.map((r) => ({
    ...r,
    id: Number(r.id),
    exit_code: r.exit_code != null ? Number(r.exit_code) : null,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    started_at: r.started_at instanceof Date ? (r.started_at as Date).toISOString() : r.started_at,
    completed_at: r.completed_at instanceof Date ? (r.completed_at as Date).toISOString() : r.completed_at,
  }));
}