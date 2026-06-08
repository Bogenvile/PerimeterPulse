package collector

import (
	"fmt"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

// Metrics represents a snapshot of system health.
type Metrics struct {
	CPUPercent        float64 `json:"cpu_percent"`
	RAMPercent        float64 `json:"ram_percent"`
	RAMUsedBytes      uint64  `json:"ram_used_bytes"`
	RAMTotalBytes     uint64  `json:"ram_total_bytes"`
	StoragePercent    float64 `json:"storage_percent"`
	StorageUsedBytes  uint64  `json:"storage_used_bytes"`
	StorageTotalBytes uint64  `json:"storage_total_bytes"`
	UptimeSeconds     uint64  `json:"uptime_seconds"`
	NetworkStatus     string  `json:"network_status"`
	NetworkLatencyMs  float64 `json:"network_latency_ms"`
	DiskHealthStatus  string  `json:"disk_health_status"`
	DiskTemperatureC  float64 `json:"disk_temperature_c"`
	Timestamp         string  `json:"timestamp"`
	// Network diagnostics
	GatewayReachable   bool   `json:"gateway_reachable"`
	DNSWorking         bool   `json:"dns_working"`
	InternetReachable  bool   `json:"internet_reachable"`
	DefaultGateway     string `json:"default_gateway"`
}

// NetworkInfo represents current network state including diagnostics.
type NetworkInfo struct {
	WifiSSID         string      `json:"wifi_ssid"`
	WifiSignalDBm    int         `json:"wifi_signal_dbm"`
	NetworkSpeedMbps float64     `json:"network_speed_mbps"`
	IPAddresses      []string    `json:"ip_addresses"`
	Diag             NetworkDiag `json:"diag"`
}

// RegistrationInfo is sent once on agent startup.
type RegistrationInfo struct {
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
	WifiSSID          string   `json:"wifi_ssid"`
	WifiSignalDBm     int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps  float64  `json:"network_speed_mbps"`
}

// CollectMetrics gathers all system health metrics including SMART disk data.
func CollectMetrics() Metrics {
	now := time.Now().UTC().Format(time.RFC3339)

	// CPU
	cpuPercent := 0.0
	if percents, err := cpu.Percent(0, false); err == nil && len(percents) > 0 {
		cpuPercent = percents[0]
	}

	// RAM
	ramPercent := 0.0
	ramUsed := uint64(0)
	ramTotal := uint64(0)
	if v, err := mem.VirtualMemory(); err == nil {
		ramPercent = v.UsedPercent
		ramUsed = v.Used
		ramTotal = v.Total
	}

	// Storage (root partition)
	storagePercent := 0.0
	storageUsed := uint64(0)
	storageTotal := uint64(0)
	rootPath := "/"
	if runtime.GOOS == "windows" {
		rootPath = "C:"
	}
	if usage, err := disk.Usage(rootPath); err == nil {
		storagePercent = usage.UsedPercent
		storageUsed = usage.Used
		storageTotal = usage.Total
	}

	// Uptime
	uptimeSec := uint64(0)
	if u, err := host.Uptime(); err == nil {
		uptimeSec = u
	}

	// Network status — full diagnostic
	diag := RunNetworkDiag()
	netStatus := diag.Status
	netLatencyMs := diag.InternetLatencyMs
	if netLatencyMs == 0 {
		netLatencyMs = diag.GatewayLatencyMs
	}

	// SMART disk health (platform-specific)
	diskHealth := "unknown"
	diskTemp := 0.0
	if smart, err := collectSMARTData(); err == nil {
		diskHealth = smart.Status
		diskTemp = smart.Temperature
	}

	return Metrics{
		CPUPercent:        round(cpuPercent),
		RAMPercent:        round(ramPercent),
		RAMUsedBytes:      ramUsed,
		RAMTotalBytes:     ramTotal,
		StoragePercent:    round(storagePercent),
		StorageUsedBytes:  storageUsed,
		StorageTotalBytes: storageTotal,
		UptimeSeconds:     uptimeSec,
		NetworkStatus:     netStatus,
		NetworkLatencyMs:  round(netLatencyMs),
		DiskHealthStatus:  diskHealth,
		DiskTemperatureC:  round(diskTemp),
		Timestamp:         now,
		GatewayReachable:  diag.GatewayReachable,
		DNSWorking:        diag.DNSWorking,
		InternetReachable: diag.InternetReachable,
		DefaultGateway:    diag.DefaultGateway,
	}
}

// CollectNetworkInfo gathers extended network information including diagnostics.
func CollectNetworkInfo() NetworkInfo {
	diag := RunNetworkDiag()
	return NetworkInfo{
		WifiSSID:         getWifiSSID(),
		WifiSignalDBm:    getWifiSignal(),
		NetworkSpeedMbps: getNetworkSpeed(),
		IPAddresses:      getIPAddresses(),
		Diag:             diag,
	}
}

// BuildRegistration collects static system info for initial registration.
func BuildRegistration(hostname, osName, osVersion, agentVer string) RegistrationInfo {
	if osName == "" {
		osName = runtime.GOOS
	}
	if osVersion == "" {
		if platform, _, version, err := host.PlatformInformation(); err == nil {
			osVersion = fmt.Sprintf("%s %s", platform, version)
		}
	}

	// MAC + IP addresses
	var macs []string
	var ips []string
	if ifaces, err := net.Interfaces(); err == nil {
		for _, iface := range ifaces {
			if iface.HardwareAddr != "" && iface.HardwareAddr != "00:00:00:00:00:00" {
				macs = append(macs, iface.HardwareAddr)
			}
			for _, addr := range iface.Addrs {
				if ip := addr.Addr; ip != "" && ip != "127.0.0.1" && ip != "::1" {
					ips = append(ips, ip)
				}
			}
		}
	}

	// CPU model + cores
	cpuModel := ""
	cpuCores := 0
	if info, err := cpu.Info(); err == nil && len(info) > 0 {
		cpuModel = info[0].ModelName
		cpuCores = int(info[0].Cores)
	}
	if cpuCores == 0 {
		if c, err := cpu.Counts(true); err == nil {
			cpuCores = c
		}
	}

	// RAM total
	ramTotal := uint64(0)
	if v, err := mem.VirtualMemory(); err == nil {
		ramTotal = v.Total
	}

	// Storage + disk info
	storageTotal := uint64(0)
	rootPath := "/"
	if runtime.GOOS == "windows" {
		rootPath = "C:"
	}
	if usage, err := disk.Usage(rootPath); err == nil {
		storageTotal = usage.Total
	}

	diskModel, diskType := getDiskInfo()

	// Network info
	wifiSSID := getWifiSSID()
	wifiSignal := getWifiSignal()
	netSpeed := getNetworkSpeed()

	return RegistrationInfo{
		Hostname:          hostname,
		OS:                osName,
		OSVersion:         osVersion,
		AgentVersion:      agentVer,
		MACAddresses:      macs,
		IPAddresses:       ips,
		CPUModel:          cpuModel,
		CPUCores:          cpuCores,
		RAMTotalBytes:     ramTotal,
		StorageTotalBytes: storageTotal,
		DiskModel:         diskModel,
		DiskType:          diskType,
		WifiSSID:          wifiSSID,
		WifiSignalDBm:     wifiSignal,
		NetworkSpeedMbps:  netSpeed,
	}
}

// SMARTData holds parsed SMART disk information.
type SMARTData struct {
	Status      string
	Temperature float64
}

// collectSMARTData is implemented in platform-specific files.
func collectSMARTData() (*SMARTData, error) {
	return collectSMART()
}

func round(v float64) float64 {
	return float64(int(v*10)) / 10
}
