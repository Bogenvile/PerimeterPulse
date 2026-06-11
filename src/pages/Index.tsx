import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { SystemOverviewCards } from "@/components/dashboard/SystemOverviewCards";
import { AssetListItem } from "@/components/dashboard/AssetListItem";
import { MapView } from "@/components/dashboard/MapView";
import { DeleteAssetDialog } from "@/components/dashboard/DeleteAssetDialog";
import {
  Loader2, AlertCircle, Monitor, MapPin, ChevronRight, ArrowRight,
  Cpu, Activity, TrendingUp, Shield, Globe, Zap, Radio,
  Server, ArrowUpRight, ArrowDownRight, Eye,
  HardDrive, Wifi, Disc, Thermometer, Network,
  ChevronUp, Bell, Search,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAssets, deleteAsset, setApiToken } from "@/lib/api";
import { computeEffectiveStatus } from "@/lib/status";
import { showSuccess, showError } from "@/utils/toast";
import type { ExtendedAsset, DashboardStats, AgentStatus } from "@/lib/types";

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
      .slice(0, 6);
  }, [assets]);

  const statusBreakdown = useMemo(() => {
    return [
      { label: "Online", count: stats.online_count, color: "bg-emerald-500", textColor: "text-emerald-600", bg: "bg-emerald-50" },
      { label: "Warning", count: stats.warning_count, color: "bg-amber-500", textColor: "text-amber-600", bg: "bg-amber-50" },
      { label: "Critical", count: stats.critical_count, color: "bg-red-500", textColor: "text-red-600", bg: "bg-red-50" },
      { label: "Offline", count: stats.offline_count, color: "bg-gray-400", textColor: "text-gray-500", bg: "bg-gray-50" },
    ];
  }, [stats]);

  const topAssets = useMemo(() => {
    return [...assets]
      .sort((a, b) => (b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0) - (a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0))
      .slice(0, 5)
      .map(a => ({
        ...a,
        effectiveStatus: computeEffectiveStatus(a),
      }));
  }, [assets]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-500" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Loading PerimeterPulse...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <p className="text-base font-semibold text-red-600">Connection Failed</p>
        <p className="text-sm text-muted-foreground max-w-xs text-center">{error}</p>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 gap-6">
        <div className="relative">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-50">
            <Radio className="h-12 w-12 text-blue-400" />
          </div>
          <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
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
          <button className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm">
            Deploy Agent
          </button>
          <button
            onClick={() => navigate("/assets")}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-gray-50 transition-colors"
          >
            View Assets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-[1600px] px-4 md:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <Radio className="h-4 w-4 text-white" />
                </div>
                <span className="text-base font-bold text-foreground hidden sm:block">
                  Perimeter<span className="text-blue-600">Pulse</span>
                </span>
              </div>
              <div className="hidden md:flex items-center gap-1 ml-4">
                <NavPill label="Dashboard" active />
                <NavPill label="Assets" onClick={() => navigate("/assets")} />
                <NavPill label="Map" onClick={() => navigate("/map")} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <Search className="h-4 w-4" />
              </button>
              <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <Bell className="h-4 w-4" />
                {(stats.warning_count + stats.critical_count) > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
                )}
              </button>
              <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                <span className="text-xs font-semibold text-gray-600">
                  {(user?.display_name || user?.username || "U").charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="mx-auto max-w-[1600px] px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">
                {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
                Good {getTimeOfDay()}, {user?.display_name || user?.username || "User"}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Here's what's happening with your infrastructure today.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatBadge label="Uptime" value={`${uptimePercent}%`} />
              <StatBadge label="Assets" value={`${assets.length}`} />
              <StatBadge label="Locations" value={`${uniqueCities}`} />
            </div>
          </div>
        </div>

        {/* ── Bento Grid Layout ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* ── Main Stats Card (spans 2 cols on lg) ── */}
          <div className="lg:col-span-2 animate-fade-in-up" style={{ animationDelay: "80ms" }}>
            <GlassCard>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Infrastructure Overview</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total_assets}</p>
                  <p className="text-sm text-gray-400 mt-0.5">Total registered assets</p>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold">{uptimePercent}%</span>
                </div>
              </div>

              {/* Status bars */}
              <div className="space-y-3">
                {statusBreakdown.map((item) => {
                  const pct = stats.total_assets > 0 ? (item.count / stats.total_assets) * 100 : 0;
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="w-16 text-xs font-medium text-gray-500">{item.label}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color} transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-sm font-semibold text-gray-700">{item.count}</span>
                    </div>
                  );
                })}
              </div>

              {/* Quick stats row */}
              <div className="mt-6 grid grid-cols-3 gap-4 pt-5 border-t border-gray-100">
                <QuickStat label="Online" value={stats.online_count} icon={Wifi} color="text-emerald-600" />
                <QuickStat label="Disk Issues" value={stats.disk_issues} icon={Disc} color="text-amber-600" />
                <QuickStat label="Storage" value={totalStorage} icon={Server} color="text-blue-600" />
              </div>
            </GlassCard>
          </div>

          {/* ── Activity / Alerts Card ── */}
          <div className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
            <GlassCard>
              <div className="flex items-center gap-2 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                  <Activity className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Alerts</p>
                  <p className="text-xs text-gray-400">Requires attention</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {stats.warning_count === 0 && stats.critical_count === 0 && stats.disk_issues === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <Shield className="h-8 w-8 mb-2 text-gray-300" />
                    <p className="text-sm font-medium">All systems healthy</p>
                    <p className="text-xs mt-0.5">No alerts at this time</p>
                  </div>
                ) : (
                  <>
                    {stats.critical_count > 0 && (
                      <AlertItem
                        icon={Shield}
                        title={`${stats.critical_count} Critical`}
                        desc="Immediate action required"
                        color="red"
                        onClick={() => navigate("/assets")}
                      />
                    )}
                    {stats.warning_count > 0 && (
                      <AlertItem
                        icon={TrendingUp}
                        title={`${stats.warning_count} Warnings`}
                        desc="High resource usage detected"
                        color="amber"
                        onClick={() => navigate("/assets")}
                      />
                    )}
                    {stats.disk_issues > 0 && (
                      <AlertItem
                        icon={HardDrive}
                        title={`${stats.disk_issues} Disk Issues`}
                        desc="Health degradation detected"
                        color="orange"
                        onClick={() => navigate("/assets")}
                      />
                    )}
                  </>
                )}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* ── Map + Recent Assets ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Map */}
          <div className="lg:col-span-2 animate-fade-in-up" style={{ animationDelay: "160ms" }}>
            <GlassCard noPadding>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                    <MapPin className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Asset Locations</p>
                    <p className="text-xs text-gray-400">
                      {assets.filter((a) => a.last_location_lat != null).length} agents with location data
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/map")}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  Full Map
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <MapView
                assets={effectiveAssets}
                onAssetClick={(a) => navigate(`/assets/${a.id}`)}
                className="h-[360px] md:h-[420px] rounded-none border-0"
              />
            </GlassCard>
          </div>

          {/* Recent Assets */}
          <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
                    <Monitor className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Recent Activity</p>
                    <p className="text-xs text-gray-400">Latest heartbeats</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/assets")}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  View all
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>

              <div className="space-y-2">
                {topAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => navigate(`/assets/${asset.id}`)}
                    className="group flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all hover:bg-gray-50 active:bg-gray-100"
                  >
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${getStatusBg(asset.effectiveStatus)} ring-1 ring-gray-100`}>
                      <Monitor className={`h-4 w-4 ${getStatusColor(asset.effectiveStatus)}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {asset.hostname}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {asset.os} • {asset.wifi_ssid || "No WiFi"}
                      </p>
                    </div>
                    <StatusDot status={asset.effectiveStatus} />
                  </button>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* ── System Overview ── */}
        <div className="animate-fade-in-up" style={{ animationDelay: "240ms" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
                <Cpu className="h-4 w-4 text-sky-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">System Overview</p>
                <p className="text-xs text-gray-400">Aggregate metrics across all agents</p>
              </div>
            </div>
          </div>
          <SystemOverviewCards stats={stats} assets={assets} />
        </div>

        {/* ── Quick Actions ── */}
        <div className="mt-8 animate-fade-in-up" style={{ animationDelay: "280ms" }}>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <ActionCard
              icon={Eye}
              label="View Map"
              desc="See all agents on a live map"
              color="blue"
              onClick={() => navigate("/map")}
            />
            <ActionCard
              icon={Monitor}
              label="Browse Assets"
              desc="Search and filter all devices"
              color="emerald"
              onClick={() => navigate("/assets")}
            />
            {isAdmin && (
              <ActionCard
                icon={Zap}
                label="API Keys"
                desc="Manage agent authentication"
                color="violet"
                onClick={() => navigate("/api-keys")}
              />
            )}
            <ActionCard
              icon={Activity}
              label="System Logs"
              desc="Review error logs and events"
              color="amber"
              onClick={() => navigate("/assets")}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

// ── Sub-components ──

function NavPill({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-gray-100 text-gray-900"
          : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-3 py-1.5 shadow-sm">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-bold text-gray-900">{value}</span>
    </div>
  );
}

function GlassCard({ children, noPadding }: { children: React.ReactNode; noPadding?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {noPadding ? children : <div className="p-5">{children}</div>}
    </div>
  );
}

function QuickStat({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function AlertItem({ icon: Icon, title, desc, color, onClick }: {
  icon: any; title: string; desc: string; color: string; onClick: () => void;
}) {
  const colors: Record<string, { bg: string; iconBg: string; iconColor: string; borderColor: string }> = {
    red: { bg: "bg-red-50", iconBg: "bg-red-100", iconColor: "text-red-600", borderColor: "border-red-100" },
    amber: { bg: "bg-amber-50", iconBg: "bg-amber-100", iconColor: "text-amber-600", borderColor: "border-amber-100" },
    orange: { bg: "bg-orange-50", iconBg: "bg-orange-100", iconColor: "text-orange-600", borderColor: "border-orange-100" },
  };
  const c = colors[color] || colors.red;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border ${c.borderColor} ${c.bg} p-3 transition-all hover:shadow-sm group`}
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.iconBg}`}>
        <Icon className={`h-4 w-4 ${c.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className={`text-xs font-semibold ${c.iconColor}`}>{title}</p>
        <p className="text-[10px] text-gray-500">{desc}</p>
      </div>
      <ChevronRight className={`h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors`} />
    </button>
  );
}

function StatusDot({ status }: { status: AgentStatus }) {
  const colors: Record<AgentStatus, string> = {
    online: "bg-emerald-500",
    offline: "bg-gray-300",
    warning: "bg-amber-500",
    critical: "bg-red-500",
  };
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      {status === "online" && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${colors[status]}`} />
    </span>
  );
}

function getStatusBg(status: AgentStatus): string {
  switch (status) {
    case "online": return "bg-emerald-50";
    case "offline": return "bg-gray-50";
    case "warning": return "bg-amber-50";
    case "critical": return "bg-red-50";
  }
}

function getStatusColor(status: AgentStatus): string {
  switch (status) {
    case "online": return "text-emerald-600";
    case "offline": return "text-gray-400";
    case "warning": return "text-amber-600";
    case "critical": return "text-red-600";
  }
}

function ActionCard({ icon: Icon, label, desc, color, onClick }: {
  icon: any; label: string; desc: string; color: string; onClick: () => void;
}) {
  const colors: Record<string, { bg: string; hoverBg: string; iconBg: string; iconColor: string; borderColor: string }> = {
    blue: { bg: "bg-blue-50/50", hoverBg: "hover:bg-blue-50", iconBg: "bg-blue-100", iconColor: "text-blue-600", borderColor: "hover:border-blue-200" },
    emerald: { bg: "bg-emerald-50/50", hoverBg: "hover:bg-emerald-50", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", borderColor: "hover:border-emerald-200" },
    violet: { bg: "bg-violet-50/50", hoverBg: "hover:bg-violet-50", iconBg: "bg-violet-100", iconColor: "text-violet-600", borderColor: "hover:border-violet-200" },
    amber: { bg: "bg-amber-50/50", hoverBg: "hover:bg-amber-50", iconBg: "bg-amber-100", iconColor: "text-amber-600", borderColor: "hover:border-amber-200" },
  };
  const c = colors[color] || colors.blue;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border border-gray-200 ${c.bg} ${c.hoverBg} ${c.borderColor} p-4 transition-all group text-left`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.iconBg} transition-transform group-hover:scale-105`}>
        <Icon className={`h-5 w-5 ${c.iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{label}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <ArrowRight className={`h-4 w-4 ml-auto ${c.iconColor} opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0`} />
    </button>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export default Index;