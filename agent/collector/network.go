package collector

import (
	"net"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	psnet "github.com/shirou/gopsutil/v3/net"
)

// getWifiSSID returns the currently connected WiFi network name.
func getWifiSSID() string {
	switch runtime.GOOS {
	case "windows":
		return getWifiSSIDWindows()
	case "linux":
		return getWifiSSIDLinux()
	default:
		return ""
	}
}

func getWifiSSIDWindows() string {
	out, err := exec.Command("netsh", "wlan", "show", "interfaces").CombinedOutput()
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(out), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "SSID") && !strings.Contains(trimmed, "BSSID") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				return strings.TrimSpace(parts[1])
			}
		}
	}
	return ""
}

func getWifiSSIDLinux() string {
	// Try iwgetid first (most reliable)
	out, err := exec.Command("iwgetid", "-r").CombinedOutput()
	if err == nil {
		return strings.TrimSpace(string(out))
	}

	// Try iwconfig
	out, err = exec.Command("iwconfig", "2>/dev/null").CombinedOutput()
	if err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			if strings.Contains(line, "ESSID:") && !strings.Contains(line, "off/any") {
				parts := strings.Split(line, "ESSID:")
				if len(parts) > 1 {
					ssid := strings.Trim(parts[1], ` "`)
					if ssid != "" {
						return ssid
					}
				}
			}
		}
	}

	// Try nmcli
	out, err = exec.Command("nmcli", "-t", "-f", "active,ssid", "dev", "wifi").CombinedOutput()
	if err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			if strings.HasPrefix(line, "yes:") {
				return strings.TrimPrefix(line, "yes:")
			}
		}
	}

	return ""
}

// getWifiSignal returns WiFi signal strength in dBm.
func getWifiSignal() int {
	switch runtime.GOOS {
	case "windows":
		return getWifiSignalWindows()
	case "linux":
		return getWifiSignalLinux()
	default:
		return 0
	}
}

func getWifiSignalWindows() int {
	out, err := exec.Command("netsh", "wlan", "show", "interfaces").CombinedOutput()
	if err != nil {
		return 0
	}
	for _, line := range strings.Split(string(out), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.Contains(trimmed, "Signal") && strings.Contains(trimmed, "%") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				pctStr := strings.TrimSpace(strings.TrimSuffix(parts[1], "%"))
				if pct, err := strconv.Atoi(pctStr); err == nil {
					// Convert % to approximate dBm: -100 to -30 range
					return -100 + (pct * 70 / 100)
				}
			}
		}
	}
	return 0
}

func getWifiSignalLinux() string {
	out, err := exec.Command("iwconfig", "2>/dev/null").CombinedOutput()
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(out), "\n") {
		if strings.Contains(line, "Signal level") {
			// Format: "Signal level=-45 dBm"
			if idx := strings.Index(line, "Signal level="); idx >= 0 {
				rest := line[idx+len("Signal level="):]
				parts := strings.Fields(rest)
				if len(parts) > 0 {
					val := strings.TrimSpace(parts[0])
					if d, err := strconv.Atoi(val); err == nil {
						return strconv.Itoa(d)
					}
				}
			}
		}
	}
	return ""
}

// getNetworkSpeed returns network interface speed in Mbps.
func getNetworkSpeed() float64 {
	if runtime.GOOS == "windows" {
		return getNetworkSpeedWindows()
	}
	return getNetworkSpeedLinux()
}

func getNetworkSpeedWindows() float64 {
	out, err := exec.Command(
		"wmic", "nic", "where", "NetEnabled=true",
		"get", "Speed", "/format:csv",
	).CombinedOutput()
	if err != nil {
		return 0
	}
	maxSpeed := 0
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.Contains(line, "Node,Speed") {
			continue
		}
		parts := strings.Split(line, ",")
		if len(parts) >= 2 {
			if speed, err := strconv.Atoi(strings.TrimSpace(parts[1])); err == nil {
				if speed > maxSpeed {
					maxSpeed = speed
				}
			}
		}
	}
	// wmic returns bits per second, convert to Mbps
	return float64(maxSpeed) / 1_000_000
}

func getNetworkSpeedLinux() float64 {
	// Read from /sys/class/net/<iface>/speed
	// Find the first active interface
	ifaces, err := psnet.Interfaces()
	if err != nil {
		return 0
	}
	for _, iface := range ifaces {
		if iface.Name == "lo" || len(iface.Flags) == 0 {
			continue
		}
		// gopsutil doesn't expose speed directly, use /sys/class/net
		out, err := exec.Command(
			"cat", "/sys/class/net/"+iface.Name+"/speed",
		).CombinedOutput()
		if err == nil {
			if speed, err := strconv.Atoi(strings.TrimSpace(string(out))); err == nil && speed > 0 {
				return float64(speed)
			}
		}
	}
	return 0
}

// getIPAddresses returns all non-loopback IP addresses.
func getIPAddresses() []string {
	var ips []string
	ifaces, err := net.Interfaces()
	if err != nil {
		return ips
	}
	for _, iface := range ifaces {
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipStr := addr.String()
			// Strip subnet mask
			if idx := strings.Index(ipStr, "/"); idx >= 0 {
				ipStr = ipStr[:idx]
			}
			if ipStr != "" && ipStr != "127.0.0.1" && ipStr != "::1" && !strings.HasPrefix(ipStr, "fe80:") {
				ips = append(ips, ipStr)
			}
		}
	}
	return ips
}

// measureLatency does a quick TCP dial to a well-known host to estimate latency.
func measureLatency() float64 {
	start := time.Now()
	conn, err := net.DialTimeout("tcp", "8.8.8.8:53", 3*time.Second)
	if err != nil {
		return 0
	}
	conn.Close()
	return float64(time.Since(start).Milliseconds())
}
