import { useState, useEffect, useCallback, useRef } from "react";
import { sendCommand, getCommandHistory, setApiToken } from "@/lib/api";
import { showSuccess, showError } from "@/utils/toast";
import {
  Terminal,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Timer,
  Play,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { AgentCommand, CommandStatus } from "@/lib/types";
import { useAuth } from "@/lib/auth";

interface RemoteCommandsProps {
  assetId: string;
  token: string | null;
}

const statusConfig: Record<CommandStatus, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: "text-amber-600", bg: "bg-amber-50", label: "Pending" },
  running: { icon: Play, color: "text-blue-600", bg: "bg-blue-50", label: "Running" },
  completed: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Failed" },
  timeout: { icon: Timer, color: "text-orange-600", bg: "bg-orange-50", label: "Timeout" },
};

export function RemoteCommands({ assetId, token }: RemoteCommandsProps) {
  const [commandInput, setCommandInput] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<AgentCommand[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isAdmin } = useAuth();

  const fetchHistory = useCallback(() => {
    if (!token || !assetId) return;
    setApiToken(token);
    setLoadingHistory(true);
    getCommandHistory(assetId, 20)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [token, assetId]);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  async function handleSend() {
    const cmd = commandInput.trim();
    if (!cmd || sending) return;
    setSending(true);
    try {
      await sendCommand(assetId, cmd);
      showSuccess("Command sent to agent");
      setCommandInput("");
      fetchHistory();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to send command");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function formatTime(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function formatDuration(start: string | null, end: string | null): string {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Remote Commands</h3>
          {!loadingHistory && history.length > 0 && (
            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {history.length}
            </span>
          )}
        </div>
        <button
          onClick={fetchHistory}
          disabled={loadingHistory}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {loadingHistory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
        </button>
      </div>

      {/* Input */}
      {isAdmin && (
        <div className="border-b border-border">
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="text-xs text-muted-foreground font-mono select-none">$</span>
            <input
              ref={inputRef}
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder="Type a command (e.g. hostname, ipconfig, df -h)..."
              className="flex-1 bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={sending || !commandInput.trim()}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* History */}
      <div className="max-h-[400px] overflow-y-auto">
        {loadingHistory && history.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Terminal className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No commands sent yet</p>
            {isAdmin && (
              <p className="text-xs mt-1">Type a command above to execute on the agent</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {history.map((cmd) => {
              const status = statusConfig[cmd.status];
              const isExpanded = expandedId === cmd.id;
              const hasOutput = cmd.output || cmd.error;
              return (
                <div key={cmd.id} className="transition-colors hover:bg-muted/30">
                  <button
                    onClick={() => hasOutput ? setExpandedId(isExpanded ? null : cmd.id) : undefined}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${status.bg}`}>
                      <status.icon className={`h-3.5 w-3.5 ${status.color}`} />
                    </div>
                    <code className="flex-1 text-xs font-mono text-foreground truncate">
                      {cmd.command}
                    </code>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${status.bg} ${status.color}`}>
                      {status.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono w-16 text-right flex-shrink-0">
                      {formatTime(cmd.started_at || cmd.created_at)}
                    </span>
                    {hasOutput && (
                      isExpanded
                        ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>

                  {isExpanded && hasOutput && (
                    <div className="px-4 pb-3 space-y-2 animate-fade-in">
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                        <span>Created: {formatTime(cmd.created_at)}</span>
                        {cmd.started_at && <span>Started: {formatTime(cmd.started_at)}</span>}
                        {cmd.completed_at && <span>Duration: {formatDuration(cmd.started_at, cmd.completed_at)}</span>}
                        {cmd.exit_code != null && <span>Exit: {cmd.exit_code}</span>}
                      </div>
                      {cmd.output && (
                        <pre className="rounded-lg bg-foreground text-background p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                          {cmd.output}
                        </pre>
                      )}
                      {cmd.error && (
                        <pre className="rounded-lg bg-red-50 text-red-800 border border-red-200 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                          {cmd.error}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}