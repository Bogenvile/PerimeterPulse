package collector

import (
	"fmt"
	"net"
	"os/exec"
	"strconv"
	"strings"
)

// WiFiInfo holds WiFi network information
type WiFiInfo struct {
	SSID      string
	SignalDBM int
	IP        string
	MAC       string
	Gateway   string
	LinkSpeed int // Mbps
}

// GetWiFiInfo retrieves WiFi info using netsh wlan
func GetWiFiInfo() WiFiInfo {
	var info WiFiInfo
	info.SignalDBM = -999 // default: no signal

	// Get connected WiFi interface info
	cmd := exec.Command("netsh", "wlan", "show", "interfaces")
	output, err := cmd.Output()
	if err != nil {
		return info
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(line, "SSID") && strings.Contains(line, ":"):
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				info.SSID = strings.TrimSpace(parts[1])
			}
		case strings.HasPrefix(line, "Signal") && strings.Contains(line, ":"):
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				signalStr := strings.TrimSuffix(strings.TrimSpace(parts[1]), "%")
				if pct, err := strconv.Atoi(signalStr); err == nil {
					// Convert quality % to approximate dBm
					// Typical: 100% ≈ -30 dBm, 0% ≈ -90 dBm
					info.SignalDBM = -90 + (pct * 60 / 100)
				}
			}
		case strings.HasPrefix(line, "Receive rate") || strings.HasPrefix(line, "Transmit rate"):
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 && info.LinkSpeed == 0 {
				rateStr := strings.TrimSpace(parts[1])
				rateStr = strings.TrimSuffix(rateStr, "Mbps")
				rateStr = strings.TrimSpace(rateStr)
				if rate, err := strconv.Atoi(rateStr); err == nil {
					info.LinkSpeed = rate
				}
			}
		}
	}

	// Get IP, MAC, Gateway from active interface
	info.IP, info.MAC, info.Gateway = getActiveNetworkInfo()

	return info
}

// getActiveNetworkInfo finds the IP, MAC, and gateway of the active network interface
func getActiveNetworkInfo() (ip string, mac string, gateway string) {
	// Get list of network interfaces
	interfaces, err := net.Interfaces()
	if err != nil {
		return "", "", ""
	}

	var activeInterface *net.Interface
	var activeIP string
	var activeGateway string

	for _, iface := range interfaces {
		// Skip loopback and down interfaces
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if iface.Flags&net.FlagUp == 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}

			ipv4 := ipNet.IP.To4()
			if ipv4 == nil || ipv4.IsLoopback() || ipv4.IsLinkLocalUnicast() {
				continue
			}

			// Check if this interface has a default gateway
			gw := getDefaultGatewayForInterface(iface.Index)
			if gw != "" {
				activeInterface = &iface
				activeIP = ipv4.String()
				activeGateway = gw
				break
			}

			// Fallback: use first non-link-local interface
			if activeInterface == nil {
				activeInterface = &iface
				activeIP = ipv4.String()
			}
		}

		if activeGateway != "" {
			break
		}
	}

	if activeInterface != nil {
		ip = activeIP
		mac = activeInterface.HardwareAddr.String()
		gateway = activeGateway
	}

	return ip, mac, gateway
}

// getDefaultGatewayForInterface gets the default gateway for a specific interface
func getDefaultGatewayForInterface(ifIndex int) string {
	cmd := exec.Command("wmic", "nicconfig", "where", fmt.Sprintf("Index=%d", ifIndex),
		"get", "DefaultIPGateway", "/format:value")
	output, err := cmd.Output()
	if err != nil {
		return ""
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "DefaultIPGateway=") {
			gw := strings.TrimPrefix(line, "DefaultIPGateway=")
			gw = strings.Trim(gw, "{}") // WMIC wraps in braces
			gw = strings.TrimSpace(gw)
			if gw != "" && gw != "0.0.0.0" {
				return gw
			}
		}
	}
	return ""
}

// GetMACAddresses returns all non-loopback MAC addresses
func GetMACAddresses() []string {
	var macs []string
	interfaces, err := net.Interfaces()
	if err != nil {
		return macs
	}

	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if iface.Flags&net.FlagUp == 0 {
			continue
		}
		macStr := iface.HardwareAddr.String()
		if macStr != "" && macStr != "00:00:00:00:00:00" {
			macs = append(macs, macStr)
		}
	}

	return macs
}