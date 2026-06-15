//go:build linux

package collector

import (
	"os/exec"
	"strings"
)

func init() {
	detectDefaultGateway = linuxDefaultGateway
	getWifiSSID = linuxWifiSSID
	getWifiSignal = linuxWifiSignal
}

func linuxDefaultGateway() string {
	out, err := exec.Command("ip", "route", "show", "default").Output()
	if err != nil {
		return ""
	}
	fields := strings.Fields(string(out))
	for i, f := range fields {
		if f == "via" && i+1 < len(fields) {
			return fields[i+1]
		}
	}
	return ""
}

func linuxWifiSSID() string {
	out, err := exec.Command("iwgetid", "-r").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func linuxWifiSignal() int {
	out, err := exec.Command("sh", "-c", "iwconfig 2>/dev/null | grep -i quality").Output()
	if err != nil {
		return 0
	}
	line := string(out)
	// Example: Link Quality=70/70 Signal level=-40 dBm
	if idx := strings.Index(line, "Signal level="); idx != -1 {
		rest := line[idx+len("Signal level="):]
		parts := strings.Fields(rest)
		if len(parts) > 0 {
			signalStr := strings.TrimSuffix(parts[0], "dBm")
			signalStr = strings.TrimSpace(signalStr)
			var dbm int
			if n, _ := fmt.Sscanf(signalStr, "%d", &dbm); n == 1 {
				return dbm
			}
		}
	}
	return 0
}