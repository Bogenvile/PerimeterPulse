//go:build windows

package collector

import (
	"os/exec"
	"strings"
)

func init() {
	detectDefaultGateway = windowsDefaultGateway
	getWifiSSID = windowsWifiSSID
	getWifiSignal = windowsWifiSignal
}

func windowsDefaultGateway() string {
	// ipconfig | findstr "Default Gateway"
	out, err := exec.Command("ipconfig").Output()
	if err != nil {
		return ""
	}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		if strings.Contains(line, "Default Gateway") {
			parts := strings.Split(line, ":")
			if len(parts) >= 2 {
				gw := strings.TrimSpace(parts[len(parts)-1])
				if gw != "" && gw != "::" {
					return gw
				}
			}
		}
	}
	return ""
}

func windowsWifiSSID() string {
	out, err := exec.Command("netsh", "wlan", "show", "interfaces").Output()
	if err != nil {
		return ""
	}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		if strings.Contains(line, "SSID") && !strings.Contains(line, "BSSID") {
			parts := strings.Split(line, ":")
			if len(parts) >= 2 {
				return strings.TrimSpace(parts[len(parts)-1])
			}
		}
	}
	return ""
}

func windowsWifiSignal() int {
	out, err := exec.Command("netsh", "wlan", "show", "interfaces").Output()
	if err != nil {
		return 0
	}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		if strings.Contains(line, "Signal") {
			parts := strings.Split(line, ":")
			if len(parts) >= 2 {
				signalStr := strings.TrimSpace(parts[len(parts)-1])
				signalStr = strings.Replace(signalStr, "%", "", 1)
				var pct int
				fmt.Sscanf(signalStr, "%d", &pct)
				// Convert percentage to approximate dBm: higher % = better signal
				// Rough mapping: 0% = -100 dBm, 100% = -30 dBm
				if pct > 0 {
					return -(100 - pct*70/100)
				}
			}
		}
	}
	return 0
}