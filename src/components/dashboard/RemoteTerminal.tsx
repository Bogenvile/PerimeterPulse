import { useEffect, useState, useRef, useCallback } from "react";
import { Terminal, Send, Loader2, Clock, CheckCircle2, XCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { sendCommand, getCommandHistory, setApiToken } from "@/lib/api";
import { showError } from "@/utils/toast";
import type { AgentCommand, CommandStatus } from "@/lib/types";

interface RemoteTerminalProps {
  assetId: string;
  agentId: string;
  hostname: string;
}

const POLL_INTERVAL = 3000;

const statusConfig: Record<CommandStatus, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
  running: { label: "Running", icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/10" },
  completed: { label: "Done", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  failed: { label: "Failed", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
  timeout: { label: "Timeout", icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10" },
};

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function RemoteTerminal({ assetId, agentId, hostname }: RemoteTerminalProps) {
  const { token, isAdmin } = useAuth();
  const [commands, setCommands] = useState<AgentCommand[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCommands = useCallback(async () => {
    if (!token) return;
    setApiToken(token);
    try {
      const history = await getCommandHistory(assetId, 30);
      setCommands(history.reverse());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, assetId]);

  // Initial fetch
  useEffect(() => {
    fetchCommands();
  }, [fetchCommands]);

  // Auto-scroll
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [commands]);

  // Polling for pending/running commands
  useEffect(() => {
    const hasActive = commands.some((c) => c.status === "pending" || c.status === "running");

    if (hasActive) {
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchCommands, POLL_INTERVAL);
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [commands, fetchCommands]);

  async function handleSend() {
    const cmd = input.trim();
    if (!cmd || sending) return;

    setSending(true);
    setInput("");

    // Optimistically add command to list
    const optimistic: AgentCommand = {
      id: -Date.now(),
      agent_id: agentId,
      command: cmd,
      status: "pending",
      output: null,
      error: null,
      exit_code: null,
      created_by: null,
      created_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
    };
    setCommands((prev) => [...prev, optimistic]);

    try {
      await sendCommand(assetId, cmd);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to send command");
      setCommands((prev) => prev.filter((c) => c.id !== optimistic.id));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
        <Terminal className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Remote terminal requires admin access</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-foreground">Remote Terminal</h3>
          <span className="text-[10px] text-muted-foreground bg-white/[0.06] px-1.5 py-0.5 rounded">
            {hostname}
          </span>
        </div>
        <button
          onClick={fetchCommands}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
          title="Refresh"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>

      {/* Output Area */}
      <div
        ref={outputRef}
        className="min-h-[200px] max-h-[500px] overflow-y-auto p-4 font-mono text-xs leading-relaxed bg-[#0d1117] space-y-3"
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : commands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/60">
            <Terminal className="h-6 w-6 mb-2" />
            <p>No commands executed yet</p>
            <p className="text-[10px] mt-1">Type a command below to get started</p>
          </div>
        ) : (
          commands.map((cmd) => {
            const cfg = statusConfig[cmd.status];
            const StatusIcon = cfg.icon;
            return (
              <div key={cmd.id} className="group">
                {/* Command line */}
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 select-none">$</span>
                  <span className="text-foreground break-all">{cmd.command}</span>
                  <span
                    className={`flex-shrink-0 inline-flex items-center gap-1 ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}
                  >
                    <StatusIcon className={`h-2.5 w-2.5 ${cmd.status === "running" ? "animate-spin" : ""}`} />
                    {cfg.label}
                  </span>
                  <span className="flex-shrink-0 text-[10px] text-muted-foreground/50">
                    {formatTime(cmd.created_at)}
                  </span>
                </div>

                {/* Output */}
                {cmd.output && (
                  <pre className="mt-1.5 ml-4 whitespace-pre-wrap break-words text-slate-300/90 leading-relaxed">
                    {cmd.output}
                  </pre>
                )}

                {/* Error */}
                {cmd.error && (
                  <pre className="mt-1.5 ml-4 whitespace-pre-wrap break-words text-red-400/90 leading-relaxed">
                    {cmd.error}
                  </pre>
                )}

                {/* Exit code for failed commands */}
                {cmd.exit_code != null && cmd.exit_code !== 0 && (
                  <p className="mt-1 ml-4 text-[10px] text-red-400/70">
                    Exit code: {cmd.exit_code}
                  </p>
                )}

                {/* Pending indicator */}
                {cmd.status === "pending" && (
                  <p className="mt-1 ml-4 text-[10px] text-amber-400/60 animate-pulse">
                    Waiting for agent to pick up...
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-white/[0.08] bg-[#0d1117] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-mono text-xs select-none">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sending ? "Sending..." : "Type a command and press Enter..."}
            disabled={sending}
            className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none disabled:opacity-50"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground/40">
          Commands are queued and executed by the agent on its next heartbeat cycle (~60s).
          Results appear here automatically.
        </p>
      </div>
    </div>
  );
}