// ──── User & Auth Types ────

export type UserRole = "admin" | "viewer";

export interface User {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// ──── Agent & Asset Types ────

export type AgentStatus = "online" | "offline" | "warning" | "critical";

export interface ExtendedAgentMetrics {
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
  ping_latency_ms?: number;
  error_count?: number;
  disk_health_status: "ok" | "warning" | "critical" | "unknown";
  disk_health_percent?: number;
  disk_temperature_c: number;
  timestamp: string;
}

export interface AgentLocation {
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  source: "os" | "geoip";
  city?: string;
  country?: string;
  timestamp: string;
}

export interface ExtendedHeartbeatPayload {
  agent_id: string;
  api_key: string;
  hostname?: string;
  metrics: ExtendedAgentMetrics;
  location: AgentLocation;
  network_info: {
    wifi_ssid: string;
    wifi_signal_dbm: number;
    network_speed_mbps: number;
    ip_addresses: string[];
    wifi_ip?: string;
    gateway_ip?: string;
  };
}

export interface ExtendedRegistrationPayload {
  hostname: string;
  os: string;
  os_version: string;
  agent_version: string;
  mac_addresses: string[];
  ip_addresses: string[];
  cpu_model: string;
  cpu_cores: number;
  ram_total_bytes: number;
  storage_total_bytes: number;
  disk_model: string;
  disk_type: "SSD" | "HDD" | "NVMe" | "unknown";
  wifi_ssid: string;
  wifi_signal_dbm: number;
  network_speed_mbps: number;
}

export interface ExtendedAsset {
  id: string;
  agent_id: string;
  hostname: string;
  os: string;
  os_version: string;
  agent_version: string;
  mac_addresses: string[];
  ip_addresses: string[];
  cpu_model: string;
  cpu_cores: number;
  ram_total_bytes: number;
  storage_total_bytes: number;
  disk_model: string;
  disk_type: string;
  disk_health_status: string;
  disk_health_percent: number | null;
  disk_temperature_c: number | null;
  process_list: ProcessInfo[];
  wifi_ssid: string;
  wifi_signal_dbm: number | null;
  wifi_ip: string;
  gateway_ip: string;
  network_speed_mbps: number;
  ping_latency_ms: number | null;
  error_count: number;
  status: AgentStatus;
  last_seen_at: string | null;
  last_location_lat: number | null;
  last_location_lng: number | null;
  city: string;
  country: string;
  tags: string[];
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
  ping_latency_ms?: number;
  error_count?: number;
  disk_health_status?: string;
  disk_health_percent?: number;
  disk_temperature_c?: number;
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
  disk_issues: number;
}

export interface ErrorLogItem {
  id?: number;
  time: string;
  event_id?: number;
  level: string;
  source: string;
  message: string;
  created_at?: string;
}

export interface ApiKeyInfo {
  id: string;
  key_prefix: string;
  label: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

// ──── Remote Command Types ────

export type CommandStatus = "pending" | "running" | "completed" | "failed" | "timeout";

export interface ProcessInfo {
  name: string;
  pid: number;
  cpu: number;
  memory_mb: number;
}

export interface AgentCommand {
  id: number;
  agent_id: string;
  command: string;
  status: CommandStatus;
  output: string | null;
  error: string | null;
  exit_code: number | null;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// ──── App Settings ────

export interface AppSettings {
  openai_api_key?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from?: string;
  email_to?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  notifications_enabled?: string;
}

// ──── User Info (for admin panel) ────

export interface UserInfo {
  id: string;
  username: string;
  display_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}