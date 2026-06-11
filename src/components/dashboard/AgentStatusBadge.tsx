import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/lib/types";

const statusConfig: Record<
  AgentStatus,
  { label: string; dotClass: string; pillClass: string }
> = {
  online: {
    label: "Online",
    dotClass: "bg-emerald-500",
    pillClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  offline: {
    label: "Offline",
    dotClass: "bg-gray-400",
    pillClass: "bg-gray-50 text-gray-600 border-gray-200",
  },
  warning: {
    label: "Warning",
    dotClass: "bg-amber-500",
    pillClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  critical: {
    label: "Critical",
    dotClass: "bg-red-500",
    pillClass: "bg-red-50 text-red-700 border-red-200",
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
  const sizeMap = { sm: "h-1.5 w-1.5", md: "h-2 w-2", lg: "h-2.5 w-2.5" };
  const textMap = { sm: "text-[10px] px-1.5 py-0.5", md: "text-[11px] px-2 py-0.5", lg: "text-xs px-2.5 py-1" };

  if (!showLabel) {
    return (
      <span className="relative flex items-center justify-center">
        <span
          className={cn("rounded-full", sizeMap[size], config.dotClass)}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        textMap[size],
        config.pillClass,
      )}
    >
      <span className={cn("rounded-full", sizeMap[size], config.dotClass)} />
      {config.label}
    </span>
  );
}