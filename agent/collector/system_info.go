package collector

import (
	"net"
	"os"
	"strings"
)

// CollectSystemInfo gathers hostname and MAC addresses.
func CollectSystemInfo() SystemInfo {
	hostname, _ := os.Hostname()

	var macs []string
	ifaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range ifaces {
			if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
				continue
			}
			hw := iface.HardwareAddr.String()
			if hw != "" {
				macs = append(macs, strings.ToUpper(hw))
			}
		}
	}

	return SystemInfo{
		Hostname:     cleanHostname(hostname),
		MacAddresses: macs,
	}
}

func cleanHostname(h string) string {
	h = strings.TrimSpace(h)
	if h == "" {
		return "Unknown"
	}
	return h
}