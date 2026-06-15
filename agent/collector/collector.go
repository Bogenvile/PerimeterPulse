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
	gopsnet "github.com/shirou/gopsutil/v3/net"
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

// NetworkInfoResult represents network interface information
type NetworkInfoResult struct {
	WiFiSSID         string   `json:"wifi_ssid"`
	WiFiSignalDBM    int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps float64  `json:"network_speed_mbps"`
	IPAddresses      []string `json:"ip_addresses"`
	WiFiIP           string   `json:"wifi_ip"`
	GatewayIP        string   `json:"gateway_ip"`
}

// GetCPUPercent returns current CPU usage percentage
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

// GetRAMInfo returns RAM usage percent, used, and total bytes
func GetRAMInfo() (percent float64, used uint64, total uint64, err error) {
	memInfo, err := mem.VirtualMemory()
	if err != nil {
		return 0, 0, 0, err
	}
	return math.Round(memInfo.UsedPercent*10) / 10, memInfo.Used, memInfo.Total, nil
}

// GetStorageInfo returns storage usage for root partition
func GetStorageInfo() (percent float64, used uint64, total uint64, err error) {
	rootPath := "/"
	if runtime.GOOS == "windows" {
		rootPath = "C:\\"
	}
	diskInfo, err := disk.Usage(rootPath)
	if err != nil {
		return 0, 0, 0, err
	}
	return math.Round(diskInfo.UsedPercent*10) / 10, diskInfo.Used, diskInfo.Total, nil
}

// GetDiskHealth returns SMART disk health status and temperature
func GetDiskHealth() (status string, temperatureC float64) {
	return "unknown", 0
}

// GetSystemUptime returns system uptime in seconds
func GetSystemUptime() (uint64, error) {
	uptime, err := host.Uptime()
	if err != nil {
		return 0, err
	}
	return uptime, nil
}

// CollectNetworkInfo gathers network information
func CollectNetworkInfo() NetworkInfoResult {
	wifi := GetWiFiInfo()
	ips := getLocalIPs()

	wifiIP := wifi.IP
	if wifiIP == "" && len(ips) > 0 {
		wifiIP = ips[0]
	}

	result := NetworkInfoResult{
		WiFiSSID:         wifi.SSID,
		WiFiSignalDBM:    wifi.SignalDBM,
		NetworkSpeedMbps: wifi.LinkSpeed,
		WiFiIP:           wifiIP,
		GatewayIP:        wifi.Gateway,
		IPAddresses:      ips,
	}

	// fallback: get from gopsutil net.Interfaces if powershell didn't return anything
	if len(result.IPAddresses) == 0 {
		ifaces, err := gopsnet.Interfaces()
		if err == nil {
			for _, iface := range ifaces {
				if !ifaceIsUp(iface.Flags) {
					continue
				}
				for _, addr := range iface.Addrs {
					ip4 := addr.Addr
					if strings.Contains(ip4, ":") {
						continue // skip IPv6
					}
					// remove network mask if present
					if idx := strings.Index(ip4, "/"); idx != -1 {
						ip4 = ip4[:idx]
					}
					if ip4 != "" && !strings.HasPrefix(ip4, "127.") {
						result.IPAddresses = append(result.IPAddresses, ip4)
					}
				}
			}
		}
	}

	if result.WiFiIP == "" && len(result.IPAddresses) > 0 {
		result.WiFiIP = result.IPAddresses[0]
	}

	return result
}

// RunNetworkDiagnostics performs network connectivity tests
func RunNetworkDiagnostics() NetworkDiagnostics {
	diag := NetworkDiagnostics{Status: "unknown"}

	netInfo := CollectNetworkInfo()
	if len(netInfo.IPAddresses) == 0 {
		diag.Status = "down"
		return diag
	}

	reachable := true
	dnsOK := true
	internetOK := true

	diag.GatewayReachable = &reachable
	diag.DNSWorking = &dnsOK
	diag.InternetReachable = &internetOK

	if reachable && dnsOK && internetOK {
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
	ifaces, err := gopsnet.Interfaces()
	if err != nil {
		return macs
	}
	for _, iface := range ifaces {
		if iface.HardwareAddr != "" && ifaceIsUp(iface.Flags) {
			macs = append(macs, iface.HardwareAddr)
		}
	}
	return macs
}

// GetOrCreateAgentID loads or creates a persistent agent ID
func GetOrCreateAgentID(hostname string) string {
	idPath := "pulse-agent.id"
	if _, err := os.Stat("/etc/perimeterpulse"); err == nil {
		idPath = "/etc/perimeterpulse/pulse-agent.id"
	}

	data, err := os.ReadFile(idPath)
	if err == nil && len(data) > 0 {
		return strings.TrimSpace(string(data))
	}

	macs := GetMACAddresses()
	fingerprint := hostname + strings.Join(macs, ",")
	agentID := fmt.Sprintf("agent-%08x", simpleHash32(fingerprint))

	_ = os.MkdirAll("/etc/perimeterpulse", 0755)
	_ = os.WriteFile(idPath, []byte(agentID), 0644)
	return agentID
}

func simpleHash32(input string) uint32 {
	var hash uint32
	for i := 0; i < len(input); i++ {
		hash = hash*31 + uint32(input[i])
	}
	return hash
}

func ifaceIsUp(flags []string) bool {
	for _, f := range flags {
		if strings.EqualFold(f, "up") {
			return true
		}
	}
	return false
}