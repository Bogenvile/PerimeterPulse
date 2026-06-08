import { Card } from "@/components/ui/card";
import { Monitor, Wifi, WifiOff, AlertTriangle, Cpu, HardDrive, Disc } from "lucide-react";
import type { DashboardStats } from "@/lib/types";

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: "Total Assets",
      value: stats.total_assets,
      icon: Monitor,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Online",
      value: stats.online_count,
      icon: Wifi,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Offline",
      value: stats.offline_count,
      icon: WifiOff,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
    },
    {
      label: "Warnings",
      value: stats.warning_count + stats.critical_count,
      icon: AlertTriangle,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
    },
    {
      label: "Avg CPU",
      value: `${stats.avg_cpu_percent.toFixed(1)}%`,
      icon: Cpu,
      color: "text-sky-400",
      bgColor: "bg-sky-500/10",
    },
    {
      label: "Avg RAM",
      value: `${stats.avg_ram_percent.toFixed(1)}%`,
      icon: HardDrive,
      color: "text-violet-400",
      bgColor: "bg-violet-500/10",
    },
    {
      label: "Disk Issues",
      value: stats.disk_issues,
      icon: Disc,
      color: "text-rose-400",
      bgColor: "bg-rose-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      {cards.map((card) => (
        <Card
          key={card.label}
          className="relative overflow-hidden border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-sm transition-colors hover:bg-white/[0.05]"
        >
          <div className="flex flex-col gap-2">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.bgColor}`}
            >
              <card.icon className={`h-4.5 w-4.5 ${card.color}`} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
              <p className="text-xl font-bold tracking-tight">{card.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
