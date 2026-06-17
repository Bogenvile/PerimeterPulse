package collector

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

// SystemInfo holds static system information
type SystemInfo struct {
	Hostname          string
	MACAddresses      []string
	IPAddresses       []string
	CPUModel          string
	CPUCores          int
	RAMTotalBytes     uint64
	StorageTotalBytes uint64
	DiskModel         string
	DiskType          string
	WiFiSSID          string
	WiFiSignalDBM     int
	NetworkSpeedMbps  uint64
}

// RegistrationPayload is sent to the server on first connection
type RegistrationPayload struct {
	Hostname          string   `json:"hostname"`
	OS                string   `json:"os"`
	OSVersion         string   `json:"os_version"`
	AgentVersion      string   `json:"agent_version"`
	MACAddresses      []string `json:"mac_addresses"`
	IPAddresses       []string `json:"ip_addresses"`
	CPUModel          string   `json:"cpu_model"`
	CPUCores          int      `json:"cpu_cores"`
	RAMTotalBytes     uint64   `json:"ram_total_bytes"`
	StorageTotalBytes uint64   `json:"storage_total_bytes"`
	DiskModel         string   `json:"disk_model"`
	DiskType          string   `json:"disk_type"`
	WiFiSSID          string   `json:"wifi_ssid"`
	WiFiSignalDBM     int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps  uint64   `json:"network_speed_mbps"`
}

// MetricsData holds real-time metrics
type MetricsData struct {
	CPUPercent        float64            `json:"cpu_percent"`
	RAMPercent        float64            `json:"ram_percent"`
	RAMUsedBytes      uint64             `json:"ram_used_bytes"`
	RAMTotalBytes     uint64             `json:"ram_total_bytes"`
	StoragePercent    float64            `json:"storage_percent"`
	StorageUsedBytes  uint64             `json:"storage_used_bytes"`
	StorageTotalBytes uint64             `json:"storage_total_bytes"`
	UptimeSeconds     uint64             `json:"uptime_seconds"`
	NetworkStatus     string             `json:"network_status"`
	NetworkLatencyMs  float64            `json:"network_latency_ms"`
	PingLatencyMs     float64            `json:"ping_latency_ms,omitempty"`
	ErrorCount        int                `json:"error_count,omitempty"`
	DiskHealthStatus  string             `json:"disk_health_status,omitempty"`
	DiskTemperatureC  float64            `json:"disk_temperature_c,omitempty"`
	GatewayReachable  bool               `json:"gateway_reachable,omitempty"`
	DNSWorking        bool               `json:"dns_working,omitempty"`
	InternetReachable bool               `json:"internet_reachable,omitempty"`
	DefaultGateway    string             `json:"default_gateway,omitempty"`
	Timestamp         string             `json:"timestamp"`
	ErrorLogs         []ErrorLogEntry    `json:"error_logs,omitempty"`
}

type ErrorLogEntry struct {
	Time    string `json:"time"`
	ID      int    `json:"id"`
	Level   string `json:"level"`
	Source  string `json:"source"`
	Message string `json:"message"`
}

// LocationData holds location information
type LocationData struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Source    string  `json:"source"`
	City      string  `json:"city"`
	Country   string  `json:"country"`
	Accuracy  float64 `json:"accuracy_meters"`
	Timestamp string  `json:"timestamp"`
}

// NetworkInfo holds network information
type NetworkInfo struct {
	WiFiSSID         string   `json:"wifi_ssid"`
	WiFiSignalDBM    int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps uint64   `json:"network_speed_mbps"`
	IPAddresses      []string `json:"ip_addresses"`
	WiFiIP           string   `json:"wifi_ip,omitempty"`
	GatewayIP        string   `json:"gateway_ip,omitempty"`
}

// OSInfo holds OS information
type OSInfo struct {
	OS        string `json:"os"`
	OSVersion string `json:"os_version"`
}

// CollectSystemInfo collects static system information
func CollectSystemInfo() SystemInfo {
	info := SystemInfo{}

	// Get host info for uptime etc
	hostInfo, err := host.Info()
	if err == nil {
		// Hostname already set by caller
		info.Hostname = hostInfo.Hostname
	}

	// CPU Info
	cpuInfo, err := cpu.Info()
	if err == nil && len(cpuInfo) > 0 {
		info.CPUModel = cpuInfo[0].ModelName
		info.CPUCores = len(cpuInfo)
	}

	// Memory
	memInfo, err := mem.VirtualMemory()
	if err == nil {
		info.RAMTotalBytes = memInfo.Total
	}

	// Storage
	partitions, err := disk.Partitions(false)
	if err == nil {
		for _, part := range partitions {
			usage, err := disk.Usage(part.Mountpoint)
			if err == nil {
				info.StorageTotalBytes = usage.Total
				break
			}
		}
	}

	// Network interfaces
	interfaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range interfaces {
			if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
				continue
			}
			if iface.HardwareAddr.String() != "" {
				info.MACAddresses = append(info.MACAddresses, iface.HardwareAddr.String())
			}
			addrs, err := iface.Addrs()
			if err == nil {
				for _, addr := range addrs {
					ipStr := strings.Split(addr.String(), "/")[0]
					if ipStr != "" && !strings.HasPrefix(ipStr, "127.") && !strings.HasPrefix(ipStr, "::1") {
						info.IPAddresses = append(info.IPAddresses, ipStr)
					}
				}
			}
		}
	}

	return info
}

// CollectMetrics collects real-time system metrics
func CollectMetrics() MetricsData {
	m := MetricsData{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	// CPU
	cpuPercent, err := cpu.Percent(0, false)
	if err == nil && len(cpuPercent) > 0 {
		m.CPUPercent = cpuPercent[0]
	}

	// Memory
	memInfo, err := mem.VirtualMemory()
	if err == nil {
		m.RAMPercent = memInfo.UsedPercent
		m.RAMUsedBytes = memInfo.Used
		m.RAMTotalBytes = memInfo.Total
	}

	// Storage
	partitions, err := disk.Partitions(false)
	if err == nil {
		for _, part := range partitions {
			usage, err := disk.Usage(part.Mountpoint)
			if err == nil {
				m.StoragePercent = usage.UsedPercent
				m.StorageUsedBytes = usage.Used
				m.StorageTotalBytes = usage.Total
				break
			}
		}
	}

	// Uptime
	hostInfo, err := host.Info()
	if err == nil {
		m.UptimeSeconds = hostInfo.Uptime
	}

	// Network diagnostics
	diag := RunNetworkDiag()
	m.NetworkStatus = diag.Status
	m.NetworkLatencyMs = diag.LatencyMs
	m.GatewayReachable = diag.GatewayReachable
	m.DNSWorking = diag.DNSWorking
	m.InternetReachable = diag.InternetReachable
	m.DefaultGateway = diag.DefaultGateway

	// Ping latency
	pingMs, err := PingGoogle()
	if err == nil {
		m.PingLatencyMs = pingMs
	}

	return m
}

// CollectNetworkInfo collects network information
func CollectNetworkInfo() NetworkInfo {
	info := NetworkInfo{}

	// Get IP addresses from active interfaces
	interfaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range interfaces {
			if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
				continue
			}
			addrs, err := iface.Addrs()
			if err == nil {
				for _, addr := range addrs {
					ipStr := strings.Split(addr.String(), "/")[0]
					if ipStr != "" && !strings.HasPrefix(ipStr, "127.") && !strings.HasPrefix(ipStr, "::1") {
						info.IPAddresses = append(info.IPAddresses, ipStr)
					}
				}
			}
		}
	}

	// Try to get WiFi info (platform-specific)
	info.WiFiSSID = getWiFiSSID()
	info.WiFiSignalDBM = getWiFiSignalDBM()
	info.NetworkSpeedMbps = getNetworkSpeedMbps()

	// Try to get WiFi IP and Gateway
	info.WiFiIP = getWiFiIP()
	info.GatewayIP = getDefaultGatewayIP()

	return info
}

// determineDiskModel determines disk model and type
func determineDiskModel() (model string, diskType string) {
	partitions, err := disk.Partitions(false)
	if err != nil {
		return "Unknown", "unknown"
	}

	for _, part := range partitions {
		// Get usage to make sure it's a real filesystem
		_, err := disk.Usage(part.Mountpoint)
		if err != nil {
			continue
		}

		// Try to get serial/IO counters for device type detection
		device := part.Device
		// On Windows, device looks like "C:" — we want the physical drive
		if runtime.GOOS == "windows" {
			// For Windows, we can try to get the model via WMI/PowerShell
			// but for now use the device name as model
			model = device
			diskType = "SSD" // Assume SSD for modern Windows
		} else {
			// On Linux, device is like "/dev/sda1"
			model = device
			if strings.Contains(device, "nvme") {
				diskType = "NVMe"
			} else if strings.Contains(device, "sd") {
				diskType = "SSD"
			} else if strings.Contains(device, "hd") {
				diskType = "HDD"
			} else {
				diskType = "unknown"
			}
		}
		break
	}
	return
}

// GetLocation gets platform-specific location
func GetLocation() (LocationData, error) {
	if getPlatformLocation != nil {
		return getPlatformLocation()
	}
	return LocationData{
		Source: "unavailable",
	}, fmt.Errorf("platform location not available")
}

// getPlatformLocation is set by platform-specific init()
var getPlatformLocation func() (LocationData, error)

// GetOSInfo returns OS information
func GetOSInfo() OSInfo {
	return OSInfo{
		OS:        runtime.GOOS,
		OSVersion: getOSVersion(),
	}
}

func getOSVersion() string {
	hostInfo, err := host.Info()
	if err != nil {
		return "unknown"
	}
	return hostInfo.PlatformVersion
}

// GenerateAgentID generates a stable agent ID from system info
func GenerateAgentID(info SystemInfo) string {
	data := info.Hostname + strings.Join(info.MACAddresses, ",")
	hash := sha256.Sum256([]byte(data))
	return "agent-" + hex.EncodeToString(hash[:8])
}