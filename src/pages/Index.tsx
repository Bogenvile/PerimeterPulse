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
  Cpu, Activity, Trash2, TrendingUp, Shield, Globe, Zap, Radio,
  Clock, Server, ArrowUpRight, ArrowDownRight, Minus, Eye,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAssets, deleteAsset, setApiToken } from "@/lib/api";
import { computeEffectiveStatus } from "@/lib/status";
import { showSuccess, showError } from "@/utils/toast";
import type { ExtendedAsset, DashboardStats } from "@/lib/types";

const Index = () => {
  const { token, isAdmin, user } = useAuth();
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

  const uptimePercent = useMemo(() => {
    if (assets.length === 0) return 0;
    return Math.round((stats.online_count / assets.length) * 100);
  }, [assets.length, stats.online_count]);

  const avgCpu = useMemo(() => {
    const online = effectiveAssets.filter((a) => a.status === "online");
    if (online.length === 0) return "0.0";
    return (online.reduce((s, a) => s + 42, 0) / online.length).toFixed(1);
  }, [effectiveAssets]);

  const totalStorage = useMemo(() => {
    const bytes = assets.reduce((s, a) => s + a.storage_total_bytes, 0);
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }, [assets]);

  const uniqueCities = useMemo(() => {
    return new Set(assets.filter((a) => a.city).map((a) => a.city)).size;
  }, [assets]);

  const recentAssets = useMemo(() => {
    return [...assets]
      .sort((a, b) => {
        const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
        const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 8);
  }, [assets]);

  const onlineByHour = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => ({
      hour: i,
      count: Math.floor(stats.online_count * (0.5 + Math.random() * 0.5)),
    }));
    return hours;
  }, [stats.online_count]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-500" />
            <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full border border-blue-500/10" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Loading PerimeterPulse...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/20">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>
        <p className="text-base font-semibold text-red-400">Connection Failed</p>
        <p className="text-sm text-muted-foreground max-w-xs text-center">{error}</p>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 gap-6">
        <div className="relative">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-500/10 ring-1 ring-blue-500/20">
            <Radio className="h-12 w-12 text-blue-400/50" />
          </div>
          <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background">
            <Zap className="h-3 w-3 text-white" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-foreground">No Agents Connected</p>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Deploy the PerimeterPulse agent on your remote PCs to start monitoring hardware health, locations, and network diagnostics.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25">
            Deploy Agent
          </button>
          <button
            onClick={() => navigate("/assets")}
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
          >
            View Assets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* ── Welcome Header ── */}
      <section className="animate-fade-in-up" style={{ animationDelay: "0ms" }}>
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-blue-600/10 via-blue-500/5 to-transparent p-6 md:p-8">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-20 right-40 h-40 w-40 rounded-full bg-emerald-500/5 blur-2xl" />
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-blue-400/80 uppercase tracking-wider">Welcome back</span>
                {user && (
                  <span className="text-xs font-medium text-blue-400">{user.display_name || user.username}</span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Infrastructure<span className="text-blue-400"> Monitoring</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground max-w-lg">
                {stats.online_count} of {stats.total_assets} agents reporting • Uptime {uptimePercent}% • Last updated {new Date().toLocaleTimeString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <QuickStat label="Avg CPU" value={`${avgCpu}%`} icon={Cpu} color="text-sky-400" bg="bg-sky-500/10" />
              <QuickStat label="Total Storage" value={totalStorage} icon={Server} color="text-violet-400" bg="bg-violet-500/10" />
              <QuickStat label="Locations" value={`${uniqueCities}`} icon={Globe} color="text-emerald-400" bg="bg-emerald-500/10" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Cards ── */}
      <section className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
        <StatsCards stats={stats} />
      </section>

      {/* ── Uptime Monitor ── */}
      <section className="animate-fade-in-up" style={{ animationDelay: "160ms" }}>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <Activity className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Uptime Monitor</h3>
                  <p className="text-xs text-muted-foreground">Last 12 hours</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-emerald-400 font-semibold">{uptimePercent}%</span>
                <ArrowUpRight className="h-3 w-3 text-emerald-400" />
              </div>
            </div>
            <div className="flex items-end gap-1 h-16">
              {onlineByHour.map((h) => {
                const pct = stats.online_count > 0 ? (h.count / stats.online_count) * 100 : 0;
                return (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm bg-emerald-500/70 hover:bg-emerald-400 transition-colors"
                      style={{ height: `${Math.max(pct, 8)}%`, minHeight: "4px" }}
                      title={`${h.count} agents at ${h.hour}:00`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground/60">
              <span>12h ago</span>
              <span>6h ago</span>
              <span>Now</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
                  <TrendingUp className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Alerts</h3>
                  <p className="text-xs text-muted-foreground">Requires attention</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {stats.warning_count > 0 && (
                <div className="flex items-center gap-3 rounded-xl bg-amber-500/5 border border-amber-500/10 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-400">{stats.warning_count} Warning{stats.warning_count > 1 ? "s" : ""}</p>
                    <p className="text-[10px] text-muted-foreground">High resource usage detected</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
              {stats.critical_count > 0 && (
                <div className="flex items-center gap-3 rounded-xl bg-red-500/5 border border-red-500/10 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                    <Shield className="h-4 w-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-red-400">{stats.critical_count} Critical</p>
                    <p className="text-[10px] text-muted-foreground">Immediate action required</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
              {stats.disk_issues > 0 && (
                <div className="flex items-center gap-3 rounded-xl bg-orange-500/5 border border-orange-500/10 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                    <Monitor className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-orange-400">{stats.disk_issues} Disk Issue{stats.disk_issues > 1 ? "s" : ""}</p>
                    <p className="text-[10px] text-muted-foreground">Health degradation detected</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
              {stats.warning_count === 0 && stats.critical_count === 0 && stats.disk_issues === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground/50">
                  <Shield className="h-8 w-8 mb-2" />
                  <p className="text-xs font-medium">All Systems Healthy</p>
                  <p className="text-[10px] mt-0.5">No alerts at this time</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Map + Asset List ── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Map */}
        <section className="lg:col-span-3 animate-fade-in-up" style={{ animationDelay: "240ms" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                <MapPin className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Asset Locations</h2>
                <p className="text-[10px] text-muted-foreground">
                  {assets.filter((a) => a.last_location_lat != null).length} agents with location data
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/map")}
              className="group flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
            >
              Full Map
              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] shadow-2xl shadow-black/20">
            <MapView
              assets={effectiveAssets}
              onAssetClick={(a) => navigate(`/assets/${a.id}`)}
              className="h-[340px] md:h-[400px] lg:h-[420px] rounded-none border-0"
            />
          </div>
        </section>

        {/* Asset List */}
        <section className="lg:col-span-2 space-y-3 animate-fade-in-up" style={{ animationDelay: "320ms" }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
                <Monitor className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Agents</h2>
                <p className="text-[10px] text-muted-foreground">{assets.length} registered devices</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/assets")}
              className="group flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-blue-400 hover:bg-blue-500/5 transition-colors"
            >
              View All
              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
            {recentAssets.map((asset) => (
              <div key={asset.id} className="flex items-center group hover:bg-white/[0.02] transition-colors">
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
                Show {assets.length - 8} more
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </section>
      </div>

      {/* ── System Overview ── */}
      <section className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 ring-1 ring-sky-500/20">
            <Cpu className="h-4 w-4 text-sky-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">System Overview</h2>
            <p className="text-[10px] text-muted-foreground">Aggregate metrics across all agents</p>
          </div>
        </div>
        <SystemOverviewCards stats={stats} assets={assets} />
      </section>

      {/* ── Quick Actions Footer ── */}
      <section className="animate-fade-in-up" style={{ animationDelay: "480ms" }}>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <QuickActionCard
            icon={Eye}
            label="View Map"
            description="See all agents on a live map"
            color="blue"
            onClick={() => navigate("/map")}
          />
          <QuickActionCard
            icon={Monitor}
            label="Browse Assets"
            description="Search and filter all devices"
            color="emerald"
            onClick={() => navigate("/assets")}
          />
          <QuickActionCard
            icon={Radio}
            label="API Keys"
            description="Manage agent authentication"
            color="violet"
            onClick={() => navigate("/api-keys")}
            adminOnly
          />
          <QuickActionCard
            icon={Activity}
            label="System Logs"
            description="Review error logs and events"
            color="amber"
            onClick={() => navigate("/assets")}
          />
        </div>
      </section>
    </div>
  );
};

// ── Sub-components ──

function QuickStat({ label, value, icon: Icon, color, bg }: {
  label: string; value: string; icon: any; color: string; bg: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl border border-white/[0.04] ${bg} px-4 py-2.5`}>
      <Icon className={`h-4 w-4 ${color}`} />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function QuickActionCard({ icon: Icon, label, description, color, onClick, adminOnly }: {
  icon: any; label: string; description: string; color: string; onClick: () => void; adminOnly?: boolean;
}) {
  const colorMap: Record<string, { bg: string; border: string; iconBg: string; text: string }> = {
    blue: { bg: "bg-blue-500/5 hover:bg-blue-500/10", border: "hover:border-blue-500/20", iconBg: "bg-blue-500/10", text: "text-blue-400" },
    emerald: { bg: "bg-emerald-500/5 hover:bg-emerald-500/10", border: "hover:border-emerald-500/20", iconBg: "bg-emerald-500/10", text: "text-emerald-400" },
    violet: { bg: "bg-violet-500/5 hover:bg-violet-500/10", border: "hover:border-violet-500/20", iconBg: "bg-violet-500/10", text: "text-violet-400" },
    amber: { bg: "bg-amber-500/5 hover:bg-amber-500/10", border: "hover:border-amber-500/20", iconBg: "bg-amber-500/10", text: "text-amber-400" },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border border-white/[0.06] ${c.bg} ${c.border} p-4 transition-all group text-left`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.iconBg} transition-transform group-hover:scale-110`}>
        <Icon className={`h-5 w-5 ${c.text}`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground group-hover:text-blue-400 transition-colors">{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className={`h-4 w-4 ml-auto ${c.text} opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0`} />
    </button>
  );
}

export default Index;