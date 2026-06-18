package collector

import (
	"time"
)

// -------------------------------
// Common types used across collectors
// -------------------------------

type SystemInfo struct {
	Hostname     string   `json:"hostname"`
	MacAddresses []string `json:"mac_addresses"`
}

type HardwareInfo struct {
	CPUModel          string `json:"cpu_model"`
	CPUCores          int    `json:"cpu_cores"`
	RAMTotalBytes     uint64 `json:"ram_total_bytes"`
	StorageTotalBytes uint64 `json:"storage_total_bytes"`
	DiskModel         string `json:"disk_model"`
	DiskType          string `json:"disk_type"`
}

type NetworkInfo struct {
	WiFiSSID         string   `json:"wifi_ssid"`
	WiFiSignalDBM    int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps float64  `json:"network_speed_mbps"`
	IPAddresses      []string `json:"ip_addresses"`
	WiFiIP           string   `json:"wifi_ip"`
	GatewayIP        string   `json:"gateway_ip"`
}

type LocationInfo struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	City           string  `json:"city"`
	Country        string  `json:"country"`
	Timestamp      string  `json:"timestamp"`
}

type Metrics struct {
	Timestamp         time.Time `json:"timestamp"`
	CPUPercent        float64   `json:"cpu_percent"`
	RAMPercent        float64   `json:"ram_percent"`
	RAMUsedBytes      uint64    `json:"ram_used_bytes"`
	RAMTotalBytes     uint64    `json:"ram_total_bytes"`
	StoragePercent    float64   `json:"storage_percent"`
	StorageUsedBytes  uint64    `json:"storage_used_bytes"`
	StorageTotalBytes uint64    `json:"storage_total_bytes"`
	UptimeSeconds     uint64    `json:"uptime_seconds"`
	NetworkStatus     string    `json:"network_status"`
	NetworkLatencyMs  float64   `json:"network_latency_ms"`
	PingLatencyMs     float64   `json:"ping_latency_ms"`
	ErrorCount        int       `json:"error_count"`
	DiskHealthStatus  string    `json:"disk_health_status"`
	DiskTemperatureC  float64   `json:"disk_temperature_c"`
	GatewayReachable  bool      `json:"gateway_reachable"`
	DNSWorking        bool      `json:"dns_working"`
	InternetReachable bool      `json:"internet_reachable"`
	DefaultGateway    string    `json:"default_gateway"`
}

type CollectorResult struct {
	System   SystemInfo   `json:"system"`
	Hardware HardwareInfo `json:"hardware"`
	Network  NetworkInfo  `json:"network"`
	Location LocationInfo `json:"location"`
	Metrics  Metrics      `json:"metrics"`
}

// CollectAll is the top-level collection function.
// It delegates to specialised collector functions defined in separate files.
func CollectAll() CollectorResult {
	sys := CollectSystemInfo()
	hw := CollectHardware()
	net := CollectNetworkInfo()
	loc := CollectLocation()
	metrics := CollectMetrics()

	return CollectorResult{
		System:   sys,
		Hardware: hw,
		Network:  net,
		Location: loc,
		Metrics:  metrics,
	}
}