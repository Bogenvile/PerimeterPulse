package collector

import (
	"fmt"
	"math"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

type SystemInfo struct {
	CPUModel      string
	CPUCores      int
	RAMTotal      uint64
	StorageTotal  uint64
	Hostname      string
	OS            string
	OSVersion     string
	MacAddresses  []string
}

func CollectSystemInfo() SystemInfo {
	info := SystemInfo{
		Hostname: getHostname(),
		OS:       runtime.GOOS,
	}

	// OS Version
	platform, _, version, _ := host.PlatformInformation()
	info.OSVersion = fmt.Sprintf("%s %s", platform, version)

	// CPU
	if cpuInfo, err := cpu.Info(); err == nil && len(cpuInfo) > 0 {
		info.CPUModel = cpuInfo[0].ModelName
		info.CPUCores = len(cpuInfo)
	}

	// RAM
	if vmem, err := mem.VirtualMemory(); err == nil {
		info.RAMTotal = vmem.Total
	}

	// Storage - ONLY root physical disk, exclude virtual/loop/snap
	info.StorageTotal = getPhysicalStorageTotal()

	// MAC addresses
	info.MacAddresses = getMacAddresses()

	return info
}

func getHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return hostname
}

func getPhysicalStorageTotal() uint64 {
	switch runtime.GOOS {
	case "linux":
		return getLinuxPhysicalStorage()
	case "windows":
		return getWindowsPhysicalStorage()
	default:
		return getStorageFromRootPartition()
	}
}

func getLinuxPhysicalStorage() uint64 {
	// Use lsblk to get the physical disk size (not partition)
	// This avoids counting virtual/loop/snap disks
	cmd := exec.Command("lsblk", "-b", "-d", "-o", "NAME,SIZE,TYPE,MOUNTPOINT", "-n")
	out, err := cmd.Output()
	if err != nil {
		return getStorageFromRootPartition()
	}

	var total uint64
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}

		name := fields[0]
		diskType := ""
		if len(fields) >= 3 {
			diskType = fields[2]
		}

		// Skip loop, ram, snap, sr (CD-ROM), and virtual devices
		if strings.HasPrefix(name, "loop") ||
			strings.HasPrefix(name, "ram") ||
			strings.HasPrefix(name, "sr") ||
			strings.Contains(name, "snap") {
			continue
		}

		// Only count physical disks, not partitions
		if diskType != "disk" {
			continue
		}

		sizeBytes, err := strconv.ParseUint(fields[1], 10, 64)
		if err == nil && sizeBytes > 0 {
			total += sizeBytes
		}
	}

	if total == 0 {
		return getStorageFromRootPartition()
	}

	return total
}

func getWindowsPhysicalStorage() uint64 {
	// PowerShell: Get total physical disk size (not partition)
	cmd := exec.Command("powershell", "-Command",
		"(Get-PhysicalDisk | Measure-Object -Property Size -Sum).Sum")
	out, err := cmd.Output()
	if err == nil {
		val := strings.TrimSpace(string(out))
		if size, err := strconv.ParseUint(val, 10, 64); err == nil && size > 0 {
			return size
		}
	}

	// Fallback: root partition
	return getStorageFromRootPartition()
}

func getStorageFromRootPartition() uint64 {
	usage, err := disk.Usage("/")
	if err != nil {
		return 0
	}
	return usage.Total
}

func getMacAddresses() []string {
	var macs []string
	interfaces, err := net.Interfaces()
	if err != nil {
		return macs
	}

	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		if iface.HardwareAddr != nil && len(iface.HardwareAddr) > 0 {
			macs = append(macs, iface.HardwareAddr.String())
		}
	}
	return macs
}

type Metrics struct {
	CPUPercent       float64
	RAMPercent       float64
	RAMUsed          uint64
	RAMTotal         uint64
	StoragePercent   float64
	StorageUsed      uint64
	StorageTotal     uint64
	UptimeSeconds    uint64
	NetworkStatus    string
	NetworkLatencyMs float64
	DiskHealthStatus string
	DiskTemperatureC int
}

func CollectMetrics() Metrics {
	m := Metrics{}

	// CPU
	if percent, err := cpu.Percent(time.Second, false); err == nil && len(percent) > 0 {
		m.CPUPercent = math.Round(percent[0]*10) / 10
	}

	// RAM
	if vmem, err := mem.VirtualMemory(); err == nil {
		m.RAMPercent = math.Round(vmem.UsedPercent*10) / 10
		m.RAMUsed = vmem.Used
		m.RAMTotal = vmem.Total
	}

	// Storage (root partition for percent usage)
	if usage, err := disk.Usage("/"); err == nil {
		m.StoragePercent = math.Round(usage.UsedPercent*10) / 10
		m.StorageUsed = usage.Used
		m.StorageTotal = usage.Total
	}

	// Uptime
	if uptime, err := host.Uptime(); err == nil {
		m.UptimeSeconds = uptime
	}

	// Network diagnostics (dari diag.go)
	m.NetworkStatus, m.NetworkLatencyMs = RunNetworkDiagnostics()

	// Disk info (dari smart.go)
	diskInfo := CollectDiskInfo()
	m.DiskHealthStatus = diskInfo.HealthStatus
	m.DiskTemperatureC = diskInfo.Temperature

	return m
}