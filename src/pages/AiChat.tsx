import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, Bot, User, Sparkles, Send, AlertCircle, Copy, Check, Wrench } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { setApiToken } from "@/lib/api";
import { AiMarkdown } from "@/components/AiMarkdown";

interface Message {
  role: "user" | "ai";
  content: string;
  isError?: boolean;
  toolCalls?: string[];
}

interface ChatHistory {
  role: string;
  content: string;
}

const suggestedQuestions = [
  "What assets are online right now?",
  "Show me all assets with disk health warnings",
  "Check disk health on all assets",
  "Show me CPU usage across all systems",
];

export default function AiChatPage() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading]);

  const handleSend = useCallback(
    async (content?: string) => {
      const msg = (content || input).trim();
      if (!msg || loading) return;

      const userMessage: Message = { role: "user", content: msg };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setLoading(true);

      try {
        if (token) setApiToken(token);

        const history: ChatHistory[] = updatedMessages.map(m => ({
          role: m.role === "ai" ? "assistant" : "user",
          content: m.content,
        }));

        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: msg, history }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || `Server error: ${res.status}`);
        }

        const data = await res.json();

        let replyText = "";
        if (typeof data === "string") {
          replyText = data;
        } else if (data && typeof data === "object") {
          const r = data as Record<string, unknown>;
          replyText =
            (typeof r.reply === "string" ? r.reply : null) ||
            (typeof r.content === "string" ? r.content : null) ||
            "";
        }
        if (!replyText) replyText = "AI returned an empty response.";

        const toolCalls: string[] | undefined = data?.toolCalls as string[];

        setMessages((prev) => [...prev, { role: "ai", content: replyText, toolCalls }]);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) => [
          ...prev,
          { role: "ai", content: `Error: ${errMsg}`, isError: true },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, token, messages],
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto" ref={chatRef}>
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  AI Infrastructure Assistant
                </h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Ask me anything about your monitored assets. I have access to
                  real-time data.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={`msg-${i}`}
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "ai" && (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0 mt-1">
                  {msg.isError ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Bot className="h-4 w-4 text-primary" />
                  )}
                </div>
              )}

              <div className="max-w-[85%] min-w-0">
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {msg.toolCalls.map((tc, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                        <Wrench className="h-2.5 w-2.5" />
                        {tc}
                      </span>
                    ))}
                  </div>
                )}
                <div
                  className={`rounded-xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : msg.isError
                        ? "bg-destructive/5 border border-destructive/20 text-foreground"
                        : "bg-card border border-border text-foreground"
                  }`}
                >
                  {msg.role === "user" ? (
                    <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                  ) : msg.isError ? (
                    <div className="text-sm text-destructive whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="min-h-[1.5rem]">
                      <AiMarkdown content={msg.content} />
                    </div>
                  )}
                </div>

                {msg.role === "ai" && !msg.isError && msg.content && (
                  <CopyButton text={msg.content} />
                )}
              </div>

              {msg.role === "user" && (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted flex-shrink-0 mt-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="rounded-xl px-4 py-3 bg-card border border-border">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Thinking...
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card p-4">
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about your infrastructure..."
            className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-500" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copy
        </>
      )}
    </button>
  );
}