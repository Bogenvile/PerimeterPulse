import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  lines?: number;
}

export function SkeletonCard({ className, lines = 3 }: SkeletonCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 animate-pulse", className)}>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-2 w-16 rounded bg-muted" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-2.5 rounded bg-muted"
          style={{ width: `${60 + Math.random() * 40}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted mb-3" />
      <div className="h-7 w-16 rounded bg-muted mb-1.5" />
      <div className="h-2.5 w-20 rounded bg-muted" />
    </div>
  );
}

export function SkeletonList({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5 animate-pulse">
          <div className="h-9 w-9 rounded-lg bg-muted flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-32 rounded bg-muted" />
            <div className="h-2 w-20 rounded bg-muted" />
          </div>
          <div className="h-2 w-2 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
      <div className="h-11 border-b border-border bg-muted/30 flex items-center px-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-2.5 rounded bg-muted" style={{ width: `${15 + i * 5}%` }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 border-b border-border last:border-0 flex items-center px-5 gap-4">
          {[1, 2, 3, 4, 5].map((j) => (
            <div key={j} className="h-2.5 rounded bg-muted" style={{ width: `${12 + j * 6 + (i % 3) * 3}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}