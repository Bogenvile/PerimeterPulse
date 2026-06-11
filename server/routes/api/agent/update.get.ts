import { defineHandler } from "nitro";
import { getQuery, getRequestURL } from "nitro/h3";
import { validateApiKeyByValue } from "../../../lib/auth";
import { readdir } from "node:fs/promises";
import path from "node:path";

export default defineHandler(async (event) => {
  const q = getQuery(event);
  const agentId = q.agent_id as string;
  const apiKey = q.api_key as string;
  const agentOs = q.os as string; // 'windows' or 'linux'

  if (!agentId || !apiKey) {
    return { version: "", download_url: "" };
  }

  const keyId = await validateApiKeyByValue(apiKey);
  if (!keyId) {
    return { version: "", download_url: "" };
  }

  try {
    const updatesDir = path.join(process.cwd(), "updates");
    const files = await readdir(updatesDir);
    
    // Filter file berdasarkan OS agent (misal: windows -> *.exe)
    const isWindows = agentOs === "windows";
    const validFiles = files.filter((f) => {
      const isExe = f.endsWith(".exe");
      return isWindows ? isExe : !isExe;
    });

    if (validFiles.length === 0) {
      return { version: "", download_url: "" };
    }

    // Cari file dengan versi tertinggi
    // Format: agent-v1.2.3-windows.exe
    const versionRegex = /agent-v(\d+\.\d+\.\d+)/;
    
    let latestFile = "";
    let maxVersion = "0.0.0";

    for (const f of validFiles) {
      const match = f.match(versionRegex);
      if (match) {
        const ver = match[1];
        if (ver.localeCompare(maxVersion, undefined, { numeric: true }) > 0) {
          maxVersion = ver;
          latestFile = f;
        }
      }
    }

    if (!latestFile) {
      return { version: "", download_url: "" };
    }

    // Tentukan base URL
    let baseUrl = process.env.AGENT_UPDATE_URL;
    if (!baseUrl) {
      const url = getRequestURL(event);
      baseUrl = `${url.origin}/updates`;
    }

    const downloadUrl = `${baseUrl}/${latestFile}`;

    return {
      version: maxVersion,
      download_url: downloadUrl,
    };
  } catch {
    return { version: "", download_url: "" };
  }
});