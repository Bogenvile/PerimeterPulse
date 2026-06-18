package collector

// MetricsPayload represents the full metrics object sent to the server.
// JSON field names MUST match what the server expects in heartbeat.post.ts.
type MetricsPayload struct {
	CPUPerecent         float64 `json:"cpu_percent"`
	RAMPerecent         float64 `json:"ram_percent"`
	RAMUsedBytes        uint64  `json:"ram_used_bytes"`
	RAMTotalBytes       uint64  `json:"ram_total_bytes"`
	StoragePercent      float64 `json:"storage_percent"`
	StorageUsedBytes    uint64  `json:"storage_used_bytes"`
	StorageTotalBytes   uint64  `json:"storage_total_bytes"`
	UptimeSeconds       uint64  `json:"uptime_seconds"`
	NetworkStatus       string  `json:"network_status"`
	NetworkLatencyMs    float64 `json:"network_latency_ms"`
	PingLatencyMs       float64 `json:"ping_latency_ms"`
	ErrorCount          int     `json:"error_count"`
	CPUModel            string  `json:"cpu_model"`
	CPUCores            int     `json:"cpu_cores"`
	DiskType            string  `json:"disk_type"`
	DiskModel           string  `json:"disk_model"`
	DiskHealthStatus    string  `json:"disk_health_status"`
	DiskHealthPercent   float64 `json:"disk_health_percent"`
	DiskTemperatureC    float64 `json:"disk_temperature_c"`
	GatewayReachable    bool    `json:"gateway_reachable"`
	DNSWorking          bool    `json:"dns_working"`
	InternetReachable   bool    `json:"internet_reachable"`
	DefaultGateway      string  `json:"default_gateway"`
	Timestamp           string  `json:"timestamp"`
}

// NetworkPayload represents network info sent to the server.
type NetworkPayload struct {
	WiFiSSID        string   `json:"wifi_ssid"`
	WiFiSignalDBm   float64  `json:"wifi_signal_dbm"`
	NetworkSpeedMbps float64 `json:"network_speed_mbps"`
	IPAddresses     []string `json:"ip_addresses"`
	WiFiIP          string   `json:"wifi_ip"`
	GatewayIP       string   `json:"gateway_ip"`
	MacAddresses    []string `json:"mac_addresses"`
}

// LocationPayload represents location data sent to the server.
type LocationPayload struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	City           string  `json:"city"`
	Country        string  `json:"country"`
	Timestamp      string  `json:"timestamp"`
}

// SystemInfo holds basic system identity.
type SystemInfo struct {
	Hostname     string
	MacAddresses []string
}