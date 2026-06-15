let botStarted = false;

export function startTelegramBot(): void {
  if (botStarted) return;
  botStarted = true;
  // Telegram bot functionality will be initialized here
  // For now this is a no-op stub
  console.log("[telegram-bot] Bot startup skipped (stub)");
}