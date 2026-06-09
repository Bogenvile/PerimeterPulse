package collector

import (
	"net"
)

func CollectNetwork() *NetworkInfo {
	// Collect network info
	ips := getLocalIPs()

	info := &NetworkInfo{
		WiFiSSID:      getWiFiSSID(),
		WiFiSignalDBM: getWiFiSignalDBM(),
		SpeedMbps:     100, // Placeholder — implement real detection if possible
		IPAddresses:   ips,
	}
	return info
}

// getLocalIPs returns non-loopback IPv4 addresses
func getLocalIPs() []string {
	var ips []string
	ifaces, err := net.Interfaces()
	if err != nil {
		return ips
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip != nil && ip.To4() != nil {
				ips = append(ips, ip.String())
			}
		}
	}
	return ips
}

// Stub functions — replace with real WiFi detection per platform
func getWiFiSSID() string {
	return "Unknown"
}

func getWiFiSignalDBM() float64 {
	return -50
}