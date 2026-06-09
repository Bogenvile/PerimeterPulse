import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { SystemOverviewCards } from "@/components/dashboard/SystemOverviewCards";
import { AssetListItem } from "@/components/dashboard/AssetListItem";
import { MapView } from "@/components/dashboard/MapView";
import { AgentStatusBadge } from "@/components/dashboard/AgentStatusBadge";
import { DeleteAssetDialog } from "@/components/dashboard/DeleteAssetDialog";
import {
  Loader2, AlertCircle, Monitor, MapPin, ChevronRight, ArrowRight,
  Cpu, Activity, Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAssets, deleteAsset, setApiToken } from "@/lib/api";
import { computeEffectiveStatus } from "@/lib/status";
import { showSuccess, showError } from "@/utils/toast";
import type { ExtendedAsset, DashboardStats } from "@/lib/types";

const Index = () => {
  const { token, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [assets, setAssets] = useState<ExtendedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleDelete = useCallback(async (asset: ExtendedAsset) => {
    setDeletingId(asset.id);
    try {
      await deleteAsset(asset.id);
      showSuccess(`${asset.hostname} deleted`);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/20">
          <AlertCircle className="h-7 w-7 text-red-400" />
        </div>
        <p className="text-sm font-medium text-red-400">Failed to load assets</p>
        <p className="text-xs text-muted-foreground max-w-xs text-center">{error}</p>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 gap-5">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/[0.03] ring-1 ring-white/[0.06]">
          <Monitor className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">No agents connected</p>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
            Deploy the PerimeterPulse agent on your remote PCs and they will appear here automatically.
          </p>
        </div>
      </div>
    );
  }

  const recentlySeen = [...assets]
    .sort((a, b) => {
      const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
      const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 5);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Stats Row */}
      <div className="animate-fade-in-up" style={{ animationDelay: "0ms" }}>
        <StatsCards stats={stats} />
      </div>

      {/* Map Section */}
      <section className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20">
              <MapPin className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Asset Locations</h2>
            <span className="text-xs text-muted-foreground">
              ({assets.filter((a) => a.last_location_lat != null).length} with location)
            </span>
          </div>
          <button
            onClick={() => navigate("/map")}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            Full map
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <MapView
            assets={effectiveAssets}
            onAssetClick={(a) => navigate(`/assets/${a.id}`)}
            className="h-[280px] sm:h-[340px] md:h-[400px] lg:h-[440px] rounded-none border-0"
          />
        </div>
      </section>

      {/* Bottom Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Asset List */}
        <section className="lg:col-span-3 animate-fade-in-up" style={{ animationDelay: "160ms" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <Monitor className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">All Assets</h2>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {assets.length}
              </span>
            </div>
            <button
              onClick={() => navigate("/assets")}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
            {assets.slice(0, 8).map((asset) => (
              <div key={asset.id} className="flex items-center group">
                <div className="flex-1 min-w-0">
                  <AssetListItem
                    asset={asset}
                    onClick={(a) => navigate(`/assets/${a.id}`)}
                  />
                </div>
                {isAdmin && (
                  <div className="pr-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <DeleteAssetDialog
                      hostname={asset.hostname}
                      onConfirm={() => handleDelete(asset)}
                    />
                  </div>
                )}
              </div>
            ))}
            {assets.length > 8 && (
              <button
                onClick={() => navigate("/assets")}
                className="flex w-full items-center justify-center gap-1.5 py-3 text-xs font-medium text-muted-foreground hover:text-blue-400 transition-colors"
              >
                Show all {assets.length} assets
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </section>

        {/* Quick Status Sidebar */}
        <section className="lg:col-span-2 space-y-4 animate-fade-in-up" style={{ animationDelay: "240ms" }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
              <Activity className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Quick Status</h2>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <StatusBar label="Online" count={stats.online_count} total={stats.total_assets} color="bg-emerald-500" textColor="text-emerald-400" />
            <StatusBar label="Offline" count={stats.offline_count} total={stats.total_assets} color="bg-red-500" textColor="text-red-400" />
            <StatusBar label="Warning" count={stats.warning_count} total={stats.total_assets} color="bg-amber-500" textColor="text-amber-400" />
            <StatusBar label="Critical" count={stats.critical_count} total={stats.total_assets} color="bg-orange-500" textColor="text-orange-400" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Recently Seen
            </h3>
            <div className="space-y-2.5">
              {recentlySeen.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => navigate(`/assets/${asset.id}`)}
                  className="flex w-full items-center gap-2.5 text-left group"
                >
                  <AgentStatusBadge status={computeEffectiveStatus(asset)} showLabel={false} size="sm" />
                  <span className="flex-1 truncate text-xs font-medium text-foreground group-hover:text-blue-400 transition-colors">
                    {asset.hostname}
                  </span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatLastSeen(asset.last_seen_at)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* System Overview */}
      <section className="animate-fade-in-up" style={{ animationDelay: "320ms" }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20">
            <Cpu className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">System Overview</h2>
        </div>
        <SystemOverviewCards stats={stats} assets={assets} />
      </section>
    </div>
  );
};

function StatusBar({ label, count, total, color, textColor }: {
  label: string; count: number; total: number; color: string; textColor: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={`text-xs font-bold ${textColor}`}>{count}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default Index;