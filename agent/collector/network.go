package collector

import (
	"net"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

type NetworkInfo struct {
	WifiSSID        string   `json:"wifi_ssid"`
	WifiSignalDBM   int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps float64 `json:"network_speed_mbps"`
	IPAddresses     []string `json:"ip_addresses"`
}

func CollectNetworkInfo() NetworkInfo {
	info := NetworkInfo{
		WifiSSID:        "",
		WifiSignalDBM:   0,
		NetworkSpeedMbps: 0,
		IPAddresses:     []string{},
	}

	// Get IP addresses - filter virtual adapters
	info.IPAddresses = getActiveIPv4Addresses()

	// OS-specific WiFi detection
	switch runtime.GOOS {
	case "windows":
		info.WifiSSID, info.WifiSignalDBM = getWindowsWifiInfo()
	case "linux":
		info.WifiSSID, info.WifiSignalDBM = getLinuxWifiInfo()
	case "darwin":
		info.WifiSSID, info.WifiSignalDBM = getDarwinWifiInfo()
	}

	// Get link speed
	info.NetworkSpeedMbps = getLinkSpeedMbps()

	return info
}

// isVirtualInterface checks if an interface is likely virtual/VPN/VirtualBox
func isVirtualInterface(name string, ips []net.Addr) bool {
	lower := strings.ToLower(name)
	virtualPatterns := []string{
		"virtualbox", "vmware", "vbox", "vboxnet",
		"vpn", "tun", "tap", "docker", "veth", "br-",
		"lo", "loopback", "bluetooth", "hyper-v",
	}
	for _, pattern := range virtualPatterns {
		if strings.Contains(lower, pattern) {
			return true
		}
	}

	// Check for VirtualBox IP range (192.168.56.0/24)
	for _, addr := range ips {
		ipStr := addr.String()
		if strings.Contains(ipStr, "192.168.56.") || strings.Contains(ipStr, "10.0.2.") {
			return true
		}
	}

	return false
}

func getActiveIPv4Addresses() []string {
	var ips []string
	interfaces, err := net.Interfaces()
	if err != nil {
		return ips
	}

	for _, iface := range interfaces {
		// Skip loopback and down interfaces
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		// Skip virtual interfaces
		if isVirtualInterface(iface.Name, addrs) {
			continue
		}

		// Prefer WiFi/Ethernet interfaces
		hasValidIP := false
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}

			if ip == nil || ip.IsLoopback() {
				continue
			}

			if ipv4 := ip.To4(); ipv4 != nil {
				// Also skip link-local and APIPA addresses
				if !ipv4.IsLinkLocalUnicast() && !isAPIPA(ipv4) {
					ips = append(ips, ipv4.String())
					hasValidIP = true
				}
			}
		}

		// If WiFi/Ethernet interface has no valid IP, still check if it's the main
		if !hasValidIP && (isWifiInterface(iface.Name) || isEthernetInterface(iface.Name)) {
			for _, addr := range addrs {
				var ip net.IP
				switch v := addr.(type) {
				case *net.IPNet:
					ip = v.IP
				case *net.IPAddr:
					ip = v.IP
				}
				if ip != nil && !ip.IsLoopback() {
					if ipv4 := ip.To4(); ipv4 != nil {
						ips = append(ips, ipv4.String())
					}
				}
			}
		}
	}

	// Sort: prefer non-VPN non-virtual IPs first (already done by filtering)
	return ips
}

func isAPIPA(ip net.IP) bool {
	// APIPA: 169.254.0.0/16
	return ip[0] == 169 && ip[1] == 254
}

func isWifiInterface(name string) bool {
	lower := strings.ToLower(name)
	return strings.HasPrefix(lower, "wl") || strings.HasPrefix(lower, "wlan")
}

func isEthernetInterface(name string) bool {
	lower := strings.ToLower(name)
	return strings.HasPrefix(lower, "eth") || strings.HasPrefix(lower, "en") || strings.HasPrefix(lower, "eno")
}

func getWindowsWifiInfo() (string, int) {
	ssid := ""
	signal := 0

	// Try netsh wlan show interfaces
	cmd := exec.Command("netsh", "wlan", "show", "interfaces")
	output, err := cmd.Output()
	if err != nil {
		return ssid, signal
	}

	lines := strings.Split(string(output), "\n")
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
				val := strings.TrimSpace(parts[1])
				val = strings.TrimSuffix(val, "%")
				if pct, err := strconv.Atoi(val); err == nil && pct > 0 {
					// Convert percentage to dBm (approximate but more accurate)
					// Windows signal: 0% = bad, 100% = excellent
					// Map 0-100% to -95 to -30 dBm
					if pct >= 95 {
						signal = -30
					} else if pct >= 80 {
						signal = -40 + (95-pct)*(-1)
					} else if pct >= 50 {
						signal = -55 + (80-pct)*(-30)/30
					} else if pct >= 20 {
						signal = -70 + (50-pct)*(-25)/30
					} else {
						signal = -85 + (20-pct)*(-15)/20
					}
				}
			}
		}
	}

	// If netsh failed, try PowerShell for WiFi info
	if ssid == "" || signal == 0 {
		psCmd := exec.Command("powershell", "-Command",
			"(Get-NetAdapter | Where-Object {$_.Name -like '*Wi-Fi*' -or $_.Name -like '*Wireless*'} | Select-Object -First 1).Name")
		psOut, psErr := psCmd.Output()
		if psErr == nil && len(psOut) > 0 {
			// Try to get SSID
			ssidCmd := exec.Command("netsh", "wlan", "show", "profile")
			ssidOut, _ := ssidCmd.Output()
			if strings.Contains(string(ssidOut), "There is no wireless interface") {
				// No WiFi at all
				return "", 0
			}
		}
	}

	return ssid, signal
}

func getLinuxWifiInfo() (string, int) {
	ssid := ""
	signal := 0

	// Method 1: Try iw for connected network info (most reliable)
	iface := getWifiInterface()
	if iface != "" {
		// Get SSID via iw link
		cmd := exec.Command("iw", "dev", iface, "link")
		output, err := cmd.Output()
		if err == nil {
			lines := strings.Split(string(output), "\n")
			for _, line := range lines {
				trimmed := strings.TrimSpace(line)
				if strings.HasPrefix(trimmed, "SSID:") {
					parts := strings.SplitN(trimmed, ":", 2)
					if len(parts) >= 2 {
						ssid = strings.TrimSpace(parts[1])
					}
				}
				if strings.HasPrefix(trimmed, "signal:") {
					fields := strings.Fields(trimmed)
					if len(fields) >= 2 {
						val := strings.TrimSpace(fields[1])
						// Remove "dBm" suffix
						val = strings.TrimSuffix(val, "dBm")
						val = strings.TrimSpace(val)
						if s, err := strconv.Atoi(val); err == nil {
							signal = s
						}
					}
				}
			}
		}

		// Fallback: get SSID via iwgetid
		if ssid == "" {
			cmd2 := exec.Command("iwgetid", "-r")
			out2, err2 := cmd2.Output()
			if err2 == nil {
				ssid = strings.TrimSpace(string(out2))
			}
		}

		// Fallback: try iwconfig for signal
		if signal == 0 {
			cmd3 := exec.Command("iwconfig", iface)
			out3, err3 := cmd3.Output()
			if err3 == nil {
				lines := strings.Split(string(out3), "\n")
				for _, line := range lines {
					if strings.Contains(line, "Signal level") {
						signal = parseSignalDBm(line)
					}
				}
			}
		}

		return ssid, signal
	}

	// Method 2: Try iwgetid + iwconfig (fallback when getWifiInterface fails)
	cmd := exec.Command("iwgetid", "-r")
	out, err := cmd.Output()
	if err == nil {
		ssid = strings.TrimSpace(string(out))
	}

	// Try iwconfig for signal
	cmd = exec.Command("sh", "-c", "iwconfig 2>/dev/null | grep -i 'IEEE 802.11' | awk '{print $1}' | head -1")
	out2, err2 := cmd.Output()
	if err2 == nil && len(out2) > 0 {
		wifiIface := strings.TrimSpace(string(out2))
		cmd3 := exec.Command("iwconfig", wifiIface)
		out3, err3 := cmd3.Output()
		if err3 == nil {
			lines := strings.Split(string(out3), "\n")
			for _, line := range lines {
				if strings.Contains(line, "Signal level") {
					signal = parseSignalDBm(line)
				}
			}
		}
	}

	return ssid, signal
}

func scanIWDForWifi() (string, int) {
	ssid := ""
	signal := 0

	// Try iwctl (for iwd users)
	cmd := exec.Command("iwctl", "station", "wlan0", "show")
	output, err := cmd.Output()
	if err != nil {
		cmd = exec.Command("iwctl", "station", "wlp2s0", "show")
		output, err = cmd.Output()
	}
	if err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "Connected network") {
				parts := strings.SplitN(trimmed, " ", 3)
				if len(parts) >= 3 {
					ssid = strings.TrimSpace(parts[2])
				}
			}
		}
	}

	iface := getWifiInterface()
	if iface != "" {
		cmd = exec.Command("iw", "dev", iface, "link")
		output, err = cmd.Output()
		if err == nil {
			lines := strings.Split(string(output), "\n")
			for _, line := range lines {
				if strings.Contains(line, "signal") {
					fields := strings.Fields(line)
					if len(fields) >= 2 {
						val := strings.TrimSpace(fields[1])
						if s, err := strconv.Atoi(val); err == nil {
							signal = s
						}
					}
				}
			}
		}
	}

	return ssid, signal
}

func getDarwinWifiInfo() (string, int) {
	ssid := ""
	signal := 0

	cmd := exec.Command("/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport", "-I")
	output, err := cmd.Output()
	if err != nil {
		return ssid, signal
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "SSID:") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) >= 2 {
				ssid = strings.TrimSpace(parts[1])
			}
		}
		if strings.HasPrefix(trimmed, "agrCtlRSSI:") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) >= 2 {
				val := strings.TrimSpace(parts[1])
				if s, err := strconv.Atoi(val); err == nil {
					signal = s
				}
			}
		}
	}

	return ssid, signal
}

func getWifiInterface() string {
	// Try to find the active WiFi interface (Linux)
	// iw dev
	out, err := exec.Command("sh", "-c", "iw dev 2>/dev/null | grep 'Interface' | awk '{print $2}' | head -1").Output()
	if err == nil && len(out) > 0 {
		return strings.TrimSpace(string(out))
	}

	// Fallback: ip link show
	out, err = exec.Command("sh", "-c", "ip -o link show | grep -i wl | grep 'state UP' | head -1 | awk -F': ' '{print $2}' | awk '{print $1}'").Output()
	if err == nil && len(out) > 0 {
		return strings.TrimSpace(string(out))
	}

	// Fallback: iwconfig
	out, err = exec.Command("sh", "-c", "iwconfig 2>/dev/null | grep -i 'IEEE 802.11' | awk '{print $1}' | head -1").Output()
	if err == nil && len(out) > 0 {
		return strings.TrimSpace(string(out))
	}

	return ""
}

func parseSignalDBm(line string) int {
	idx := strings.Index(line, "Signal level")
	if idx == -1 {
		return 0
	}

	rest := line[idx:]
	rest = strings.TrimPrefix(rest, "Signal level")
	rest = strings.TrimLeft(rest, "=: ")

	// Check if it's a number (e.g., "-67 dBm")
	fields := strings.Fields(rest)
	if len(fields) > 0 {
		val := strings.TrimSuffix(fields[0], "dBm")
		val = strings.TrimSpace(val)
		if s, err := strconv.Atoi(val); err == nil {
			if s < 0 {
				return s // Already in dBm
			}
		}
	}

	// Check if it's fractional (like 48/70)
	if strings.Contains(rest, "/") {
		parts := strings.SplitN(rest, "/", 2)
		if len(parts) >= 2 {
			numFields := strings.Fields(parts[0])
			denomFields := strings.Fields(parts[1])
			if len(numFields) > 0 && len(denomFields) > 0 {
				num, _ := strconv.Atoi(numFields[0])
				denom, _ := strconv.Atoi(denomFields[0])
				if denom > 0 && num > 0 {
					ratio := float64(num) / float64(denom)
					return int(-95 + ratio*65)
				}
			}
		}
	}

	return 0
}

func getLinkSpeedMbps() float64 {
	switch runtime.GOOS {
	case "linux":
		iface := getWifiInterface()
		if iface == "" {
			// Try ethernet
			out, _ := exec.Command("sh", "-c", "ip route show default | awk '{print $5}' | head -1").Output()
			iface = strings.TrimSpace(string(out))
		}
		if iface != "" {
			out, err := exec.Command("cat", "/sys/class/net/"+iface+"/speed").Output()
			if err == nil {
				speed := strings.TrimSpace(string(out))
				if speed != "-1" {
					if s, err := strconv.ParseFloat(speed, 64); err == nil {
						return s
					}
				}
			}
		}
	case "windows":
		cmd := exec.Command("powershell", "-Command",
			"Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Select-Object -ExpandProperty LinkSpeed | ForEach-Object { if ($_ -match 'Mbps') { [double]($_ -replace ' Mbps','') } } | Select-Object -First 1")
		out, err := cmd.Output()
		if err == nil {
			val := strings.TrimSpace(string(out))
			if v, err := strconv.ParseFloat(val, 64); err == nil && v > 0 {
				return v
			}
		}
	}
	return 0
}

// ──── Network Diagnostic helpers (exported for diag.go) ────

func GetDefaultGateway() string {
	switch runtime.GOOS {
	case "windows":
		out, err := exec.Command("powershell", "-Command",
			"(Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Select-Object -First 1).NextHop").Output()
		if err == nil {
			return strings.TrimSpace(string(out))
		}
	default:
		out, err := exec.Command("sh", "-c", "ip route show default | awk '/default via/ {print $3}' | head -1").Output()
		if err == nil {
			return strings.TrimSpace(string(out))
		}
	}
	return ""
}

func GetActiveInterfaceName() string {
	iface, err := exec.Command("sh", "-c", "ip route show default | awk '{print $5}' | head -1").Output()
	if err == nil && len(iface) > 0 {
		return strings.TrimSpace(string(iface))
	}
	return getWifiInterface()
}

func GetAllNonLoopbackAddrs() []net.Addr {
	var addrs []net.Addr
	interfaces, err := net.Interfaces()
	if err != nil {
		return addrs
	}
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		ifaceAddrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		addrs = append(addrs, ifaceAddrs...)
	}
	return addrs
}