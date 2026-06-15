import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AiMarkdownProps {
  content: string;
}

export function AiMarkdown({ content }: AiMarkdownProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words
      prose-p:leading-relaxed prose-p:my-1.5
      prose-headings:my-2 prose-headings:font-semibold
      prose-ul:my-1.5 prose-ol:my-1.5
      prose-li:my-0.5 prose-li:text-sm
      prose-code:text-xs prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-code:font-mono prose-code:text-foreground
      prose-pre:bg-foreground/5 prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-3 prose-pre:overflow-x-auto
      prose-pre:code:bg-transparent prose-pre:code:p-0
      prose-table:text-sm prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2
      prose-th:border prose-th:border-border prose-td:border prose-td:border-border
      prose-th:bg-muted/50 prose-th:font-semibold
      prose-strong:text-foreground prose-strong:font-semibold
      prose-a:text-primary prose-a:underline prose-a:decoration-primary/30 hover:prose-a:decoration-primary
      prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:pr-3
      prose-hr:border-border
    ">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-border">
              <table {...props}>{children}</table>
            </div>
          ),
          pre: ({ children, ...props }) => (
            <pre {...props} className="relative group">
              {children}
            </pre>
          ),
          code: ({ children, className, ...props }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-foreground" {...props}>
                {children}
              </code>
            );
          },
          ul: ({ children, ...props }) => (
            <ul className="list-disc list-outside ml-4 space-y-1" {...props}>{children}</ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal list-outside ml-4 space-y-1" {...props}>{children}</ol>
          ),
          li: ({ children, ...props }) => (
            <li className="text-sm leading-relaxed" {...props}>{children}</li>
          ),
          h1: ({ children, ...props }) => (
            <h1 className="text-lg font-bold mt-4 mb-2" {...props}>{children}</h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-base font-semibold mt-3 mb-1.5" {...props}>{children}</h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-sm font-semibold mt-2.5 mb-1" {...props}>{children}</h3>
          ),
          p: ({ children, ...props }) => (
            <p className="text-sm leading-relaxed my-1.5" {...props}>{children}</p>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote className="border-l-2 border-primary pl-3 py-1 my-2 bg-muted/30 rounded-r" {...props}>{children}</blockquote>
          ),
          hr: ({ ...props }) => (
            <hr className="my-3 border-border" {...props} />
          ),
          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-foreground" {...props}>{children}</strong>
          ),
        }}
      />
    </div>
  );
}