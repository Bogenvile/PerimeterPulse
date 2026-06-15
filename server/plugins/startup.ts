import { ensureV6Schema } from "../db/mysql";
import { startTelegramBot } from "./telegram-bot";

// Nitro plugins can be exported as a default function that receives the nitroApp
// We don't need defineNitroPlugin – just export the function directly.
export default async function () {
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
}