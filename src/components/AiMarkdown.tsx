import { type ReactNode } from "react";

interface AiMarkdownProps {
  content: string;
}

/**
 * Simple, crash-proof markdown renderer.
 * No external dependencies — parses common markdown inline.
 */
export function AiMarkdown({ content }: AiMarkdownProps) {
  if (!content) return null;

  // Split into blocks by double newline
  const blocks = content.split(/\n{2,}/);

  return (
    <div className="text-sm leading-relaxed text-foreground space-y-2">
      {blocks.map((block, i) => (
        <Block key={i} text={block.trim()} />
      ))}
    </div>
  );
}

function Block({ text }: { text: string }) {
  if (!text) return null;

  // Heading
  if (text.startsWith("### ")) {
    return <h3 className="text-sm font-semibold mt-2 mb-1">{inline(text.slice(4))}</h3>;
  }
  if (text.startsWith("## ")) {
    return <h2 className="text-base font-semibold mt-3 mb-1.5">{inline(text.slice(3))}</h2>;
  }
  if (text.startsWith("# ")) {
    return <h1 className="text-lg font-bold mt-4 mb-2">{inline(text.slice(2))}</h1>;
  }

  // Horizontal rule
  if (/^[-*_]{3,}$/.test(text.trim())) {
    return <hr className="my-3 border-border" />;
  }

  // Blockquote
  if (text.startsWith("> ")) {
    const lines = text.split("\n").map((l) => l.replace(/^>\s?/, ""));
    return (
      <blockquote className="border-l-2 border-primary pl-3 py-1 my-2 bg-muted/30 rounded-r">
        {lines.map((l, i) => (
          <p key={i}>{inline(l)}</p>
        ))}
      </blockquote>
    );
  }

  // Unordered list
  if (/^[-*]\s/.test(text)) {
    const items = text.split("\n").filter((l) => /^[-*]\s/.test(l.trim()));
    return (
      <ul className="list-disc list-outside ml-5 my-1 space-y-0.5">
        {items.map((item, i) => (
          <li key={i}>{inline(item.replace(/^[-*]\s+/, ""))}</li>
        ))}
      </ul>
    );
  }

  // Ordered list
  if (/^\d+\.\s/.test(text)) {
    const items = text.split("\n").filter((l) => /^\d+\.\s/.test(l.trim()));
    return (
      <ol className="list-decimal list-outside ml-5 my-1 space-y-0.5">
        {items.map((item, i) => (
          <li key={i}>{inline(item.replace(/^\d+\.\s+/, ""))}</li>
        ))}
      </ol>
    );
  }

  // Code block
  if (text.startsWith("```")) {
    const lines = text.split("\n");
    // Remove first and last ``` lines
    const codeLines = lines.slice(1, lines[lines.length - 1]?.trim() === "```" ? -1 : undefined);
    return (
      <pre className="my-2 rounded-lg bg-foreground/[0.06] border border-border p-3 overflow-x-auto">
        <code className="text-xs font-mono whitespace-pre">{codeLines.join("\n")}</code>
      </pre>
    );
  }

  // Table (simple)
  if (text.includes("|") && text.split("\n").length >= 2) {
    const rows = text.split("\n").filter((l) => l.trim().startsWith("|"));
    if (rows.length >= 2) {
      // Check if second row is separator (---|---)
      const isTable = /^\|[\s-:|]+\|$/.test(rows[1]?.trim() || "");
      if (isTable) {
        const headerCells = parseTableRow(rows[0]);
        const bodyRows = rows.slice(2);
        return (
          <div className="overflow-x-auto my-3 rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {headerCells.map((cell, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold border-b border-border text-xs">
                      {inline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => {
                  const cells = parseTableRow(row);
                  return (
                    <tr key={ri}>
                      {cells.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 border-b border-border text-xs">
                          {inline(cell)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
    }
  }

  // Regular paragraph — split single newlines into <br>
  const lines = text.split("\n");
  return (
    <p>
      {lines.map((line, i) => (
        <span key={i}>
          {inline(line)}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </p>
  );
}

/** Parse inline markdown: bold, italic, code, links */
function inline(text: string): ReactNode {
  if (!text) return null;

  // Regex to match: **bold**, *italic*, `code`, [text](url), ~~strike~~
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Try each pattern
    const match = remaining.match(
      /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|~~(.+?)~~/
    );

    if (!match) {
      parts.push(remaining);
      break;
    }

    const idx = match.index!;
    if (idx > 0) {
      parts.push(remaining.slice(0, idx));
    }

    if (match[1] !== undefined) {
      // **bold**
      parts.push(<strong key={key++} className="font-semibold">{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      // *italic*
      parts.push(<em key={key++} className="italic">{match[2]}</em>);
    } else if (match[3] !== undefined) {
      // `code`
      parts.push(
        <code key={key++} className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
          {match[3]}
        </code>
      );
    } else if (match[4] !== undefined && match[5] !== undefined) {
      // [text](url)
      parts.push(
        <a
          key={key++}
          href={match[5]}
          className="text-primary underline decoration-primary/30 hover:decoration-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[4]}
        </a>
      );
    } else if (match[6] !== undefined) {
      // ~~strike~~
      parts.push(<del key={key++}>{match[6]}</del>);
    }

    remaining = remaining.slice(idx + match[0].length);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function parseTableRow(row: string): string[] {
  return row
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}