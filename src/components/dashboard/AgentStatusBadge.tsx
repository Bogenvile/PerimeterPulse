import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/lib/types";

const statusConfig: Record<
  AgentStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  online: {
    label: "Online",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-400",
  },
  offline: {
    label: "Offline",
    dotClass: "bg-red-500",
    textClass: "text-red-400",
  },
  warning: {
    label: "Warning",
    dotClass: "bg-amber-500",
    textClass: "text-amber-400",
  },
  critical: {
    label: "Critical",
    dotClass: "bg-orange-500",
    textClass: "text-orange-400",
  },
};

interface AgentStatusBadgeProps {
  status: AgentStatus;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function AgentStatusBadge({
  status,
  showLabel = true,
  size = "md",
}: AgentStatusBadgeProps) {
  const config = statusConfig[status];
  const sizeMap = { sm: "h-2 w-2", md: "h-2.5 w-2.5", lg: "h-3 w-3" };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex items-center justify-center">
        <span
          className={cn(
            "rounded-full",
            sizeMap[size],
            config.dotClass,
            status === "online" && "animate-pulse",
          )}
        />
        {status === "online" && (
          <span
            className={cn(
              "absolute rounded-full animate-pulse-ring",
              sizeMap[size],
              "bg-emerald-500/30",
            )}
          />
        )}
      </span>
      {showLabel && (
        <span className={cn("text-sm font-medium", config.textClass)}>
          {config.label}
        </span>
      )}
    </span>
  );
}
