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
    key: "total",
    label: "Total Assets",
    getValue: (s: DashboardStats) => s.total_assets,
    icon: Monitor,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    key: "online",
    label: "Online",
    getValue: (s: DashboardStats) => s.online_count,
    icon: Wifi,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    key: "offline",
    label: "Offline",
    getValue: (s: DashboardStats) => s.offline_count,
    icon: WifiOff,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-500",
  },
  {
    key: "alerts",
    label: "Alerts",
    getValue: (s: DashboardStats) => s.warning_count + s.critical_count,
    icon: AlertTriangle,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    key: "cpu",
    label: "Avg CPU",
    getValue: (s: DashboardStats) => safePercent(s.avg_cpu_percent),
    icon: Cpu,
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
  },
  {
    key: "ram",
    label: "Avg RAM",
    getValue: (s: DashboardStats) => safePercent(s.avg_ram_percent),
    icon: HardDrive,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
  {
    key: "disk",
    label: "Disk Issues",
    getValue: (s: DashboardStats) => s.disk_issues,
    icon: Disc,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
  },
];

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      {cards.map((card) => {
        const value = card.getValue(stats);
        return (
          <div
            key={card.key}
            className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBg}`}>
                <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
              {value}
            </p>
            <p className="mt-1.5 text-xs font-medium text-muted-foreground">
              {card.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}