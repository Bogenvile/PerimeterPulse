import { AgentStatusBadge } from "./AgentStatusBadge";
import type { ExtendedAsset } from "@/lib/types";

interface AssetListItemProps {
  asset: ExtendedAsset;
  onClick: (asset: ExtendedAsset) => void;
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function AssetListItem({ asset, onClick }: AssetListItemProps) {
  return (
    <button
      onClick={() => onClick(asset)}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
    >
      {/* Avatar */}
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] text-sm font-bold text-muted-foreground group-hover:ring-white/[0.12] transition-all">
        {asset.hostname.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">
            {asset.hostname}
          </p>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {asset.os} · {asset.wifi_ssid || "No WiFi"} · {formatLastSeen(asset.last_seen_at)}
        </p>
      </div>

      {/* Status */}
      <AgentStatusBadge status={asset.status} showLabel={false} size="md" />
    </button>
  );
}