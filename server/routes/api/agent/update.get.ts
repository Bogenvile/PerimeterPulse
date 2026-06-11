import { defineHandler } from "nitro";
import { getQuery, getRequestURL } from "nitro/h3";
import { validateApiKeyByValue } from "../../../lib/auth";
import { queryOne } from "../../../db/mysql";

const CURRENT_VERSION = "1.2.0";

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

  // Cek versi agent saat ini di database
  const asset = await queryOne<{ agent_version: string; hostname: string }>(
    `SELECT agent_version, hostname FROM assets WHERE agent_id = ?`,
    [agentId],
  );

  // Jika versi sudah terbaru atau asset tidak ditemukan, tidak perlu update
  if (!asset || asset.agent_version === CURRENT_VERSION) {
    return { version: "", download_url: "" };
  }

  // Tentukan base URL untuk download
  // Prioritas: 1. Env Variable, 2. URL saat ini dari request (auto-detect)
  let baseUrl = process.env.AGENT_UPDATE_URL;
  if (!baseUrl) {
    const url = getRequestURL(event);
    baseUrl = `${url.origin}/updates`;
  }

  const os = q.os as string || "unknown";
  const ext = os === "windows" ? ".exe" : "";
  
  // Format nama file: agent-v{VERSION}-{OS}.exe
  const downloadUrl = `${baseUrl}/agent-v${CURRENT_VERSION}-${os}${ext}`;

  return {
    version: CURRENT_VERSION,
    download_url: downloadUrl,
  };
});