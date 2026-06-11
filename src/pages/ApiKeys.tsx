import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { getApiKeys, createApiKey, setApiToken } from "@/lib/api";
import { showSuccess, showError } from "@/utils/toast";
import {
  Key,
  Plus,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Clock,
  X,
} from "lucide-react";
import type { ApiKeyInfo } from "@/lib/types";

const ApiKeysPage = () => {
  const { token, isAdmin } = useAuth();
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKeyDialog, setNewKeyDialog] = useState<{ raw: string; prefix: string; label: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchKeys = useCallback(() => {
    if (!token || !isAdmin) return;
    setApiToken(token);
    setLoading(true);
    getApiKeys()
      .then(setKeys)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, isAdmin]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function handleCreate() {
    setCreating(true);
    try {
      const result = await createApiKey(labelInput || undefined);
      showSuccess("API key created");
      setNewKeyDialog({ raw: result.api_key, prefix: result.key_prefix, label: result.label });
      setLabelInput("");
      setShowCreateForm(false);
      fetchKeys();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  function handleCopy(key: string, id: string) {
    navigator.clipboard.writeText(key).then(() => {
      setCopiedId(id);
      showSuccess("Key copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "Never";
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 gap-3">
        <ShieldCheck className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">Admin access required</p>
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

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm font-medium text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 p-6 md:p-8 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">API Keys</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage authentication keys for your monitoring agents
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Key
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.02] p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">New API Key</h3>
            <button
              onClick={() => { setShowCreateForm(false); setLabelInput(""); }}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Label (e.g. Production Agents)"
              className="flex-1 rounded-lg border border-input bg-card py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Generate
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The full key will only be shown once after creation.
          </p>
        </div>
      )}

      {/* New Key Reveal Dialog */}
      {newKeyDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl overflow-hidden animate-fade-in-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                  <Check className="h-4 w-4 text-emerald-600" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Key Created Successfully</h3>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs font-semibold text-amber-800 mb-1">
                  ⚠ Save this key now — it won't be shown again
                </p>
                <p className="text-xs text-amber-700">
                  Store it securely in your agent configuration or a password manager.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">API Key</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm font-mono text-foreground break-all select-all">
                    {newKeyDialog.raw}
                  </code>
                  <button
                    onClick={() => handleCopy(newKeyDialog.raw, "new")}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                  >
                    {copiedId === "new" ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Label: <span className="font-medium text-foreground">{newKeyDialog.label}</span></span>
                <span>Prefix: <code className="font-mono text-foreground">{newKeyDialog.prefix}…</code></span>
              </div>
            </div>
            <div className="border-t border-border px-5 py-4">
              <button
                onClick={() => setNewKeyDialog(null)}
                className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
              >
                Done, I've saved the key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground">{keys.length} key{keys.length !== 1 ? "s" : ""} configured</p>
        </div>
        {keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Key className="h-8 w-8 mb-3 opacity-40" />
            <p className="text-sm font-medium">No API keys yet</p>
            <p className="text-xs mt-1">Create a key to authenticate your agents</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Key className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{key.label}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      key.is_active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {key.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <code className="font-mono">{key.key_prefix}••••••••</code>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created {formatDate(key.created_at)}
                    </span>
                    {key.last_used_at && (
                      <span>Last used {formatDate(key.last_used_at)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-semibold text-foreground mb-2">How API Keys Work</p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Agents use API keys to authenticate when sending heartbeats</li>
          <li>• Keys are bcrypt-hashed on the server — the raw value is only shown once</li>
          <li>• Pass the key via <code className="font-mono bg-muted px-1 py-0.5 rounded text-foreground">--apikey</code> flag when starting the agent</li>
          <li>• Rotate keys periodically for better security</li>
        </ul>
      </div>
    </div>
  );
};

export default ApiKeysPage;