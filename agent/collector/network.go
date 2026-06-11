package collector

import (
	"net"
	"os/exec"
	"strconv"
	"strings"
)

// CollectNetworkInfo returns network info using the enhanced Windows detectors
func CollectNetworkInfo() NetworkInfoData {
	wifi := GetWiFiInfo()
	ips := getLocalIPs()

	// Use WiFi IP as primary if available
	wifiIP := wifi.IP
	if wifiIP == "" && len(ips) > 0 {
		wifiIP = ips[0]
	}

	return NetworkInfoData{
		WiFiSSID:         wifi.SSID,
		WiFiSignalDBM:    wifi.SignalDBM,
		NetworkSpeedMbps: wifi.LinkSpeed,
		WiFiIP:           wifiIP,
		GatewayIP:        wifi.Gateway,
		IPAddresses:      ips,
	}
}

// GetDiskInfo returns disk model, type, total and used bytes
func GetDiskInfo() (model string, diskType string, totalBytes uint64, usedBytes uint64) {
	model = GetDiskModel()
	diskType = DetectDiskType()
	totalBytes, usedBytes = GetDiskUsage()
	return
}

// GetCPUInfo returns CPU model and core count
func GetCPUInfo() (model string, cores int) {
	return detectCPU()
}

// GetRAMInfo returns total and used RAM
func GetRAMInfo() (total uint64, used uint64) {
	total = getTotalRAM()
	used = getUsedRAM()
	return
}

// Helper function for getting active network IP
func getActiveIP() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return ""
	}

	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			if ipNet, ok := addr.(*net.IPNet); ok {
				ip4 := ipNet.IP.To4()
				if ip4 != nil && !ip4.IsLoopback() && !ip4.IsLinkLocalUnicast() {
					// Check if this interface has a gateway
					gw := getDefaultGatewayForInterface(iface.Index)
					if gw != "" {
						return ip4.String()
					}
				}
			}
		}
	}

	// Fallback: first non-loopback IPv4
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			if ipNet, ok := addr.(*net.IPNet); ok {
				ip4 := ipNet.IP.To4()
				if ip4 != nil && !ip4.IsLoopback() {
					return ip4.String()
				}
			}
		}
	}

	return ""
}