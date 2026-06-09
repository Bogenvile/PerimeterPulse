package collector

import (
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/load"
)

type Metrics struct {
	CPUPercent         float64 `json:"cpu_percent"`
	RAMPercent         float64 `json:"ram_percent"`
	RAMUsedBytes       uint64  `json:"ram_used_bytes"`
	RAMTotalBytes      uint64  `json:"ram_total_bytes"`
	StoragePercent     float64 `json:"storage_percent"`
	StorageUsedBytes   uint64  `json:"storage_used_bytes"`
	StorageTotalBytes  uint64  `json:"storage_total_bytes"`
	UptimeSeconds      uint64  `json:"uptime_seconds"`
	NetworkStatus      string  `json:"network_status"`
	NetworkLatencyMs   float64 `json:"network_latency_ms"`
	DiskHealthStatus   string  `json:"disk_health_status,omitempty"`
	DiskTemperatureC   float64 `json:"disk_temperature_c,omitempty"`
	Timestamp          string  `json:"timestamp"`
}

type NetworkInfo struct {
	WiFiSSID      string   `json:"wifi_ssid"`
	WiFiSignalDBM float64  `json:"wifi_signal_dbm"`
	SpeedMbps     float64  `json:"network_speed_mbps"`
	IPAddresses   []string `json:"ip_addresses"`
}

type Location struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	Timestamp      string  `json:"timestamp"`
}

type RegistrationInfo struct {
	Hostname         string   `json:"hostname"`
	OS               string   `json:"os"`
	OSVersion        string   `json:"os_version"`
	AgentVersion     string   `json:"agent_version"`
	APIKey           string   `json:"api_key"`
	MacAddresses     []string `json:"mac_addresses"`
	IPAddresses      []string `json:"ip_addresses"`
	CPUModel         string   `json:"cpu_model"`
	CPUCores         int      `json:"cpu_cores"`
	RAMTotalBytes    uint64   `json:"ram_total_bytes"`
	StorageTotalBytes uint64  `json:"storage_total_bytes"`
	DiskModel        string   `json:"disk_model"`
	DiskType         string   `json:"disk_type"`
	WiFiSSID         string   `json:"wifi_ssid"`
	WiFiSignalDBM    float64  `json:"wifi_signal_dbm"`
	NetworkSpeedMbps float64  `json:"network_speed_mbps"`
}

func CollectInfo(apiKey string) *RegistrationInfo {
	hostInfo, _ := host.Info()
	cpuInfo, _ := cpu.Info()
	diskInfo, _ := disk.Usage("/")
	memInfo, _ := mem.VirtualMemory()

	info := &RegistrationInfo{
		Hostname:         hostname(),
		OS:               runtime.GOOS,
		OSVersion:        hostInfo.PlatformVersion,
		AgentVersion:     "1.0.0",
		APIKey:           apiKey,
		MacAddresses:     getMacAddresses(),
		CPUModel:         cpuModel(cpuInfo),
		CPUCores:         len(cpuInfo),
		RAMTotalBytes:    memInfo.Total,
		StorageTotalBytes: diskInfo.Total,
		DiskModel:        "Unknown",
		DiskType:         "SSD",
	}
	return info
}

func CollectMetrics() *Metrics {
	cpuPercent, _ := cpu.Percent(0, false)
	memInfo, _ := mem.VirtualMemory()
	diskInfo, _ := disk.Usage("/")
	uptime, _ := host.Uptime()
	loadAvg, _ := load.Avg()

	metrics := &Metrics{
		CPUPercent:        cpuPercent[0],
		RAMPercent:        memInfo.UsedPercent,
		RAMUsedBytes:      memInfo.Used,
		RAMTotalBytes:     memInfo.Total,
		StoragePercent:    diskInfo.UsedPercent,
		StorageUsedBytes:  diskInfo.Used,
		StorageTotalBytes: diskInfo.Total,
		UptimeSeconds:     uptime,
		NetworkStatus:     "up",
		NetworkLatencyMs:  loadAvg.Load1 * 100,
		Timestamp:         time.Now().UTC().Format(time.RFC3339),
	}
	return metrics
}

func CollectNetwork() *NetworkInfo {
	return &NetworkInfo{
		WiFiSSID:      getWiFiSSID(),
		WiFiSignalDBM: getWiFiSignalDBM(),
		SpeedMbps:     100,
		IPAddresses:   getIPAddresses(),
	}
}

func GetLocation() (*Location, error) {
	// Simplified location stub — in production use geoclue or GeoIP
	return nil, nil
}

func hostname() string {
	h, _ := host.Info()
	return h.Hostname
}

func cpuModel(cpuInfo []cpu.InfoStat) string {
	if len(cpuInfo) > 0 {
		return cpuInfo[0].ModelName
	}
	return "Unknown"
}

func getMacAddresses() []string {
	return getMACs()
}

func getWiFiSSID() string {
	return getWifiSSID()
}

func getWiFiSignalDBM() float64 {
	return getWifiSignal()
}

func getIPAddresses() []string {
	return getIPs()
}

func getMACs() []string {
	// Simplified — implement with net.Interfaces in helper
	return []string{"00:00:00:00:00:00"}
}

func getWifiSSID() string {
	return "Unknown"
}

func getWifiSignal() float64 {
	return -50
}

func getIPs() []string {
	return []string{"127.0.0.1"}
}