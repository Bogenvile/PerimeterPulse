package collector

// Metrics holds system performance data
type Metrics struct {
	CPUPCT        float64 `json:"cpu_percent"`
	RAMPCT        float64 `json:"ram_percent"`
	RAMUsed       uint64  `json:"ram_used_bytes"`
	RAMTotal      uint64  `json:"ram_total_bytes"`
	StoragePCT    float64 `json:"storage_percent"`
	StorageUsed   uint64  `json:"storage_used_bytes"`
	StorageTotal  uint64  `json:"storage_total_bytes"`
	UptimeSec     uint64  `json:"uptime_seconds"`
	NetworkStatus string  `json:"network_status"`
	NetLatencyMS  float64 `json:"network_latency_ms"`
	DiskHealth    string  `json:"disk_health_status"`
	DiskTempC     float64 `json:"disk_temperature_c"`
	PingLatencyMS float64 `json:"ping_latency_ms"`
	ErrorCount    int     `json:"error_count"`
	Timestamp     string  `json:"timestamp"`
}

func CollectMetrics(diskType string) Metrics {
	return Metrics{
		NetworkStatus: "unknown",
		DiskHealth:    "ok",
	}
}