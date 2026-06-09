import { Monitor, Wifi, WifiOff, AlertTriangle, Cpu, HardDrive, Disc } from "lucide-react";
import type { DashboardStats } from "@/lib/types";

interface StatsCardsProps {
  stats: DashboardStats;
}

function safePercent(value: number | undefined): string {
  const num = Number(value);
  if (isNaN(num)) return "0.0%";
  return `${num.toFixed(1)}%`;
}

const cards = [
  {
    key: "total" as const,
    label: "Total Assets",
    getValue: (s: DashboardStats) => s.total_assets,
    icon: Monitor,
    gradient: "from-blue-500/20 to-blue-600/5",
    iconColor: "text-blue-400",
    ringColor: "ring-blue-500/20",
  },
  {
    key: "online" as const,
    label: "Online",
    getValue: (s: DashboardStats) => s.online_count,
    icon: Wifi,
    gradient: "from-emerald-500/20 to-emerald-600/5",
    iconColor: "text-emerald-400",
    ringColor: "ring-emerald-500/20",
  },
  {
    key: "offline" as const,
    label: "Offline",
    getValue: (s: DashboardStats) => s.offline_count,
    icon: WifiOff,
    gradient: "from-red-500/20 to-red-600/5",
    iconColor: "text-red-400",
    ringColor: "ring-red-500/20",
  },
  {
    key: "warnings" as const,
    label: "Alerts",
    getValue: (s: DashboardStats) => s.warning_count + s.critical_count,
    icon: AlertTriangle,
    gradient: "from-amber-500/20 to-amber-600/5",
    iconColor: "text-amber-400",
    ringColor: "ring-amber-500/20",
  },
  {
    key: "cpu" as const,
    label: "Avg CPU",
    getValue: (s: DashboardStats) => safePercent(s.avg_cpu_percent),
    icon: Cpu,
    gradient: "from-sky-500/20 to-sky-600/5",
    iconColor: "text-sky-400",
    ringColor: "ring-sky-500/20",
  },
  {
    key: "ram" as const,
    label: "Avg RAM",
    getValue: (s: DashboardStats) => safePercent(s.avg_ram_percent),
    icon: HardDrive,
    gradient: "from-violet-500/20 to-violet-600/5",
    iconColor: "text-violet-400",
    ringColor: "ring-violet-500/20",
  },
  {
    key: "disk" as const,
    label: "Disk Issues",
    getValue: (s: DashboardStats) => s.disk_issues,
    icon: Disc,
    gradient: "from-rose-500/20 to-rose-600/5",
    iconColor: "text-rose-400",
    ringColor: "ring-rose-500/20",
  },
];

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {cards.map((card) => {
        const value = card.getValue(stats);
        const isAlert = card.key === "warnings" && Number(value) > 0;
        const isOffline = card.key === "offline" && Number(value) > 0;

        return (
          <div
            key={card.key}
            className={`relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br ${card.gradient} p-4 transition-all hover:scale-[1.02] hover:border-white/[0.12] ${isAlert || isOffline ? "ring-1 " + card.ringColor : ""}`}
          >
            <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${card.ringColor} bg-white/[0.04]`}>
              <card.icon className={`h-4 w-4 ${card.iconColor}`} />
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {value}
            </p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              {card.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}