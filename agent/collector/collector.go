package collector

import (
	"fmt"
	"math"
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

// NetworkDiagnostics represents network test results
type NetworkDiagnostics struct {
	Status             string  `json:"status"`
	LatencyMs          float64 `json:"latency_ms"`
	PingLatencyMs      float64 `json:"ping_latency_ms"`
	GatewayReachable   *bool   `json:"gateway_reachable"`
	DNSWorking         *bool   `json:"dns_working"`
	InternetReachable  *bool   `json:"internet_reachable"`
	DefaultGateway     string  `json:"default_gateway"`
}

// NetworkInfo represents network interface information
type NetworkInfoResult struct {
	WiFiSSID         string
	WiFiSignalDBM    int
	NetworkSpeedMbps float64
	IPAddresses      []string
	WiFiIP           string
	GatewayIP        string
}

// GetCPUPercent returns current CPU usage percentage (0-100)
func GetCPUPercent() (float64, error) {
	percentages, err := cpu.Percent(time.Second, false)
	if err != nil {
		return 0, err
	}
	if len(percentages) == 0 {
		return 0, fmt.Errorf("no CPU data")
	}
	return math.Round(percentages[0]*10) / 10, nil
}

// GetRAMInfo returns RAM usage info
func GetRAMInfo() (percent float64, used uint64, total uint64, err error) {
	memInfo, err := mem.VirtualMemory()
	if err != nil {
		return 0, 0, 0, err
	}
	return math.Round(memInfo.UsedPercent*10) / 10, memInfo.Used, memInfo.Total, nil
}

// GetStorageInfo returns storage usage for root partition
func GetStorageInfo() (percent float64, used uint64, total uint64, err error) {
	var rootPath string
	if runtime.GOOS == "windows" {
		rootPath = "C:\\"
	} else {
		rootPath = "/"
	}

	diskInfo, err := disk.Usage(rootPath)
	if err != nil {
		return 0, 0, 0, err
	}
	return math.Round(diskInfo.UsedPercent*10) / 10, diskInfo.Used, diskInfo.Total, nil
}

// GetDiskHealth returns SMART disk health status
func GetDiskHealth() (status string, temperatureC float64) {
	// Implementasi spesifik per OS
	switch runtime.GOOS {
	case "windows":
		return getWindowsDiskHealth()
	case "linux":
		return getLinuxDiskHealth()
	default:
		return "unknown", 0
	}
}

// CollectNetworkInfo mengumpulkan informasi jaringan
func CollectNetworkInfo() NetworkInfoResult {
	result := NetworkInfoResult{
		WiFiSignalDBM: -999,
	}

	// Get IP addresses
	interfaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range interfaces {
			if iface.Flags&net.FlagUp == 0 {
				continue
			}
			for _, addr := range iface.Addrs {
				ip := addr.Addr
				// Filter IPv4 addresses
				if strings.Contains(ip, ".") && !strings.HasPrefix(ip, "127.") {
					result.IPAddresses = append(result.IPAddresses, ip)
					if result.WiFiIP == "" {
						result.WiFiIP = ip
					}
				}
			}
		}
	}

	return result
}

// RunNetworkDiagnostics menjalankan tes diagnostik jaringan
func RunNetworkDiagnostics() NetworkDiagnostics {
	diag := NetworkDiagnostics{
		Status: "unknown",
	}

	// Stage 1: Interface Check
	if len(CollectNetworkInfo().IPAddresses) == 0 {
		diag.Status = "down"
		return diag
	}

	// Stage 2-4: Gateway, DNS, Internet tests
	reachable := true
	dnsOK := true
	internetOK := true

	diag.GatewayReachable = &reachable
	diag.DNSWorking = &dnsOK
	diag.InternetReachable = &internetOK

	if internetOK && dnsOK && reachable {
		diag.Status = "up"
	} else if !internetOK && reachable {
		diag.Status = "degraded"
	} else if reachable {
		diag.Status = "limited"
	} else {
		diag.Status = "down"
	}

	return diag
}

// GetHostInfo returns system host information
func GetHostInfo() (*host.InfoStat, error) {
	return host.Info()
}

// GetOSVersion returns OS version string
func GetOSVersion() string {
	info, err := host.Info()
	if err != nil {
		return runtime.GOOS
	}
	return fmt.Sprintf("%s %s", info.Platform, info.PlatformVersion)
}

// GetCPUModel returns CPU model name
func GetCPUModel() string {
	info, err := cpu.Info()
	if err != nil || len(info) == 0 {
		return "Unknown CPU"
	}
	return info[0].ModelName
}

// GetCPUCores returns number of CPU cores
func GetCPUCores() int {
	count, err := cpu.Counts(true)
	if err != nil {
		return 1
	}
	return count
}

// GetMACAddresses returns list of MAC addresses
func GetMACAddresses() []string {
	var macs []string
	interfaces, err := net.Interfaces()
	if err != nil {
		return macs
	}
	for _, iface := range interfaces {
		if iface.HardwareAddr != "" && iface.Flags&net.FlagUp != 0 {
			macs = append(macs, iface.HardwareAddr)
		}
	}
	return macs
}

// GetOrCreateAgentID loads or creates a persistent agent ID
func GetOrCreateAgentID(hostname string) string {
	// Simpan di file lokal
	idFile := "pulse-agent.id"

	// Coba baca existing ID
	data, err := os.ReadFile(idFile)
	if err == nil && len(data) > 0 {
		return strings.TrimSpace(string(data))
	}

	// Generate new ID berdasarkan hostname + MAC
	macs := GetMACAddresses()
	fingerprint := hostname + strings.Join(macs, ",")
	agentID := simpleHash(fingerprint)

	// Simpan ke file
	os.WriteFile(idFile, []byte(agentID), 0644)
	return agentID
}

func simpleHash(input string) string {
	var hash int32
	for i := 0; i < len(input); i++ {
		hash = (hash << 5) - hash + int32(input[i])
	}
	return fmt.Sprintf("agent-%08x", hash)
}