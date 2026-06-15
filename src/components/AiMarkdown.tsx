import { Component, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AiMarkdownProps {
  content: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class MarkdownErrorBoundary extends Component<
  { children: ReactNode; fallback: string },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {this.props.fallback}
        </div>
      );
    }
    return this.props.children;
  }
}

export function AiMarkdown({ content }: AiMarkdownProps) {
  if (!content) return null;

  return (
    <MarkdownErrorBoundary fallback={content}>
      <div
        className="ai-markdown text-sm leading-relaxed text-foreground break-words"
        style={{
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-lg font-bold mt-4 mb-2 text-foreground">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-base font-semibold mt-3 mb-1.5 text-foreground">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm font-semibold mt-2 mb-1 text-foreground">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="text-sm leading-relaxed my-1.5 text-foreground">
                {children}
              </p>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic">{children}</em>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-outside ml-5 my-2 space-y-1">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-outside ml-5 my-2 space-y-1">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="text-sm leading-relaxed text-foreground">
                {children}
              </li>
            ),
            code: ({ className, children, ...props }) => {
              const isBlock = className?.includes("language-");
              if (isBlock) {
                return (
                  <code
                    className="block text-xs font-mono bg-foreground/[0.06] border border-border rounded-lg p-3 overflow-x-auto whitespace-pre my-2"
                    {...props}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <code
                  className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            pre: ({ children }) => (
              <pre className="my-2 rounded-lg overflow-hidden">{children}</pre>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-primary pl-3 py-1 my-2 bg-muted/30 rounded-r text-sm">
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto my-3 rounded-lg border border-border">
                <table className="w-full text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-muted/50">{children}</thead>
            ),
            th: ({ children }) => (
              <th className="px-3 py-2 text-left font-semibold text-foreground border-b border-border text-xs">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-3 py-2 text-foreground border-b border-border text-xs">
                {children}
              </td>
            ),
            hr: () => <hr className="my-3 border-border" />,
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline decoration-primary/30 hover:decoration-primary"
              >
                {children}
              </a>
            ),
          }}
        />
      </div>
    </MarkdownErrorBoundary>
  );
}