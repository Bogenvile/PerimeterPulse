import { Cpu, HardDrive, Disc, Users, Globe, Activity } from "lucide-react";
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

const items = [
  {
    label: "Agents Reporting",
    icon: Activity,
    getValue: (stats: DashboardStats) => `${stats.online_count}/${stats.total_assets}`,
    sublabel: "online / total",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    label: "Total Storage",
    icon: HardDrive,
    getValue: (_stats: DashboardStats, assets: ExtendedAsset[]) =>
      assets.reduce((s, a) => s + a.storage_total_bytes, 0) > 0
        ? formatBytes(assets.reduce((s, a) => s + a.storage_total_bytes, 0))
        : "N/A",
    sublabel: "across all agents",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
  {
    label: "Disk Issues",
    icon: Disc,
    getValue: (stats: DashboardStats) => stats.disk_issues,
    sublabel: "warning or critical",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    label: "Unique Locations",
    icon: Globe,
    getValue: (_stats: DashboardStats, assets: ExtendedAsset[]) => countUniqueLocations(assets),
    sublabel: "cities detected",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    label: "WiFi Networks",
    icon: Users,
    getValue: (_stats: DashboardStats, assets: ExtendedAsset[]) => countUniqueNetworks(assets),
    sublabel: "unique SSIDs",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
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
    iconBg: "bg-rose-50",
    iconColor: "text-rose-500",
  },
];

export function SystemOverviewCards({ stats, assets }: SystemOverviewCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((item) => {
        const value = item.getValue(stats, assets);
        return (
          <div
            key={item.label}
            className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
          >
            <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${item.iconBg}`}>
              <item.icon className={`h-4 w-4 ${item.iconColor}`} />
            </div>
            <p className="text-lg font-bold tracking-tight text-foreground leading-none">
              {value}
            </p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {item.label}
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
              {item.sublabel}
            </p>
          </div>
        );
      })}
    </div>
  );
}