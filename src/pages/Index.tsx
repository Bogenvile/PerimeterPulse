import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { SystemOverviewCards } from "@/components/dashboard/SystemOverviewCards";
import { AssetListItem } from "@/components/dashboard/AssetListItem";
import { MapView } from "@/components/dashboard/MapView";
import { AgentStatusBadge } from "@/components/dashboard/AgentStatusBadge";
import {
  Loader2, AlertCircle, Monitor, MapPin, ChevronRight, ArrowRight,
} from "lucide-react";
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

  return (
    <div className="animate-fade-in space-y-6 p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Stats Row */}
      <StatsCards stats={stats} />

      {/* Map Section - Full width */}
      <section>
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
            assets={assets}
            onAssetClick={(a) => navigate(`/assets/${a.id}`)}
            className="h-[300px] sm:h-[360px] md:h-[420px] rounded-none border-0"
          />
        </div>
      </section>

      {/* Bottom Grid: Asset List + Quick Status Summary */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Asset List - Takes more space */}
        <section className="lg:col-span-3">
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
              <AssetListItem
                key={asset.id}
                asset={asset}
                onClick={(a) => navigate(`/assets/${a.id}`)}
              />
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

        {/* Quick Status Summary - Sidebar */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
              <Activity className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Quick Status</h2>
          </div>

          {/* Status breakdown */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            {/* Online bar */}
            <StatusBar
              label="Online"
              count={stats.online_count}
              total={stats.total_assets}
              color="bg-emerald-500"
              textColor="text-emerald-400"
            />
            {/* Offline bar */}
            <StatusBar
              label="Offline"
              count={stats.offline_count}
              total={stats.total_assets}
              color="bg-red-500"
              textColor="text-red-400"
            />
            {/* Warning bar */}
            <StatusBar
              label="Warning"
              count={stats.warning_count}
              total={stats.total_assets}
              color="bg-amber-500"
              textColor="text-amber-400"
            />
            {/* Critical bar */}
            <StatusBar
              label="Critical"
              count={stats.critical_count}
              total={stats.total_assets}
              color="bg-orange-500"
              textColor="text-orange-400"
            />
          </div>

          {/* Recent activity / last seen */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Recently Seen
            </h3>
            <div className="space-y-2.5">
              {[...assets]
                .sort((a, b) => {
                  const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
                  const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
                  return tb - ta;
                })
                .slice(0, 5)
                .map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => navigate(`/assets/${asset.id}`)}
                    className="flex w-full items-center gap-2.5 text-left group"
                  >
                    <AgentStatusBadge status={asset.status} showLabel={false} size="sm" />
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
      <section>
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

// ──── Sub-components ────

import { Cpu, Activity } from "lucide-react";

function StatusBar({
  label,
  count,
  total,
  color,
  textColor,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  textColor: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={`text-xs font-bold ${textColor}`}>{count}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
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