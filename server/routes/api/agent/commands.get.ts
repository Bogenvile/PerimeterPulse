import { defineHandler } from "nitro";
import { getQuery, createError } from "nitro/h3";
import { validateApiKeyByValue } from "../../../lib/auth";
import { fetchPendingCommands, ensureAgentCommandsTable } from "../../../db/commands";

export default defineHandler(async (event) => {
  const q = getQuery(event);
  const agentId = q.agent_id as string;
  const apiKey = q.api_key as string;

  if (!agentId || !apiKey) {
    throw createError({ statusCode: 400, statusMessage: "agent_id and api_key required" });
  }

  const keyId = await validateApiKeyByValue(apiKey);
  if (!keyId) {
    throw createError({ statusCode: 401, statusMessage: "Invalid API key" });
  }

  try {
    await ensureAgentCommandsTable();
  } catch {
    // ignore
  }

  const commands = await fetchPendingCommands(agentId);
  return { commands };
});