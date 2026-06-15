import { ensureV6Schema } from "../db/mysql";
import { startTelegramBot } from "./telegram-bot";

let started = false;

export default defineNitroPlugin(async () => {
  if (started) return;
  started = true;

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