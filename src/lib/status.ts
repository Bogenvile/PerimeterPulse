import type { ExtendedAsset, AgentStatus } from "./types";

const OFFLINE_THRESHOLD_MINUTES = 5;

export function computeEffectiveStatus(asset: ExtendedAsset): AgentStatus {
  if (!asset.last_seen_at) return "offline";
  const diffMinutes = (Date.now() - new Date(asset.last_seen_at).getTime()) / 60000;
  if (diffMinutes > OFFLINE_THRESHOLD_MINUTES) return "offline";
  return asset.status;
}