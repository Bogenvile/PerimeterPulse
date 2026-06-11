import { AgentStatusBadge } from "./AgentStatusBadge";
import { computeEffectiveStatus } from "@/lib/status";
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
  const effectiveStatus = computeEffectiveStatus(asset);

  return (
    <button
      onClick={() => onClick(asset)}
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-foreground">
        {asset.hostname.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          {asset.hostname}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {asset.os} · {formatLastSeen(asset.last_seen_at)}
        </p>
      </div>
      <AgentStatusBadge status={effectiveStatus} showLabel={false} size="md" />
    </button>
  );
}