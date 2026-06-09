package collector

import (
	"log"
	"net"
	"os/exec"
	"runtime"
	"strings"
)

func getDefaultInterfaceName() string {
	// Return first non-loopback interface name
	ifaces, err := net.Interfaces()
	if err != nil {
		return ""
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback == 0 && iface.Flags&net.FlagUp != 0 {
			return iface.Name
		}
	}
	return ""
}

func CollectNetworkInfo() *NetworkInfo {
	info := &NetworkInfo{
		WiFiSSID:        "",
		WiFiSignalDBM:   0,
		NetworkSpeedMbps: 0,
		IPAddresses:     []string{},
	}

	// Collect IP addresses
	ifaces, err := net.Interfaces()
	if err != nil {
		log.Printf("Error getting network interfaces: %v", err)
		return info
	}

	for _, iface := range ifaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipnet, ok := addr.(*net.IPNet)
			if ok && !ipnet.IP.IsLoopback() && ipnet.IP.To4() != nil {
				info.IPAddresses = append(info.IPAddresses, ipnet.IP.String())
			}
		}
	}

	// Attempt to get WiFi SSID and signal via platform-specific methods
	if runtime.GOOS == "windows" {
		cmd := exec.Command("powershell", "-Command",
			"(Get-NetAdapter -Name '*Wi-Fi*' | Get-NetConnectionProfile).Name")
		out, err := cmd.Output()
		if err == nil {
			ssid := strings.TrimSpace(string(out))
			if ssid != "" {
				info.WiFiSSID = ssid
			}
		}
	} else if runtime.GOOS == "linux" {
		// iwconfig
		cmd := exec.Command("iwgetid", "-r")
		out, err := cmd.Output()
		if err == nil {
			ssid := strings.TrimSpace(string(out))
			if ssid != "" {
				info.WiFiSSID = ssid
			}
		}
	}

	return info
}