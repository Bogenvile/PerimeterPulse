//go:build windows

package collector

import (
	"net"
	"os/exec"
	"strconv"
	"strings"
)

func init() {
	getWiFiSSIDFunc = getWiFiSSIDWindows
	getWiFiSignalDBMFunc = getWiFiSignalDBMWindows
	getNetworkSpeedMbpsFunc = getNetworkSpeedMbpsWindows
	getDefaultGatewayFunc = getDefaultGatewayIPWindows
}

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
					return -90 + (val * 60 / 100)
				}
			}
		}
	}
	return 0
}

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