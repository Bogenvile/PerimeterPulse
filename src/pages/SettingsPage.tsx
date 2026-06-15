import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { getAppSettings, updateAppSettings, setApiToken } from "@/lib/api";
import { showSuccess, showError } from "@/utils/toast";
import { Save, Loader2, ShieldCheck, Key, Bot, Mail, MessageCircle } from "lucide-react";

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
      .then(setSettings)
      .catch(() => showError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, [token, isAdmin]);

  function updateField(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateAppSettings(settings);
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
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

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
      <Section icon={<Bot className="h-4 w-4" />} title="AI Assistant (OpenAI)">
        <FormInput
          label="OpenAI API Key"
          type="password"
          value={settings.openai_api_key || ""}
          onChange={(v) => updateField("openai_api_key", v)}
          placeholder="sk-..."
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Required for the AI Chat Assistant feature. Uses GPT-4o-mini.
        </p>
      </Section>

      {/* Telegram */}
      <Section icon={<MessageCircle className="h-4 w-4" />} title="Telegram Notifications & Bot">
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
          Bot commands: <code className="bg-muted px-1 py-0.5 rounded">/status</code>,{" "}
          <code className="bg-muted px-1 py-0.5 rounded">/status <hostname></code>,{" "}
          <code className="bg-muted px-1 py-0.5 rounded">/cmd <hostname> <command></code>
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

function FormInput({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
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