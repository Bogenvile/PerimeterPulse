import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapView } from "@/components/dashboard/MapView";
import { AssetListItem } from "@/components/dashboard/AssetListItem";
import { SystemOverviewCards } from "@/components/dashboard/SystemOverviewCards";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { SkeletonStatCard, SkeletonList } from "@/components/ui/skeleton-card";
import {
  Loader2, AlertCircle, Monitor, MapPin, ChevronRight,
  Radio, Activity, ArrowRight, Shield,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAssets, setApiToken } from "@/lib/api";
import { computeEffectiveStatus } from "@/lib/status";
import type { ExtendedAsset, DashboardStats } from "@/lib/types";

function StaggerItem({ children, index }: { children: React.ReactNode; index: number }) {
  return (
    <div
      className="animate-fade-in-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {children}
    </div>
  );
}

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
    avg_disk_health: assets.length > 0
      ? assets.reduce((sum, a) => sum + (a.disk_health_percent ?? 100), 0) / assets.length
      : 100,
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

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm font-medium text-destructive">{error}</p>
      </div>
    );
  }

  if (assets.length === 0 && !loading) {
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
    <div className="space-y-6 p-6 md:p-8">
      {/* Welcome Banner */}
      <StaggerItem index={0}>
        <div className="relative overflow-hidden rounded-xl border border-border bg-card">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-primary/3 rounded-full translate-y-1/2" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 md:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">
                  {greeting()}, {user?.display_name || user?.username || "User"}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {loading
                    ? "Loading your infrastructure overview..."
                    : `You have ${stats.online_count} of ${stats.total_assets} agents online${stats.critical_count > 0 ? ` · ${stats.critical_count} critical alert${stats.critical_count > 1 ? "s" : ""}` : ""}`
                  }
                </p>
              </div>
            </div>
            {!loading && stats.online_count > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-emerald-700">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-xs font-semibold">{stats.online_count} Online</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </StaggerItem>

      {/* Stats */}
      <StaggerItem index={1}>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, i) => <SkeletonStatCard key={i} />)}
          </div>
        ) : (
          <StatsCards stats={stats} />
        )}
      </StaggerItem>

      {/* Main Grid */}
      <StaggerItem index={2}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Map */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
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
            {loading ? (
              <div className="h-[380px] flex items-center justify-center bg-muted/20">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <MapView
                assets={effectiveAssets}
                onAssetClick={(a) => navigate(`/assets/${a.id}`)}
                className="h-[380px] w-full"
              />
            )}
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
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
            {loading ? (
              <SkeletonList items={5} />
            ) : (
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
            )}
          </div>
        </div>
      </StaggerItem>

      {/* System Overview */}
      <StaggerItem index={3}>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonStatCard key={i} />)}
          </div>
        ) : (
          <SystemOverviewCards stats={stats} assets={assets} />
        )}
      </StaggerItem>
    </div>
  );
};

export default Index;