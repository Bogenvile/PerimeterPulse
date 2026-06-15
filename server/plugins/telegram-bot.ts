import { getSetting, query, queryOne, sendCommand as dbSendCommand } from "../db/mysql";
import { insertCommand, ensureAgentCommandsTable } from "../db/commands";

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let lastUpdateId = 0;

async function getBotToken(): Promise<string | null> {
  return await getSetting("telegram_bot_token");
}

async function processUpdates() {
  const token = await getBotToken();
  if (!token) return;

  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=5`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json() as { ok: boolean; result: any[] };
    if (!data.ok || !data.result) return;

    for (const update of data.result) {
      lastUpdateId = update.update_id;
      if (!update.message?.text) continue;

      const chatId = update.message.chat.id;
      const text = update.message.text.trim();

      try {
        const reply = await handleCommand(text, chatId, token);
        if (reply) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: reply,
              parse_mode: "HTML",
            }),
          });
        }
      } catch (err) {
        console.error("Telegram command error:", err);
      }
    }
  } catch {
    // ignore polling errors
  }
}

async function handleCommand(text: string, chatId: string | number, _token: string): Promise<string | null> {
  if (text.startsWith("/status")) {
    const parts = text.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      const hostname = parts[1];
      const asset = await queryOne<Record<string, unknown>>(
        `SELECT hostname, os, status, cpu_model, cpu_cores, ram_total_bytes, storage_total_bytes,
                disk_health_status, wifi_ssid, network_speed_mbps, ping_latency_ms, error_count,
                last_seen_at, city, country
         FROM assets WHERE hostname LIKE ?`,
        [`%${hostname}%`],
      );
      if (!asset) return `❌ Asset not found: ${hostname}`;
      return `<b>${asset.hostname}</b>\nOS: ${asset.os}\nStatus: <b>${asset.status}</b>\nCPU: ${asset.cpu_model} (${asset.cpu_cores} cores)\nDisk: ${asset.disk_health_status || "unknown"}\nWiFi: ${asset.wifi_ssid || "N/A"}\nLast Seen: ${asset.last_seen_at || "N/A"}`;
    }

    // List all assets
    const assets = await query<{ hostname: string; status: string }>(
      `SELECT hostname, status FROM assets ORDER BY hostname`,
    );
    if (assets.length === 0) return "No assets registered.";
    const statusEmoji: Record<string, string> = { online: "🟢", warning: "🟡", critical: "🔴", offline: "⚫" };
    return `<b>📊 Assets (${assets.length})</b>\n\n` +
      assets.map((a) => `${statusEmoji[a.status] || "⚪"} ${a.hostname}`).join("\n");
  }

  if (text.startsWith("/cmd")) {
    const parts = text.split(" ").filter(Boolean);
    if (parts.length < 3) return "Usage: /cmd <hostname> <command>";

    const hostname = parts[1];
    const command = parts.slice(2).join(" ");

    const asset = await queryOne<{ agent_id: string; hostname: string }>(
      `SELECT agent_id, hostname FROM assets WHERE hostname LIKE ?`,
      [`%${hostname}%`],
    );
    if (!asset) return `❌ Asset not found: ${hostname}`;

    try {
      await ensureAgentCommandsTable();
      const result = await insertCommand(asset.agent_id, command, "telegram_bot");
      return `✅ Command queued for <b>${asset.hostname}</b>\nID: ${result.id}\nCommand: <code>${command}</code>`;
    } catch (err) {
      return `❌ Failed to queue command: ${err instanceof Error ? err.message : "Unknown error"}`;
    }
  }

  if (text.startsWith("/help")) {
    return `<b>PerimeterPulse Bot Commands</b>\n\n/status — List all assets\n/status <hostname> — Asset detail\n/cmd <hostname> <command> — Execute remote command\n/help — Show this help`;
  }

  return null;
}

export function startTelegramBot() {
  if (pollingInterval) return;
  console.log("🤖 Telegram bot polling started");
  pollingInterval = setInterval(processUpdates, 15000);
}

export function stopTelegramBot() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}