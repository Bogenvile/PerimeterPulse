import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapView } from "@/components/dashboard/MapView";
import { AssetListItem } from "@/components/dashboard/AssetListItem";
import { SystemOverviewCards } from "@/components/dashboard/SystemOverviewCards";
import { StatsCards } from "@/components/dashboard/StatsCards";
import {
  Loader2, AlertCircle, Monitor, MapPin, ChevronRight,
  Radio, Zap, Activity, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAssets, setApiToken } from "@/lib/api";
import { computeEffectiveStatus } from "@/lib/status";
import type { ExtendedAsset, DashboardStats } from "@/lib/types";

const Index = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<ExtendedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAssets = useCallback(() => {
    if (!token) return;
    setApiToken(token);
    getAssets()
      .then(setAssets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchAssets();
    const interval = setInterval(fetchAssets, 60000);
    return () => clearInterval(interval);
  }, [fetchAssets]);

  const effectiveAssets = useMemo(
    () => assets.map((a) => ({ ...a, status: computeEffectiveStatus(a) })),
    [assets],
  );

  const stats: DashboardStats = useMemo(() => ({
    total_assets: assets.length,
    online_count: effectiveAssets.filter((a) => a.status === "online").length,
    offline_count: effectiveAssets.filter((a) => a.status === "offline").length,
    warning_count: effectiveAssets.filter((a) => a.status === "warning").length,
    critical_count: effectiveAssets.filter((a) => a.status === "critical").length,
    avg_cpu_percent: 0,
    avg_ram_percent: 0,
    disk_issues: assets.filter(
      (a) => a.disk_health_status === "warning" || a.disk_health_status === "critical",
    ).length,
  }), [assets, effectiveAssets]);

  const topAssets = useMemo(() => {
    return [...assets]
      .sort((a, b) => (b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0) - (a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0))
      .slice(0, 8)
      .map(a => ({ ...a, effectiveStatus: computeEffectiveStatus(a) }));
  }, [assets]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm font-medium text-destructive">{error}</p>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Radio className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">No Agents Connected</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">
            Deploy the PerimeterPulse agent on your PCs to start monitoring.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 p-6 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user?.display_name || user?.username || "User"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Zap className="h-4 w-4 text-primary" />
          <span>Live · {stats.online_count} agents online</span>
        </div>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Map */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Asset Map</h3>
            </div>
            <button
              onClick={() => navigate("/map")}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Full Map <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <MapView
            assets={effectiveAssets}
            onAssetClick={(a) => navigate(`/assets/${a.id}`)}
            className="h-[380px] w-full"
          />
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
            </div>
            <button
              onClick={() => navigate("/assets")}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              View All <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="p-2 max-h-[380px] overflow-y-auto">
            {topAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Monitor className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No agents reporting</p>
              </div>
            ) : (
              topAssets.map((asset) => (
                <AssetListItem
                  key={asset.id}
                  asset={asset}
                  onClick={(a) => navigate(`/assets/${a.id}`)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* System Overview */}
      <SystemOverviewCards stats={stats} assets={assets} />
    </div>
  );
};

export default Index;