import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { AgentStatusBadge } from "@/components/dashboard/AgentStatusBadge";
import { MapView } from "@/components/dashboard/MapView";
import { Cpu, HardDrive, Clock, Loader2, AlertCircle, Monitor } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAssets, setApiToken } from "@/lib/api";
import type { ExtendedAsset, DashboardStats } from "@/lib/types";

const Index = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<ExtendedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    setApiToken(token);
    getAssets()
      .then(setAssets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const stats: DashboardStats = {
    total_assets: assets.length,
    online_count: assets.filter((a) => a.status === "online").length,
    offline_count: assets.filter((a) => a.status === "offline").length,
    warning_count: assets.filter((a) => a.status === "warning").length,
    critical_count: assets.filter((a) => a.status === "critical").length,
    avg_cpu_percent: 0,
    avg_ram_percent: 0,
    disk_issues: assets.filter(
      (a) => a.disk_health_status === "warning" || a.disk_health_status === "critical",
    ).length,
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 gap-3">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm text-red-500">Failed to load assets: {error}</p>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 gap-4">
        <Monitor className="h-16 w-16 text-muted-foreground opacity-20" />
        <p className="text-lg font-medium text-muted-foreground">No agents connected</p>
        <p className="text-sm text-muted-foreground max-w-md text-center">
          Deploy the PerimeterPulse agent on your remote PCs and they will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 p-4 md:p-6">
      <StatsCards stats={stats} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden border-border bg-card p-0 shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold text-foreground">Asset Locations</h3>
            <button
              onClick={() => navigate("/map")}
              className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
            >
              Full map →
            </button>
          </div>
          <MapView
            assets={assets}
            onAssetClick={(a) => navigate(`/assets/${a.id}`)}
            className="h-[360px] rounded-none border-0"
          />
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold text-foreground">All Assets</h3>
            <button
              onClick={() => navigate("/assets")}
              className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
            >
              View all →
            </button>
          </div>
          <div className="divide-y divide-border">
            {assets.slice(0, 8).map((asset) => (
              <button
                key={asset.id}
                onClick={() => navigate(`/assets/${asset.id}`)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{asset.hostname}</p>
                  <p className="text-xs text-muted-foreground">
                    {asset.os} • {asset.cpu_model} • WiFi: {asset.wifi_ssid || "N/A"}
                  </p>
                </div>
                <AgentStatusBadge status={asset.status} showLabel={false} size="md" />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card className="border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">System Overview</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <Cpu className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Agents Reporting</p>
              <p className="text-lg font-bold text-foreground">{stats.online_count}/{stats.total_assets}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
              <HardDrive className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Storage</p>
              <p className="text-lg font-bold text-foreground">
                {assets.reduce((s, a) => s + a.storage_total_bytes, 0) > 0
                  ? formatBytes(assets.reduce((s, a) => s + a.storage_total_bytes, 0))
                  : "N/A"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Disk Issues</p>
              <p className="text-lg font-bold text-foreground">{stats.disk_issues}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default Index;