package collector

import (
	"crypto/sha256"
	"fmt"
	"math"
	"runtime"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

// ──── Metrics ────

type Metrics struct {
	CPUPercent         float64     `json:"cpu_percent"`
	RAMPercent         float64     `json:"ram_percent"`
	RAMUsedBytes       uint64      `json:"ram_used_bytes"`
	RAMTotalBytes      uint64      `json:"ram_total_bytes"`
	StoragePercent     float64     `json:"storage_percent"`
	StorageUsedBytes   uint64      `json:"storage_used_bytes"`
	StorageTotalBytes  uint64      `json:"storage_total_bytes"`
	UptimeSeconds      uint64      `json:"uptime_seconds"`
	NetworkStatus      string      `json:"network_status"`
	NetworkLatencyMS   float64     `json:"network_latency_ms"`
	PingLatencyMS      float64     `json:"ping_latency_ms"`
	ErrorCount         int         `json:"error_count"`
	ErrorLogs          []ErrorLog  `json:"error_logs,omitempty"`
	GatewayReachable   bool        `json:"gateway_reachable"`
	DNSWorking         bool        `json:"dns_working"`
	InternetReachable  bool        `json:"internet_reachable"`
	DefaultGateway     string      `json:"default_gateway"`
	DiskHealthStatus   string      `json:"disk_health_status"`
	DiskTemperatureC   float64     `json:"disk_temperature_c"`
}

type ErrorLog struct {
	Time    string `json:"time"`
	ID      int    `json:"id"`
	Level   string `json:"level"`
	Source  string `json:"source"`
	Message string `json:"message"`
}

// ──── Hardware ────

type Hardware struct {
	CPUModel          string   `json:"cpu_model"`
	CPUCores          int      `json:"cpu_cores"`
	RAMTotalBytes     uint64   `json:"ram_total_bytes"`
	StorageTotalBytes uint64   `json:"storage_total_bytes"`
	MACAddresses      []string `json:"mac_addresses"`
	DiskModel         string   `json:"disk_model"`
	DiskType          string   `json:"disk_type"`
}

// ──── OS Info ────

type OSInfo struct {
	OS        string `json:"os"`
	OSVersion string `json:"os_version"`
}

// ──── Network Info ────

type NetworkInfo struct {
	IPAddresses      []string `json:"ip_addresses"`
	WifiSSID         string   `json:"wifi_ssid"`
	WifiSignalDBm    int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps int      `json:"network_speed_mbps"`
	DefaultGateway   string   `json:"gateway_ip"`
}

// ──── Location ────

type Location struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	City           string  `json:"city,omitempty"`
	Country        string  `json:"country,omitempty"`
}

// ──── Network Diag ────

type NetworkDiag struct {
	GatewayReachable  bool   `json:"gateway_reachable"`
	DNSWorking        bool   `json:"dns_working"`
	InternetReachable bool   `json:"internet_reachable"`
	DefaultGateway    string `json:"default_gateway"`
}

// ──── Collectors ────

func GetOSInfo() OSInfo {
	info := OSInfo{OS: runtime.GOOS}
	h, err := host.Info()
	if err == nil {
		info.OSVersion = h.PlatformVersion
		if info.OS == "windows" {
			info.OS = "Windows"
		} else if info.OS == "linux" {
			info.OS = "Linux"
		}
	}
	return info
}

func CollectHardware() Hardware {
	hw := Hardware{}

	// CPU
	cpuInfo, err := cpu.Info()
	if err == nil && len(cpuInfo) > 0 {
		hw.CPUModel = strings.TrimSpace(cpuInfo[0].ModelName)
		hw.CPUCores = int(cpuInfo[0].Cores)
	}

	// RAM
	v, err := mem.VirtualMemory()
	if err == nil {
		hw.RAMTotalBytes = v.Total
	}

	// Disk
	partitions, err := disk.Partitions(false)
	if err == nil {
		for _, p := range partitions {
			usage, err := disk.Usage(p.Mountpoint)
			if err == nil {
				hw.StorageTotalBytes += usage.Total
			}
		}
	}

	// MAC
	interfaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range interfaces {
			if iface.HardwareAddr != "" && len(iface.HardwareAddr) > 0 {
				hw.MACAddresses = append(hw.MACAddresses, iface.HardwareAddr)
			}
		}
	}

	// Disk type (simplified)
	hw.DiskType = "unknown"
	hw.DiskModel = "Unknown"

	return hw
}

func CollectNetworkInfo() NetworkInfo {
	ni := NetworkInfo{}

	interfaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range interfaces {
			if len(iface.Flags) > 0 && iface.Flags[0] == "up" {
				for _, addr := range iface.Addrs {
					ni.IPAddresses = append(ni.IPAddresses, addr.Addr)
				}
			}
		}
	}

	// Basic gateway detection (not reliable, but we'll use default route)
	ni.DefaultGateway = detectDefaultGateway()

	// WiFi info (platform-specific stubs - we'll keep simple)
	ni.WifiSSID = getWifiSSID()
	ni.WifiSignalDBm = getWifiSignal()
	ni.NetworkSpeedMbps = 0

	return ni
}

func CollectMetrics() Metrics {
	m := Metrics{}

	// CPU
	cpuPercent, err := cpu.Percent(time.Second, false)
	if err == nil && len(cpuPercent) > 0 {
		m.CPUPercent = math.Round(cpuPercent[0]*10) / 10
	}

	// RAM
	v, err := mem.VirtualMemory()
	if err == nil {
		m.RAMPercent = math.Round(v.UsedPercent*10) / 10
		m.RAMUsedBytes = v.Used
		m.RAMTotalBytes = v.Total
	}

	// Disk
	partitions, err := disk.Partitions(false)
	if err == nil {
		var totalUsed, totalAll uint64
		for _, p := range partitions {
			usage, err := disk.Usage(p.Mountpoint)
			if err == nil {
				totalUsed += usage.Used
				totalAll += usage.Total
			}
		}
		if totalAll > 0 {
			m.StoragePercent = math.Round(float64(totalUsed)/float64(totalAll)*1000) / 10
			m.StorageUsedBytes = totalUsed
			m.StorageTotalBytes = totalAll
		}
	}

	// Uptime
	up, err := host.Uptime()
	if err == nil {
		m.UptimeSeconds = up
	}

	m.NetworkStatus = "up"
	m.DiskHealthStatus = "unknown"

	return m
}

func CollectLocation() Location {
	// Default: no location (server will use GeoIP fallback)
	return Location{
		Latitude:       0,
		Longitude:      0,
		AccuracyMeters: 0,
		Source:         "unknown",
	}
}

func RunNetworkDiag(gateway string) NetworkDiag {
	return NetworkDiag{
		GatewayReachable:  true, // simplified — we assume reachable
		DNSWorking:        true,
		InternetReachable: true,
		DefaultGateway:    gateway,
	}
}

var errorLogs []ErrorLog

func GetErrorLogs() []ErrorLog {
	logs := errorLogs
	errorLogs = nil
	return logs
}

func GenerateAgentID(hostname string, macs []string) string {
	h := sha256.New()
	h.Write([]byte(hostname))
	for _, mac := range macs {
		h.Write([]byte(mac))
	}
	return fmt.Sprintf("agent-%x", h.Sum(nil)[:8])
}

// Platform-specific stubs (implemented in _windows.go and _linux.go)
var detectDefaultGateway = func() string { return "" }
var getWifiSSID = func() string { return "" }
var getWifiSignal = func() int { return 0 }