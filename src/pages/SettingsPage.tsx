import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { getAppSettings, updateAppSettings, setApiToken } from "@/lib/api";
import { showSuccess, showError } from "@/utils/toast";
import { Save, Loader2, ShieldCheck, Key, Bot, Mail, MessageCircle, Globe, Cpu } from "lucide-react";

export default function SettingsPage() {
  const { token, isAdmin } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !isAdmin) return;
    setApiToken(token);
    setLoading(true);
    getAppSettings()
      .then((s) => {
        // Migrate old openai_api_key to ai_api_key if needed
        if (s.openai_api_key && !s.ai_api_key) {
          s.ai_api_key = s.openai_api_key;
        }
        setSettings(s);
      })
      .catch(() => showError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, [token, isAdmin]);

  function updateField(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Save all fields including the new ai_* keys
      const toSave: Record<string, string> = {};
      for (const [key, value] of Object.entries(settings)) {
        // Skip legacy key to avoid confusion
        if (key === "openai_api_key") continue;
        toSave[key] = value;
      }
      await updateAppSettings(toSave);
      showSuccess("Settings saved");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Admin access required</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const botCmds = [
    { cmd: "/status", desc: "" },
    { cmd: "/status <hostname>", desc: "" },
    { cmd: "/cmd <hostname> <command>", desc: "" },
  ];

  const defaultBaseUrl = "https://api.minimax.chat/v1";
  const defaultModel = "MiniMax-Text-01";

  return (
    <div className="animate-fade-in space-y-6 p-6 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">App Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure AI, Email & Telegram notifications</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save All
        </button>
      </div>

      {/* AI */}
      <Section icon={<Bot className="h-4 w-4" />} title="AI Assistant">
        <div className="space-y-4">
          <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
            <p className="text-xs font-semibold text-primary mb-2">Custom AI Provider</p>
            <p className="text-xs text-muted-foreground">
              Supports any OpenAI-compatible API (MiniMax, DeepSeek, Groq, Together AI, Ollama, etc).
              The endpoint must support <code className="bg-muted px-1 py-0.5 rounded font-mono">/chat/completions</code> format.
            </p>
          </div>

          <FormInput
            label="API Base URL"
            value={settings.ai_base_url || ""}
            onChange={(v) => updateField("ai_base_url", v)}
            placeholder={defaultBaseUrl}
          />
          <p className="text-xs text-muted-foreground -mt-2">
            Examples: <code className="bg-muted px-1 py-0.5 rounded font-mono">https://api.minimax.chat/v1</code>,{" "}
            <code className="bg-muted px-1 py-0.5 rounded font-mono">https://api.deepseek.com/v1</code>,{" "}
            <code className="bg-muted px-1 py-0.5 rounded font-mono">http://localhost:11434/v1</code>
          </p>

          <FormInput
            label="Model Name"
            value={settings.ai_model || ""}
            onChange={(v) => updateField("ai_model", v)}
            placeholder={defaultModel}
          />
          <p className="text-xs text-muted-foreground -mt-2">
            Examples: <code className="bg-muted px-1 py-0.5 rounded font-mono">MiniMax-Text-01</code>,{" "}
            <code className="bg-muted px-1 py-0.5 rounded font-mono">deepseek-chat</code>,{" "}
            <code className="bg-muted px-1 py-0.5 rounded font-mono">llama3</code>
          </p>

          <FormInput
            label="API Key"
            type="password"
            value={settings.ai_api_key || ""}
            onChange={(v) => updateField("ai_api_key", v)}
            placeholder="Your API key..."
          />
          <p className="text-xs text-muted-foreground -mt-2">
            Required. Will be sent as Bearer token in the Authorization header.
          </p>
        </div>
      </Section>

      {/* Telegram */}
      <Section icon={<MessageCircle className="h-4 w-4" />} title="Telegram Notifications">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput
            label="Bot Token"
            type="password"
            value={settings.telegram_bot_token || ""}
            onChange={(v) => updateField("telegram_bot_token", v)}
            placeholder="123456:ABC-DEF1234..."
          />
          <FormInput
            label="Chat ID"
            value={settings.telegram_chat_id || ""}
            onChange={(v) => updateField("telegram_chat_id", v)}
            placeholder="-100123456789"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Bot commands:{" "}
          {botCmds.map((b, i) => (
            <span key={i}>
              <code className="bg-muted px-1 py-0.5 rounded">{b.cmd}</code>
              {i < botCmds.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      </Section>

      {/* Email */}
      <Section icon={<Mail className="h-4 w-4" />} title="Email Notifications (SMTP)">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput
            label="SMTP Host"
            value={settings.smtp_host || ""}
            onChange={(v) => updateField("smtp_host", v)}
            placeholder="smtp.gmail.com"
          />
          <FormInput
            label="SMTP Port"
            value={settings.smtp_port || ""}
            onChange={(v) => updateField("smtp_port", v)}
            placeholder="587"
          />
          <FormInput
            label="SMTP User"
            value={settings.smtp_user || ""}
            onChange={(v) => updateField("smtp_user", v)}
            placeholder="user@example.com"
          />
          <FormInput
            label="SMTP Password"
            type="password"
            value={settings.smtp_pass || ""}
            onChange={(v) => updateField("smtp_pass", v)}
            placeholder="••••••••"
          />
          <FormInput
            label="From Address"
            value={settings.smtp_from || ""}
            onChange={(v) => updateField("smtp_from", v)}
            placeholder="noreply@example.com"
          />
          <FormInput
            label="Recipient Email"
            value={settings.email_to || ""}
            onChange={(v) => updateField("email_to", v)}
            placeholder="admin@example.com"
          />
        </div>
      </Section>

      {/* Toggle */}
      <Section icon={<Key className="h-4 w-4" />} title="Notifications">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.notifications_enabled === "true"}
            onChange={(e) => updateField("notifications_enabled", e.target.checked ? "true" : "false")}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-sm text-foreground">Enable notifications on status change</span>
        </label>
      </Section>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-card py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
      />
    </div>
  );
}