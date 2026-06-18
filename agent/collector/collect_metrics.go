package collector

import (
	"log"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

func CollectMetrics(agentID string) MetricsPayload {
	cpuPercent, err := cpu.Percent(0, false)
	if err != nil {
		log.Printf("cpu.Percent error: %v", err)
	}
	var cpuPct float64
	if len(cpuPercent) > 0 {
		cpuPct = cpuPercent[0]
	}

	var ramPct float64
	var ramUsed, ramTotal uint64
	if runtime.GOOS == "windows" {
		ramTotal, ramUsed = detectRAM()
	}
	if ramTotal == 0 {
		memInfo, err := mem.VirtualMemory()
		if err != nil {
			log.Printf("mem.VirtualMemory error: %v", err)
		}
		if memInfo != nil && memInfo.Total > 0 {
			ramPct = memInfo.UsedPercent
			ramUsed = memInfo.Used
			ramTotal = memInfo.Total
		}
	}
	if ramTotal > 0 && ramPct == 0 {
		ramPct = float64(ramUsed) / float64(ramTotal) * 100
	}

	var diskPct float64
	var diskUsed, diskTotal uint64
	if runtime.GOOS == "windows" {
		diskPct, diskUsed, diskTotal = detectDiskUsage()
	}
	if diskTotal == 0 {
		path := "/"
		if runtime.GOOS == "windows" {
			path = "C:"
		}
		usage, err := disk.Usage(path)
		if err != nil {
			log.Printf("disk.Usage error: %v", err)
		} else {
			diskPct = usage.UsedPercent
			diskUsed = usage.Used
			diskTotal = usage.Total
		}
	}

	uptime, err := host.Uptime()
	if err != nil {
		log.Printf("host.Uptime error: %v", err)
	}

	diag := RunDiagnostics()
	pingLatency, _ := PingGoogle()

	cpuModel, cpuCores := collectCPUInfo()
	diskType, diskModel, diskHealth, diskTemp := collectDiskInfo()
	diskHealthPercent := 100.0
	if runtime.GOOS == "windows" {
		diskHealthPercent = detectDiskHealthPercent()
	}

	return MetricsPayload{
		CPUPerecent:       cpuPct,
		RAMPerecent:       ramPct,
		RAMUsedBytes:      ramUsed,
		RAMTotalBytes:     ramTotal,
		StoragePercent:    diskPct,
		StorageUsedBytes:  diskUsed,
		StorageTotalBytes: diskTotal,
		UptimeSeconds:     uptime,
		NetworkStatus:     diag.Status,
		NetworkLatencyMs:  pingLatency,
		PingLatencyMs:     pingLatency,
		ErrorCount:        0,
		CPUModel:          cpuModel,
		CPUCores:          cpuCores,
		DiskType:          diskType,
		DiskModel:         diskModel,
		DiskHealthStatus:  diskHealth,
		DiskHealthPercent: diskHealthPercent,
		DiskTemperatureC:  diskTemp,
		GatewayReachable:  diag.GatewayReachable,
		DNSWorking:        diag.DNSWorking,
		InternetReachable: diag.InternetReachable,
		DefaultGateway:    diag.DefaultGateway,
		Timestamp:         time.Now().UTC().Format(time.RFC3339),
	}
}

func collectCPUInfo() (model string, cores int) {
	if runtime.GOOS == "windows" {
		model, cores = detectCPU()
		if model != "Unknown" && cores > 0 {
			return
		}
	}

	info, err := cpu.Info()
	if err != nil || len(info) == 0 {
		return "Unknown", 1
	}
	model = info[0].ModelName
	if model == "" {
		model = "Unknown"
	}
	cores, _ = cpu.Counts(true)
	if cores == 0 {
		cores = 1
	}
	return
}

func collectDiskInfo() (diskType, diskModel, diskHealth string, diskTemp float64) {
	if runtime.GOOS == "windows" {
		diskType, diskModel, diskHealth, diskTemp = detectDiskInfo()
		if diskModel != "" || diskHealth != "unknown" {
			return
		}
	}

	parts, err := disk.Partitions(false)
	if err != nil || len(parts) == 0 {
		return "unknown", "", "unknown", 0
	}

	diskType = "unknown"
	if len(parts) > 0 {
		dev := parts[0].Device
		if len(dev) >= 4 && dev[0:4] == "nvme" {
			diskType = "nvme"
		} else if len(dev) >= 2 && dev[0:2] == "sd" {
			diskType = "ssd"
		} else if len(dev) >= 2 && dev[0:2] == "hd" {
			diskType = "hdd"
		}
	}

	return diskType, "", "unknown", 0
}
