import { defineNitroPlugin } from "nitro";
import { ensureV6Schema } from "../db/mysql";
import { startTelegramBot } from "./telegram-bot";

// Plugin startup yang hanya dijalankan sekali saat Nitro siap.
export default defineNitroPlugin(async () => {
  try {
    await ensureV6Schema();
    console.log("✅ Database schema v6 ready");
  } catch (err) {
    console.error("Schema migration error:", err);
  }

  try {
    startTelegramBot();
  } catch (err) {
    console.error("Telegram bot init error:", err);
  }
});