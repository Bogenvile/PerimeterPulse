import { defineHandler } from "nitro";
import { getQuery } from "nitro/h3";
import { validateApiKeyByValue } from "../../../lib/auth";
import { queryOne } from "../../../db/mysql";

const CURRENT_VERSION = "1.2.0";
const UPDATE_SERVER_URL = process.env.AGENT_UPDATE_URL || "https://your-server.com/updates";

export default defineHandler(async (event) => {
  const q = getQuery(event);
  const agentId = q.agent_id as string;
  const apiKey = q.api_key as string;

  if (!agentId || !apiKey) {
    return { version: "", download_url: "" };
  }

  const keyId = await validateApiKeyByValue(apiKey);
  if (!keyId) {
    return { version: "", download_url: "" };
  }

  // Check if agent reported an older version
  const asset = await queryOne<{ agent_version: string; hostname: string }>(
    `SELECT agent_version, hostname FROM assets WHERE agent_id = ?`,
    [agentId],
  );

  if (!asset || asset.agent_version === CURRENT_VERSION) {
    return { version: "", download_url: "" };
  }

  const os = q.os as string || "unknown";
  const ext = os === "windows" ? ".exe" : "";
  const downloadUrl = `${UPDATE_SERVER_URL}/agent-v${CURRENT_VERSION}-${os}${ext}`;

  return {
    version: CURRENT_VERSION,
    download_url: downloadUrl,
  };
});