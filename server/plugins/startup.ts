export default {
  async setup(nitroApp: any) {
    // Plugin startup that runs once when Nitro is ready.
    // Migrations are handled on first heartbeat (agent/heartbeat.post.ts)
    // Telegram bot starts when settings are saved (settings/index.put.ts)
    console.log("✅ Nitro server ready");
  }
};