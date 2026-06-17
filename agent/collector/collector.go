package collector

// SystemInfo contains basic system information collected from the host
type SystemInfo struct {
	Hostname         string   `json:"hostname"`
	MACAddresses     []string `json:"mac_addresses"`
	IPAddresses      []string `json:"ip_addresses"`
	CPUModel         string   `json:"cpu_model"`
	CPUCores         int      `json:"cpu_cores"`
	RAMTotalBytes    int64    `json:"ram_total_bytes"`
	StorageTotalBytes int64   `json:"storage_total_bytes"`
	DiskModel        string   `json:"disk_model"`
	DiskType         string   `json:"disk_type"`
	WiFiSSID         string   `json:"wifi_ssid"`
	WiFiSignalDBM    int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps float64  `json:"network_speed_mbps"`
}

// RegistrationPayload is sent during agent registration
type RegistrationPayload struct {
	ApiKey            string   `json:"api_key"`
	AgentID           string   `json:"agent_id"`
	Hostname          string   `json:"hostname"`
	OS                string   `json:"os"`
	OSVersion         string   `json:"os_version"`
	AgentVersion      string   `json:"agent_version"`
	MACAddresses      []string `json:"mac_addresses"`
	IPAddresses       []string `json:"ip_addresses"`
	CPUModel          string   `json:"cpu_model"`
	CPUCores          int      `json:"cpu_cores"`
	RAMTotalBytes     int64    `json:"ram_total_bytes"`
	StorageTotalBytes int64    `json:"storage_total_bytes"`
	DiskModel         string   `json:"disk_model"`
	DiskType          string   `json:"disk_type"`
	WiFiSSID          string   `json:"wifi_ssid"`
	WiFiSignalDBM     int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps  float64  `json:"network_speed_mbps"`
}

// OSInfo contains OS-specific identification
type OSInfo struct {
	OS        string `json:"os"`
	OSVersion string `json:"os_version"`
}

// MetricsData holds system performance metrics
type MetricsData struct {
	CPUPercent        float64 `json:"cpu_percent"`
	RAMPercent        float64 `json:"ram_percent"`
	RAMUsedBytes      int64   `json:"ram_used_bytes"`
	RAMTotalBytes     int64   `json:"ram_total_bytes"`
	StoragePercent    float64 `json:"storage_percent"`
	StorageUsedBytes  int64   `json:"storage_used_bytes"`
	StorageTotalBytes int64   `json:"storage_total_bytes"`
	UptimeSeconds     int64   `json:"uptime_seconds"`
	NetworkStatus     string  `json:"network_status"`
	NetworkLatencyMS  float64 `json:"network_latency_ms"`
	DiskHealthStatus  string  `json:"disk_health_status"`
	DiskTemperatureC  float64 `json:"disk_temperature_c"`
	Timestamp         string  `json:"timestamp"`
}

// NetworkInfo holds network-related information
type NetworkInfo struct {
	WiFiSSID        string   `json:"wifi_ssid"`
	WiFiSignalDBM   int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps float64 `json:"network_speed_mbps"`
	IPAddresses     []string `json:"ip_addresses"`
	WifiIP          string   `json:"wifi_ip,omitempty"`
	GatewayIP       string   `json:"gateway_ip,omitempty"`
}