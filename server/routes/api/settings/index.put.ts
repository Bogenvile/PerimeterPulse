import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { setSetting } from "../../../db/mysql";
import { requireAdminAuth } from "../../../lib/auth";
import { startTelegramBot } from "../../../lib/telegram-bot";

export default defineHandler(async (event) => {
  await requireAdminAuth(event);
  const body = await readBody<Record<string, string>>(event);
  if (!body || Object.keys(body).length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No settings provided" });
  }

  for (const [key, value] of Object.entries(body)) {
    await setSetting(key, value);
  }

  // If telegram token updated, try starting bot
  if (body.telegram_bot_token) {
    try {
      startTelegramBot();
    } catch (e) {
      console.error("Failed to start telegram bot after settings update:", e);
    }
  }

  return { ok: true };
});