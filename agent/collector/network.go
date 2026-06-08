package collector

import (
	"net"
	"os/exec"
	"runtime"
	"strings"
)

// NetworkInfo holds WiFi / IP information.
type NetworkInfo struct {
	WiFiSSID        string   `json:"wifi_ssid"`
	WiFiSignalDBM   int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps float64 `json:"network_speed_mbps"`
	IPAddresses     []string `json:"ip_addresses"`
}

// CollectNetworkInfo gathers WiFi SSID, signal strength, and local IPs.
func CollectNetworkInfo() NetworkInfo {
	info := NetworkInfo{}

	// IP addresses
	addrs, err := net.InterfaceAddrs()
	if err == nil {
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && ipnet.IP.IsGlobalUnicast() {
				info.IPAddresses = append(info.IPAddresses, ipnet.IP.String())
			}
		}
	}

	// WiFi info (platform-specific)
	if runtime.GOOS == "windows" {
		info.WiFiSSID, info.WiFiSignalDBM = getWindowsWiFi()
	} else {
		info.WiFiSSID, info.WiFiSignalDBM = getLinuxWiFi()
	}

	if info.WiFiSignalDBM == 0 {
		info.WiFiSignalDBM = -999 // sentinel for "no data"
	}

	info.NetworkSpeedMbps = 0
	return info
}

func getWindowsWiFi() (string, int) {
	// netsh wlan show interfaces
	out, err := exec.Command("netsh", "wlan", "show", "interfaces").Output()
	if err != nil {
		return "", 0
	}
	lines := strings.Split(string(out), "\n")
	ssid := ""
	signal := 0
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "SSID") && !strings.Contains(trimmed, "BSSID") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				ssid = strings.TrimSpace(parts[1])
			}
		}
		if strings.HasPrefix(trimmed, "Signal") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				sigStr := strings.TrimSpace(parts[1])
				sigStr = strings.TrimSuffix(sigStr, "%")
				if s, err := parseInt(sigStr); err == nil {
					// Windows gives 0-100%; map to dBm roughly
					signal = s*100/100 - 100 // rough mapping
				}
			}
		}
	}
	return ssid, signal
}

func getLinuxWiFi() (string, int) {
	// iwgetid -r for SSID
	out, err := exec.Command("iwgetid", "-r").Output()
	ssid := ""
	if err == nil {
		ssid = strings.TrimSpace(string(out))
	}

	// iwconfig for signal level
	out2, err := exec.Command("iwconfig").Output()
	signal := 0
	if err == nil {
		lines := strings.Split(string(out2), "\n")
		for _, line := range lines {
			if strings.Contains(line, "Signal level") {
				parts := strings.Fields(line)
				for i, p := range parts {
					if strings.Contains(p, "Signal") && i+1 < len(parts) {
						valStr := strings.TrimPrefix(parts[i+1], "level=")
						if s, err := parseInt(valStr); err == nil {
							signal = s
						}
					}
				}
			}
		}
	}

	return ssid, signal
}

func parseInt(s string) (int, error) {
	var n int
	for _, c := range s {
		if c == '-' && n == 0 {
			continue // negative sign handled below
		}
		if c < '0' || c > '9' {
			break
		}
		n = n*10 + int(c-'0')
	}
	if strings.HasPrefix(s, "-") {
		n = -n
	}
	return n, nil
}