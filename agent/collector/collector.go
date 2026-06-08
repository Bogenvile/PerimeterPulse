package collector

import (
	"fmt"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

// Metrics represents a snapshot of system health.
type Metrics struct {
	CPUPercent       float64 `json:"cpu_percent"`
	RAMPercent       float64 `json:"ram_percent"`
	RAMUsedBytes     uint64  `json:"ram_used_bytes"`
	RAMTotalBytes    uint64  `json:"ram_total_bytes"`
	StoragePercent   float64 `json:"storage_percent"`
	StorageUsedBytes uint64  `json:"storage_used_bytes"`
	StorageTotalBytes uint64 `json:"storage_total_bytes"`
	UptimeSeconds    uint64  `json:"uptime_seconds"`
	NetworkStatus    string  `json:"network_status"`
	NetworkLatencyMs float64 `json:"network_latency_ms"`
	Timestamp        string  `json:"timestamp"`
}

// RegistrationInfo is sent once on agent startup.
type RegistrationInfo struct {
	Hostname         string   `json:"hostname"`
	OS               string   `json:"os"`
	OSVersion        string   `json:"os_version"`
	AgentVersion     string   `json:"agent_version"`
	MACAddresses     []string `json:"mac_addresses"`
	CPUModel         string   `json:"cpu_model"`
	RAMTotalBytes    uint64   `json:"ram_total_bytes"`
	StorageTotalBytes uint64  `json:"storage_total_bytes"`
}

// CollectMetrics gathers all system health metrics.
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

	// Network status (check if any interface is up and has an IP)
	netStatus := "down"
	netLatencyMs := 0.0
	if connections, err := net.Connections("tcp"); err == nil && len(connections) > 0 {
		netStatus = "up"
		// Approximate latency via load average as a proxy
		if l, err := load.Avg(); err == nil {
			netLatencyMs = l.Load1 * 100 // rough correlation
			if netLatencyMs > 2000 {
				netLatencyMs = 2000
			}
		}
	} else {
		// Check if any interface has an IP address
		if ifaces, err := net.Interfaces(); err == nil {
			for _, iface := range ifaces {
				if len(iface.Flags) > 0 && iface.Flags[0] == "up" {
					netStatus = "degraded"
					break
				}
			}
		}
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
		Timestamp:         now,
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

	// MAC addresses
	var macs []string
	if ifaces, err := net.Interfaces(); err == nil {
		for _, iface := range ifaces {
			if iface.HardwareAddr != "" && iface.HardwareAddr != "00:00:00:00:00:00" {
				macs = append(macs, iface.HardwareAddr)
			}
		}
	}

	// CPU model
	cpuModel := ""
	if info, err := cpu.Info(); err == nil && len(info) > 0 {
		cpuModel = info[0].ModelName
	}

	// RAM total
	ramTotal := uint64(0)
	if v, err := mem.VirtualMemory(); err == nil {
		ramTotal = v.Total
	}

	// Storage total
	storageTotal := uint64(0)
	rootPath := "/"
	if runtime.GOOS == "windows" {
		rootPath = "C:"
	}
	if usage, err := disk.Usage(rootPath); err == nil {
		storageTotal = usage.Total
	}

	return RegistrationInfo{
		Hostname:         hostname,
		OS:               osName,
		OSVersion:        osVersion,
		AgentVersion:     agentVer,
		MACAddresses:     macs,
		CPUModel:         cpuModel,
		RAMTotalBytes:    ramTotal,
		StorageTotalBytes: storageTotal,
	}
}

func round(v float64) float64 {
	return float64(int(v*10)) / 10
}
