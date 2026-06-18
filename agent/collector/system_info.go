package collector

import (
	"crypto/sha256"
	"encoding/hex"
	"net"
	"os"
	"strings"
)

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

func GenerateAgentID(hostname string, macs []string) string {
	h := sha256.New()
	h.Write([]byte(hostname))
	for _, mac := range macs {
		h.Write([]byte(mac))
	}
	return "agent-" + hex.EncodeToString(h.Sum(nil))[:12]
}

func cleanHostname(h string) string {
	h = strings.TrimSpace(h)
	if h == "" {
		return "Unknown"
	}
	return h
}