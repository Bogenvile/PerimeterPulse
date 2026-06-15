import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, Bot, User, Sparkles, Send, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { sendAiMessage, setApiToken } from "@/lib/api";
import { AiMarkdown } from "@/components/AiMarkdown";

interface Message {
  role: "user" | "ai";
  content: string;
  isError?: boolean;
}

const suggestedQuestions = [
  "Which assets are currently online?",
  "Show me all assets with critical status",
  "What's the average CPU usage across all assets?",
  "Any disk health warnings I should know about?",
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

      setMessages((prev) => [...prev, { role: "user", content: msg }]);
      setInput("");
      setLoading(true);

      try {
        if (token) setApiToken(token);
        const response = await sendAiMessage(msg);
        const reply = response?.reply || "No response received from AI.";
        setMessages((prev) => [...prev, { role: "ai", content: reply }]);
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "Unknown error occurred";
        setMessages((prev) => [
          ...prev,
          { role: "ai", content: `⚠️ ${errMsg}`, isError: true },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, token],
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
              key={i}
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

              <div
                className={`rounded-xl px-4 py-3 max-w-[85%] min-w-0 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : msg.isError
                      ? "bg-destructive/5 border border-destructive/20 text-foreground"
                      : "bg-card border border-border text-foreground"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                ) : (
                  <AiMarkdown content={msg.content} />
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
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}