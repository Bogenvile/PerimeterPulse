import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapView } from "@/components/dashboard/MapView";
import { AssetListItem } from "@/components/dashboard/AssetListItem";
import { SystemOverviewCards } from "@/components/dashboard/SystemOverviewCards";
import {
  Loader2, AlertCircle, Monitor, MapPin, ChevronRight, ArrowRight,
  Wifi, WifiOff, AlertTriangle, Cpu, HardDrive, Disc, Globe, Zap, Radio,
  Bell, ArrowUpRight, ArrowDownRight, Activity,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAssets, deleteAsset, setApiToken } from "@/lib/api";
import { computeEffectiveStatus } from "@/lib/status";
import { showSuccess, showError } from "@/utils/toast";
import type { ExtendedAsset, DashboardStats, AgentStatus } from "@/lib/types";

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
    const interval = setInterval(fetchAssets, 60000); // Auto-refresh every 60s
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

  const uptimePercent = useMemo(() => {
    if (assets.length === 0) return 0;
    return Math.round((stats.online_count / assets.length) * 100);
  }, [assets.length, stats.online_count]);

  const topAssets = useMemo(() => {
    return [...assets]
      .sort((a, b) => (b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0) - (a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0))
      .slice(0, 6)
      .map(a => ({ ...a, effectiveStatus: computeEffectiveStatus(a) }));
  }, [assets]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-500" />
          <p className="text-sm font-medium text-gray-500">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 ring-1 ring-red-100">
          <AlertCircle className="h-6 w-6 text-red-500" />
        </div>
        <p className="text-base font-semibold text-red-600">Connection Failed</p>
        <p className="text-sm text-gray-500 max-w-xs text-center">{error}</p>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 gap-6">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-50 ring-1 ring-blue-100">
            <Radio className="h-10 w-10 text-blue-500" />
          </div>
          <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
            <Zap className="h-3 w-3 text-white" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">No Agents Connected</p>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">
            Deploy the PerimeterPulse agent on your PCs to start monitoring hardware health, locations, and network diagnostics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in p-6 md:p-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Good {getTimeOfDay()}, {user?.display_name || user?.username || "User"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge label="Uptime" value={`${uptimePercent}%`} color="emerald" />
          <Badge label="Total Assets" value={`${stats.total_assets}`} color="blue" />
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Online Agents"
          value={stats.online_count}
          subtitle={`of ${stats.total_assets} total`}
          icon={Wifi}
          color="emerald"
          trend="up"
          trendValue={`${uptimePercent}%`}
        />
        <StatCard
          title="Offline"
          value={stats.offline_count}
          subtitle="unreachable"
          icon={WifiOff}
          color="gray"
          trend="down"
          trendValue={stats.offline_count > 0 ? `${stats.offline_count} agents` : "All good"}
        />
        <StatCard
          title="Warnings / Critical"
          value={stats.warning_count + stats.critical_count}
          subtitle="attention needed"
          icon={AlertTriangle}
          color={stats.warning_count + stats.critical_count > 0 ? "amber" : "gray"}
          trend={stats.warning_count + stats.critical_count > 0 ? "up" : "flat"}
        />
        <StatCard
          title="Disk Issues"
          value={stats.disk_issues}
          subtitle="warning or critical"
          icon={Disc}
          color={stats.disk_issues > 0 ? "red" : "gray"}
          trend={stats.disk_issues > 0 ? "up" : "flat"}
        />
      </div>

      {/* ── Main Grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Map Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Live Asset Map" subtitle="Real-time locations" icon={Globe} action={{ label: "View Full Map", onClick: () => navigate("/map") }}>
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <MapView
                assets={effectiveAssets}
                onAssetClick={(a) => navigate(`/assets/${a.id}`)}
                className="h-[360px] w-full"
              />
            </div>
          </Card>
          
          <SystemOverviewCards stats={stats} assets={assets} />
        </div>

        {/* Recent Activity & Alerts */}
        <div className="space-y-6">
          <Card title="Recent Activity" subtitle="Latest heartbeats" icon={Activity} action={{ label: "View Assets", onClick: () => navigate("/assets") }}>
            <div className="space-y-3 mt-2">
              {topAssets.length === 0 ? (
                <EmptyState icon={Monitor} text="No agents reporting" />
              ) : (
                topAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => navigate(`/assets/${asset.id}`)}
                    className="group flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-all hover:bg-gray-50"
                  >
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ring-1 transition-colors ${getStatusRing(asset.effectiveStatus)}`}>
                      <Monitor className={`h-4 w-4 ${getStatusColor(asset.effectiveStatus)}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-blue-600">
                        {asset.hostname}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {asset.os} • {asset.wifi_ssid || "No WiFi"}
                      </p>
                    </div>
                    <StatusPill status={asset.effectiveStatus} />
                  </button>
                ))
              )}
            </div>
          </Card>
          
          <QuickActionsCard onNavigate={navigate} />
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ──

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

function Badge({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${colors[color] || colors.blue}`}>
      {label}: {value}
    </div>
  );
}

function Card({ title, subtitle, icon: Icon, children, action }: {
  title: string; subtitle: string; icon: any; children: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
            <Icon className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        {action && (
          <button onClick={action.onClick} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
            {action.label} <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color, trend, trendValue }: {
  title: string; value: number; subtitle: string; icon: any; color: string;
  trend?: "up" | "down" | "flat"; trendValue?: string;
}) {
  const colors: Record<string, { bg: string; icon: string; text: string }> = {
    blue: { bg: "bg-blue-50", icon: "text-blue-600", text: "text-blue-600" },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", text: "text-emerald-600" },
    amber: { bg: "bg-amber-50", icon: "text-amber-600", text: "text-amber-600" },
    red: { bg: "bg-red-50", icon: "text-red-600", text: "text-red-600" },
    gray: { bg: "bg-gray-50", icon: "text-gray-500", text: "text-gray-500" },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between mb-4">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${c.bg} ring-1 ring-gray-100`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
        {trendValue && (
          <div className="flex items-center gap-1 text-xs font-semibold">
            {trend === "up" ? <ArrowUpRight className="h-3 w-3 text-emerald-600" /> : trend === "down" ? <ArrowDownRight className="h-3 w-3 text-red-500" /> : <span className="text-gray-400">—</span>}
            <span className={trend === "down" ? "text-red-500" : "text-gray-600"}>{trendValue}</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: AgentStatus }) {
  const colors: Record<AgentStatus, string> = {
    online: "bg-emerald-100 text-emerald-700",
    offline: "bg-gray-100 text-gray-600",
    warning: "bg-amber-100 text-amber-700",
    critical: "bg-red-100 text-red-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${colors[status]}`}>
      {status}
    </span>
  );
}

function getStatusRing(status: AgentStatus): string {
  switch (status) {
    case "online": return "bg-emerald-50 ring-emerald-100";
    case "offline": return "bg-gray-50 ring-gray-100";
    case "warning": return "bg-amber-50 ring-amber-100";
    case "critical": return "bg-red-50 ring-red-100";
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

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
      <Icon className="h-8 w-8 mb-2 text-gray-300" />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

function QuickActionsCard({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
          <Zap className="h-4 w-4 text-violet-600" />
        </div>
        <h3 className="text-sm font-bold text-gray-900">Quick Actions</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ActionButton icon={MapPin} label="View Map" color="blue" onClick={() => onNavigate("/map")} />
        <ActionButton icon={Monitor} label="Assets" color="emerald" onClick={() => onNavigate("/assets")} />
        <ActionButton icon={Bell} label="Logs" color="amber" onClick={() => onNavigate("/assets")} />
        <ActionButton icon={Cpu} label="System" color="violet" onClick={() => onNavigate("/")} />
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, color, onClick }: { icon: any; label: string; color: string; onClick: () => void }) {
  const colors: Record<string, { bg: string; hover: string; icon: string; border: string }> = {
    blue: { bg: "bg-blue-50", hover: "hover:bg-blue-100", icon: "text-blue-600", border: "hover:border-blue-200" },
    emerald: { bg: "bg-emerald-50", hover: "hover:bg-emerald-100", icon: "text-emerald-600", border: "hover:border-emerald-200" },
    amber: { bg: "bg-amber-50", hover: "hover:bg-amber-100", icon: "text-amber-600", border: "hover:border-amber-200" },
    violet: { bg: "bg-violet-50", hover: "hover:bg-violet-100", icon: "text-violet-600", border: "hover:border-violet-200" },
  };
  const c = colors[color] || colors.blue;

  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-2 rounded-lg border border-transparent p-3 transition-all ${c.bg} ${c.hover} ${c.border} group`}>
      <Icon className={`h-5 w-5 ${c.icon} transition-transform group-hover:scale-110`} />
      <span className={`text-xs font-semibold ${c.icon}`}>{label}</span>
    </button>
  );
}

export default Index;