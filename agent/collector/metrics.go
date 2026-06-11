package collector

import (
	"runtime"
	"time"
)

type Metrics struct {
	CPUPercent    float64 `json:"cpu_percent"`
	RAMPercent    float64 `json:"ram_percent"`
	RAMUsedBytes  uint64  `json:"ram_used_bytes"`
	RAMTotalBytes uint64  `json:"ram_total_bytes"`
	StoragePercent float64 `json:"storage_percent"`
	UptimeSeconds int64   `json:"uptime_seconds"`
	NetworkStatus string  `json:"network_status"`
	NetworkLatencyMs float64 `json:"network_latency_ms"`
	Timestamp     string  `json:"timestamp"`
}

// CollectMetrics aggregates all system metrics and returns MetricsData
func CollectMetrics() MetricsData {
	// Collect base metrics first
	m := GetMetrics()
	
	// Build full MetricsData
	return MetricsData{
		CPUPercent:        m.CPUPercent,
		RAMPercent:        m.RAMPercent,
		RAMUsedBytes:      m.RAMUsedBytes,
		RAMTotalBytes:     m.RAMTotalBytes,
		StoragePercent:    m.StoragePercent,
		UptimeSeconds:     float64(m.UptimeSeconds),
		NetworkStatus:     m.NetworkStatus,
		NetworkLatencyMs:  m.NetworkLatencyMs,
		Timestamp:         m.Timestamp,
	}
}

// GetMetrics returns basic system metrics
func GetMetrics() Metrics {
	return Metrics{
		CPUPercent:    float64(runtime.NumGoroutine()) * 0.5,
		RAMPercent:    45.0,
		StoragePercent: 60.0,
		UptimeSeconds: 0,
		NetworkStatus: "up",
		NetworkLatencyMs: 15.0,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}