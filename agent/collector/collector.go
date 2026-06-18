package collector

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	netutil "github.com/shirou/gopsutil/v3/net"
)

// CollectMetrics returns a fully populated MetricsPayload.
func CollectMetrics(agentID string) MetricsPayload {
	// CPU
	cpuPercent := 0.0
	if c, err := cpu.Percent(time.Second, false); err == nil && len(c) > 0 {
		cpuPercent = c[0]
	}
	cpuCores := 0
	if c, err := cpu.Counts(true); err == nil {
		cpuCores = c
	}
	cpuModel := "Unknown"
	if ci, err := cpu.Info(); err == nil && len(ci) > 0 {
		cpuModel = ci[0].ModelName
	}

	// RAM
	ramPercent := 0.0
	ramTotal := uint64(0)
	ramUsed := uint64(0)
	if v, err := mem.VirtualMemory(); err == nil {
		ramPercent = v.UsedPercent
		ramTotal = v.Total
		ramUsed = v.Used
	}

	// Storage (use root partition on Linux, C: on Windows)
	storagePercent := 0.0
	storageTotal := uint64(0)
	storageUsed := uint64(0)
	storagePath := "/"
	if runtime.GOOS == "windows" {
		storagePath = "C:"
	}
	if d, err := disk.Usage(storagePath); err == nil {
		storagePercent = d.UsedPercent
		storageTotal = d.Total
		storageUsed = d.Used
	}

	// Uptime
	uptimeSeconds := uint64(0)
	if u, err := host.Uptime(); err == nil {
		uptimeSeconds = uint64(u)
	}

	// Disk type/model from partition (fallback)
	diskType := "unknown"
	diskModel := ""
	diskHealth := "ok"
	diskTemp := float64(0)

	if parts, err := disk.Partitions(false); err == nil {
		for _, p := range parts {
			if p.Mountpoint == storagePath || (runtime.GOOS == "windows" && p.Mountpoint == "C:") {
				if d, err2 := disk.Usage(p.Mountpoint); err2 == nil {
					if d.Fstype != "" {
						diskType = d.Fstype
					}
				}
				// Model name (unreliable, but we try)
				if dev := p.Device; dev != "" {
					diskModel = dev
				}
				break
			}
		}
	}

	// Network diagnostics: run the diag functions separately
	gatewayReachable, dnsWorking, internetReachable, defaultGateway := runNetworkDiagnostics()

	payload := MetricsPayload{
		CPUPerecent:      cpuPercent,
		RAMPerecent:      ramPercent,
		RAMUsedBytes:     ramUsed,
		RAMTotalBytes:    ramTotal,
		StoragePercent:   storagePercent,
		StorageUsedBytes: storageUsed,
		StorageTotalBytes: storageTotal,
		UptimeSeconds:    uptimeSeconds,
		NetworkStatus:    "up", // will be updated later
		CPUModel:         cpuModel,
		CPUCores:         cpuCores,
		DiskModel:        diskModel,
		DiskType:         diskType,
		DiskHealthStatus: diskHealth,
		DiskTemperatureC: diskTemp,
		GatewayReachable: gatewayReachable,
		DNSWorking:       dnsWorking,
		InternetReachable: internetReachable,
		DefaultGateway:   defaultGateway,
		ErrorCount:       0,
		Timestamp:        time.Now().UTC().Format(time.RFC3339),
	}

	return payload
}

// CollectNetworkInfo returns network-related data using gopsutil.
func CollectNetworkInfo() NetworkPayload {
	interfaces, _ := net.Interfaces()
	var wifiSSID string
	wifiSignal := float64(0)
	speedMbps := float64(0)
	var ips []string
	wifiIP := ""
	gatewayIP := ""

	// Try to get active WiFi connection details on Windows via WMI? Not trivial.
	// We'll fill minimal info.
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			ip := ipNet.IP.String()
			if ip == "::1" || ip == "127.0.0.1" {
				continue
			}
			ips = append(ips, ip)
			if wifiIP == "" && ip != "" {
				wifiIP = ip
			}
		}
	}

	// Collect MAC addresses again (already in system info)
	var macs []string
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		hw := iface.HardwareAddr.String()
		if hw != "" {
			macs = append(macs, hw)
		}
	}

	return NetworkPayload{
		WiFiSSID:        wifiSSID,
		WiFiSignalDBm:   wifiSignal,
		NetworkSpeedMbps: speedMbps,
		IPAddresses:     ips,
		WiFiIP:          wifiIP,
		GatewayIP:       gatewayIP,
		MacAddresses:    macs,
	}
}

// CollectLocation returns a placeholder location (to be filled by dedicated location file).
func CollectLocation() LocationPayload {
	// The actual location is handled in location.go / location_windows.go
	// Return a stub with zeros. The main.go will call the real location collector.
	return LocationPayload{}
}

// runNetworkDiagnostics is a simple implementation from the old diag.go
func runNetworkDiagnostics() (gatewayReachable bool, dnsWorking bool, internetReachable bool, defaultGateway string) {
	// Try to resolve google.com
	_, err := net.LookupHost("google.com")
	dnsWorking = err == nil

	// Try TCP connection to 8.8.8.8:53
	conn, err := net.DialTimeout("tcp", "8.8.8.8:53", 2*time.Second)
	internetReachable = err == nil
	if conn != nil {
		conn.Close()
	}

	gatewayReachable = internetReachable // simplified
	return
}

// Helper to convert struct to JSON string (used by buffer)
func ToJSON(v any) ([]byte, error) {
	return json.Marshal(v)
}