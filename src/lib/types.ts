// ──── Agent & Asset Types ────

export type AgentStatus = "online" | "offline" | "warning" | "critical";

export interface AgentMetrics {
  cpu_percent: number;
  ram_percent: number;
  ram_used_bytes: number;
  ram_total_bytes: number;
  storage_percent: number;
  storage_used_bytes: number;
  storage_total_bytes: number;
  uptime_seconds: number;
  network_status: "up" | "down" | "degraded";
  network_latency_ms: number;
  timestamp: string; // ISO 8601
}

export interface AgentLocation {
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  source: "os" | "geoip";
  timestamp: string;
}

export interface AgentHeartbeatPayload {
  agent_id: string;
  api_key: string;
  metrics: AgentMetrics;
  location: AgentLocation;
}

export interface AgentRegistrationPayload {
  hostname: string;
  os: string;
  os_version: string;
  agent_version: string;
  mac_addresses: string[];
  cpu_model: string;
  ram_total_bytes: number;
  storage_total_bytes: number;
}

export interface Asset {
  id: string;
  agent_id: string;
  hostname: string;
  os: string;
  os_version: string;
  agent_version: string;
  mac_addresses: string[];
  cpu_model: string;
  ram_total_bytes: number;
  storage_total_bytes: number;
  status: AgentStatus;
  last_seen_at: string | null;
  last_location_lat: number | null;
  last_location_lng: number | null;
  created_at: string;
  updated_at: string;
}

export interface MetricsDataPoint {
  time: string;
  cpu_percent: number;
  ram_percent: number;
  storage_percent: number;
  network_status: string;
  network_latency_ms: number;
}

export interface LocationDataPoint {
  time: string;
  latitude: number;
  longitude: number;
  source: string;
}

export interface DashboardStats {
  total_assets: number;
  online_count: number;
  offline_count: number;
  warning_count: number;
  critical_count: number;
  avg_cpu_percent: number;
  avg_ram_percent: number;
}
