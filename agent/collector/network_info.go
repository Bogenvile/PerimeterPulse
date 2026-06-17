package collector

import (
	"net"
	"os/exec"
	"strconv"
	"strings"
)

// getWiFiSSID returns the WiFi SSID name
func getWiFiSSID() string {
	return getWiFiSSIDPlatform()
}

// getWiFiSignalDBM returns the WiFi signal strength in dBm
func getWiFiSignalDBM() int {
	return getWiFiSignalDBMPlatform()
}

// getNetworkSpeedMbps returns the network link speed in Mbps
func getNetworkSpeedMbps() uint64 {
	return getNetworkSpeedMbpsPlatform()
}

// getWiFiIP returns the IP address of the WiFi adapter
func getWiFiIP() string {
	return getWiFiIPPlatform()
}

// getDefaultGatewayIP returns the default gateway IP
func getDefaultGatewayIP() string {
	return getDefaultGatewayIPPlatform()
}

// Default (non-platform-specific) implementations

func getWiFiSSIDPlatform() string { return "" }
func getWiFiSignalDBMPlatform() int { return 0 }
func getNetworkSpeedMbpsPlatform() uint64 { return 0 }
func getWiFiIPPlatform() string { return "" }
func getDefaultGatewayIPPlatform() string { return "" }

// ─── Windows implementations ───

// getWiFiSSIDWindows gets WiFi SSID using netsh on Windows
func getWiFiSSIDWindows() string {
	cmd := exec.Command("netsh", "wlan", "show", "interfaces")
	out, err := cmd.Output()
	if err != nil {
		return ""
	}

	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "SSID") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				return strings.TrimSpace(parts[1])
			}
		}
	}
	return ""
}

// getWiFiSignalDBMWindows gets WiFi signal from netsh
func getWiFiSignalDBMWindows() int {
	cmd := exec.Command("netsh", "wlan", "show", "interfaces")
	out, err := cmd.Output()
	if err != nil {
		return 0
	}

	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "Signal") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				signal := strings.TrimSpace(parts[1])
				signal = strings.TrimSuffix(signal, "%")
				if val, err := strconv.Atoi(signal); err == nil {
					// Convert percentage to dBm (approximate)
					// 100% ≈ -30 dBm, 0% ≈ -90 dBm
					return -90 + (val * 60 / 100)
				}
			}
		}
	}
	return 0
}

// getNetworkSpeedMbpsWindows gets network speed from netsh
func getNetworkSpeedMbpsWindows() uint64 {
	cmd := exec.Command("netsh", "wlan", "show", "interfaces")
	out, err := cmd.Output()
	if err != nil {
		return 0
	}

	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "Receive rate") || strings.HasPrefix(trimmed, "Transmit rate") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				rate := strings.TrimSpace(parts[1])
				rate = strings.TrimSuffix(rate, "Mbps")
				if val, err := strconv.ParseUint(strings.TrimSpace(rate), 10, 64); err == nil {
					return val
				}
			}
		}
	}
	return 0
}

// getDefaultGatewayIPWindows gets default gateway via route print
func getDefaultGatewayIPWindows() string {
	cmd := exec.Command("cmd", "/c", "route print 0.0.0.0")
	out, err := cmd.Output()
	if err != nil {
		return ""
	}

	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.Contains(trimmed, "0.0.0.0") {
			fields := strings.Fields(trimmed)
			if len(fields) >= 3 {
				ip := fields[2]
				if net.ParseIP(ip) != nil && ip != "0.0.0.0" {
					return ip
				}
			}
		}
	}
	return ""
}