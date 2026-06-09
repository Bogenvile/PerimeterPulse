import { Cpu, HardDrive, Clock, Users, Globe, Activity } from "lucide-react";
import type { ExtendedAsset, DashboardStats } from "@/lib/types";

interface SystemOverviewCardsProps {
  stats: DashboardStats;
  assets: ExtendedAsset[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function countUniqueLocations(assets: ExtendedAsset[]): number {
  const cities = new Set<string>();
  for (const a of assets) {
    if (a.city) cities.add(a.city);
  }
  return cities.size;
}

function countUniqueNetworks(assets: ExtendedAsset[]): number {
  const ssids = new Set<string>();
  for (const a of assets) {
    if (a.wifi_ssid) ssids.add(a.wifi_ssid);
  }
  return ssids.size;
}

const overviewItems = [
  {
    label: "Agents Reporting",
    icon: Activity,
    getValue: (stats: DashboardStats) => `${stats.online_count}/${stats.total_assets}`,
    sublabel: "online / total",
    gradient: "from-blue-500/15 to-transparent",
    iconColor: "text-blue-400",
    ringColor: "ring-blue-500/20",
  },
  {
    label: "Total Storage",
    icon: HardDrive,
    getValue: (_stats: DashboardStats, assets: ExtendedAsset[]) =>
      assets.reduce((s, a) => s + a.storage_total_bytes, 0) > 0
        ? formatBytes(assets.reduce((s, a) => s + a.storage_total_bytes, 0))
        : "N/A",
    sublabel: "across all agents",
    gradient: "from-violet-500/15 to-transparent",
    iconColor: "text-violet-400",
    ringColor: "ring-violet-500/20",
  },
  {
    label: "Disk Issues",
    icon: Clock,
    getValue: (stats: DashboardStats) => stats.disk_issues,
    sublabel: "warning or critical",
    gradient: "from-amber-500/15 to-transparent",
    iconColor: "text-amber-400",
    ringColor: "ring-amber-500/20",
  },
  {
    label: "Unique Locations",
    icon: Globe,
    getValue: (_stats: DashboardStats, assets: ExtendedAsset[]) => countUniqueLocations(assets),
    sublabel: "cities detected",
    gradient: "from-emerald-500/15 to-transparent",
    iconColor: "text-emerald-400",
    ringColor: "ring-emerald-500/20",
  },
  {
    label: "WiFi Networks",
    icon: Users,
    getValue: (_stats: DashboardStats, assets: ExtendedAsset[]) => countUniqueNetworks(assets),
    sublabel: "unique SSIDs",
    gradient: "from-sky-500/15 to-transparent",
    iconColor: "text-sky-400",
    ringColor: "ring-sky-500/20",
  },
  {
    label: "Avg CPU Cores",
    icon: Cpu,
    getValue: (_stats: DashboardStats, assets: ExtendedAsset[]) => {
      if (assets.length === 0) return "N/A";
      const avg = assets.reduce((s, a) => s + a.cpu_cores, 0) / assets.length;
      return avg.toFixed(1);
    },
    sublabel: "per agent",
    gradient: "from-rose-500/15 to-transparent",
    iconColor: "text-rose-400",
    ringColor: "ring-rose-500/20",
  },
];

export function SystemOverviewCards({ stats, assets }: SystemOverviewCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {overviewItems.map((item) => {
        const value = item.getValue(stats, assets);
        return (
          <div
            key={item.label}
            className={`relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br ${item.gradient} p-4 transition-all hover:border-white/[0.12]`}
          >
            <div className={`mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${item.ringColor} bg-white/[0.04]`}>
              <item.icon className={`h-3.5 w-3.5 ${item.iconColor}`} />
            </div>
            <p className="text-lg font-bold tracking-tight text-foreground">
              {value}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground leading-tight">
              {item.label}
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {item.sublabel}
            </p>
          </div>
        );
      })}
    </div>
  );
}