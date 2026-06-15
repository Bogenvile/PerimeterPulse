import { getAllSettings, getSetting } from "../db/mysql";

interface NotifConfig {
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from?: string;
  email_to?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  notifications_enabled?: string;
}

export async function getNotifConfig(): Promise<NotifConfig> {
  const settings = await getAllSettings();
  return {
    smtp_host: settings["smtp_host"],
    smtp_port: settings["smtp_port"],
    smtp_user: settings["smtp_user"],
    smtp_pass: settings["smtp_pass"],
    smtp_from: settings["smtp_from"],
    email_to: settings["email_to"],
    telegram_bot_token: settings["telegram_bot_token"],
    telegram_chat_id: settings["telegram_chat_id"],
    notifications_enabled: settings["notifications_enabled"],
  };
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  const config = await getNotifConfig();
  if (!config.telegram_bot_token || !config.telegram_chat_id) return false;

  try {
    const url = `https://api.telegram.org/bot${config.telegram_bot_token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegram_chat_id,
        text,
        parse_mode: "HTML",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendEmail(subject: string, body: string): Promise<boolean> {
  const config = await getNotifConfig();
  if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) return false;

  // Simple SMTP via fetch? We'll use a simple nodemailer alternative.
  // For now, we can use the native Node.js net module to send, but it's non-trivial.
  // We'll import nodemailer if available, otherwise fallback.
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: parseInt(config.smtp_port || "587"),
      secure: parseInt(config.smtp_port || "587") === 465,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass,
      },
    });

    await transporter.sendMail({
      from: config.smtp_from || config.smtp_user,
      to: config.email_to || config.smtp_user,
      subject,
      text: body,
    });
    return true;
  } catch {
    return false;
  }
}

export async function notifyStatusChange(
  hostname: string,
  oldStatus: string,
  newStatus: string,
  metrics: any,
): Promise<void> {
  const config = await getNotifConfig();
  if (config.notifications_enabled !== "true") return;

  const emoji = newStatus === "critical" ? "🔴" : "🟡";
  const message = `<b>${emoji} PerimeterPulse Alert</b>\n\nAsset: <b>${hostname}</b>\nStatus: ${oldStatus} → <b>${newStatus}</b>\nCPU: ${metrics.cpu_percent?.toFixed(1)}%\nRAM: ${metrics.ram_percent?.toFixed(1)}%\nDisk: ${metrics.storage_percent?.toFixed(1)}%`;

  await Promise.all([
    sendTelegramMessage(message),
    sendEmail(
      `[PerimeterPulse] ${hostname} - ${newStatus.toUpperCase()}`,
      message.replace(/<[^>]+>/g, ""),
    ),
  ]);
}