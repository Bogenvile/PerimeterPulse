package collector

import (
	"fmt"
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
			// Skip loopback and down interfaces
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

// GenerateAgentID creates a deterministic agent ID from hostname and MACs.
func GenerateAgentID(hostname string, macs []string) string {
	combined := hostname + strings.Join(macs, ",")
	hash := fnvHash(combined)
	return "agent-" + hash
}

func fnvHash(s string) string {
	var h uint32 = 2166136261
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 16777619
	}
	return fmt.Sprintf("%08x", h)
}