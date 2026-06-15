import { useState, useEffect, Component, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Error boundary khusus untuk markdown rendering
class MarkdownErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn("[AiMarkdown] Render error, falling back to plain text:", error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface AiMarkdownProps {
  content: string;
}

export function AiMarkdown({ content }: AiMarkdownProps) {
  const [key, setKey] = useState(0);

  // Reset error boundary when content changes
  useEffect(() => {
    setKey((k) => k + 1);
  }, [content]);

  if (!content) return null;

  const trimmed = content.replace(/^\s+/, "").replace(/\s+$/, "");

  const plainFallback = (
    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {trimmed}
    </div>
  );

  return (
    <MarkdownErrorBoundary key={key} fallback={plainFallback}>
      <div className="ai-markdown prose prose-sm dark:prose-invert max-w-none break-words">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children, ...props }) => <h1 className="text-lg font-bold mt-4 mb-2" {...props}>{children}</h1>,
            h2: ({ children, ...props }) => <h2 className="text-base font-semibold mt-3 mb-1.5" {...props}>{children}</h2>,
            h3: ({ children, ...props }) => <h3 className="text-sm font-semibold mt-2 mb-1" {...props}>{children}</h3>,
            p: ({ children, ...props }) => <p className="text-sm leading-relaxed my-1.5" {...props}>{children}</p>,
            strong: ({ children, ...props }) => <strong className="font-semibold" {...props}>{children}</strong>,
            em: ({ children, ...props }) => <em className="italic" {...props}>{children}</em>,
            ul: ({ children, ...props }) => <ul className="list-disc list-outside ml-5 my-2 space-y-1" {...props}>{children}</ul>,
            ol: ({ children, ...props }) => <ol className="list-decimal list-outside ml-5 my-2 space-y-1" {...props}>{children}</ol>,
            li: ({ children, ...props }) => <li className="text-sm leading-relaxed" {...props}>{children}</li>,
            pre: ({ children, ...props }) => (
              <pre className="my-2 rounded-lg bg-foreground/[0.06] border border-border p-3 overflow-x-auto text-xs" {...props}>
                {children}
              </pre>
            ),
            code: ({ children, className, ...props }) => {
              const isBlock = className?.includes("language-");
              if (isBlock) {
                return (
                  <code className={`block text-xs font-mono whitespace-pre ${className || ""}`} {...props}>
                    {children}
                  </code>
                );
              }
              return (
                <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded" {...props}>
                  {children}
                </code>
              );
            },
            blockquote: ({ children, ...props }) => (
              <blockquote className="border-l-2 border-primary pl-3 py-1 my-2 bg-muted/30 rounded-r text-sm" {...props}>
                {children}
              </blockquote>
            ),
            table: ({ children, ...props }) => (
              <div className="overflow-x-auto my-3 rounded-lg border border-border">
                <table className="w-full text-sm" {...props}>{children}</table>
              </div>
            ),
            thead: ({ children, ...props }) => <thead className="bg-muted/50" {...props}>{children}</thead>,
            th: ({ children, ...props }) => (
              <th className="px-3 py-2 text-left font-semibold border-b border-border text-xs" {...props}>{children}</th>
            ),
            td: ({ children, ...props }) => (
              <td className="px-3 py-2 border-b border-border text-xs" {...props}>{children}</td>
            ),
            hr: () => <hr className="my-3 border-border" />,
            a: ({ children, ...props }) => (
              <a className="text-primary underline decoration-primary/30 hover:decoration-primary" target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            ),
          }}
        />
      </div>
    </MarkdownErrorBoundary>
  );
}