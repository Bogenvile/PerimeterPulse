package collector

import (
	"net"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

type SystemInfo struct {
	Hostname          string   `json:"hostname"`
	OS                string   `json:"os"`
	OSVersion         string   `json:"os_version"`
	AgentVersion      string   `json:"agent_version"`
	MacAddresses      []string `json:"mac_addresses"`
	IPAddresses       []string `json:"ip_addresses"`
	CPUModel          string   `json:"cpu_model"`
	CPUCores          int      `json:"cpu_cores"`
	RAMTotalBytes     uint64   `json:"ram_total_bytes"`
	StorageTotalBytes uint64   `json:"storage_total_bytes"`
	DiskModel         string   `json:"disk_model"`
	DiskType          string   `json:"disk_type"`
}

type Metrics struct {
	CPUPercent        float64  `json:"cpu_percent"`
	RAMPercent        float64  `json:"ram_percent"`
	RAMUsedBytes      uint64   `json:"ram_used_bytes"`
	RAMTotalBytes     uint64   `json:"ram_total_bytes"`
	StoragePercent    float64  `json:"storage_percent"`
	StorageUsedBytes  uint64   `json:"storage_used_bytes"`
	StorageTotalBytes uint64   `json:"storage_total_bytes"`
	UptimeSeconds     uint64   `json:"uptime_seconds"`
	NetworkStatus     string   `json:"network_status"`
	NetworkLatencyMs  float64  `json:"network_latency_ms"`
	GatewayReachable  *bool    `json:"gateway_reachable,omitempty"`
	DNSWorking        *bool    `json:"dns_working,omitempty"`
	InternetReachable *bool    `json:"internet_reachable,omitempty"`
	DefaultGateway    string   `json:"default_gateway,omitempty"`
	DiskHealthStatus  *string  `json:"disk_health_status,omitempty"`
	DiskTemperatureC  *float64 `json:"disk_temperature_c,omitempty"`
	Timestamp         string   `json:"timestamp"`
}

func CollectSystemInfo(hostname string) SystemInfo {
	info := SystemInfo{
		Hostname:     hostname,
		OS:           runtime.GOOS,
		AgentVersion: "2.0.0",
	}

	if hi, err := host.Info(); err == nil {
		info.OSVersion = hi.PlatformVersion
		if info.OSVersion == "" {
			info.OSVersion = hi.KernelVersion
		}
	}

	if ci, err := cpu.Info(); err == nil && len(ci) > 0 {
		info.CPUModel = ci[0].ModelName
		info.CPUCores = int(ci[0].Cores)
	} else {
		info.CPUModel = "Unknown"
		info.CPUCores = runtime.NumCPU()
	}

	if vm, err := mem.VirtualMemory(); err == nil {
		info.RAMTotalBytes = vm.Total
	}

	if parts, err := disk.Partitions(false); err == nil {
		for _, p := range parts {
			if u, err := disk.Usage(p.Mountpoint); err == nil {
				info.StorageTotalBytes += u.Total
			}
		}
	}

	info.DiskModel = "Unknown"
	info.DiskType = "unknown"

	ifaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range ifaces {
			if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
				continue
			}
			if mac := iface.HardwareAddr.String(); mac != "" {
				info.MacAddresses = append(info.MacAddresses, mac)
			}
			addrs, _ := iface.Addrs()
			for _, addr := range addrs {
				if ipnet, ok := addr.(*net.IPNet); ok && ipnet.IP.IsGlobalUnicast() {
					info.IPAddresses = append(info.IPAddresses, ipnet.IP.String())
				}
			}
		}
	}

	return info
}

func CollectMetrics() Metrics {
	m := Metrics{Timestamp: time.Now().UTC().Format(time.RFC3339)}

	if percent, err := cpu.Percent(1*time.Second, false); err == nil && len(percent) > 0 {
		m.CPUPercent = percent[0]
	}

	if vm, err := mem.VirtualMemory(); err == nil {
		m.RAMPercent = vm.UsedPercent
		m.RAMUsedBytes = vm.Used
		m.RAMTotalBytes = vm.Total
	}

	if parts, err := disk.Partitions(false); err == nil {
		for _, p := range parts {
			if p.Mountpoint == "/" || p.Mountpoint == "C:" {
				if u, err := disk.Usage(p.Mountpoint); err == nil {
					m.StoragePercent = u.UsedPercent
					m.StorageUsedBytes = u.Used
					m.StorageTotalBytes = u.Total
				}
				break
			}
		}
	}

	if uptime, err := host.Uptime(); err == nil {
		m.UptimeSeconds = uptime
	}

	return m
}
