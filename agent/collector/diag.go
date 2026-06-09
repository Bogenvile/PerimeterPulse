package collector

import (
	"fmt"
	"net"
	"os/exec"
	"runtime"
	"strings"
)

// GetDefaultGateway returns the IP of the default gateway.
// On Windows, uses `route print 0.0.0.0`. On Linux, reads `/proc/net/route`.
func GetDefaultGateway() (string, error) {
	if runtime.GOOS == "windows" {
		cmd := exec.Command("powershell", "-Command",
			"(Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Select-Object -First 1).NextHop")
		out, err := cmd.Output()
		if err != nil {
			return "", fmt.Errorf("failed to get gateway: %w", err)
		}
		gw := strings.TrimSpace(string(out))
		if gw == "" {
			return "", fmt.Errorf("no default gateway found")
		}
		return gw, nil
	}
	// Linux: parse /proc/net/route
	data, err := os.ReadFile("/proc/net/route")
	if err != nil {
		return "", fmt.Errorf("cannot read /proc/net/route: %w", err)
	}
	lines := strings.Split(string(data), "\n")
	for _, line := range lines[1:] { // skip header
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		if fields[1] == "00000000" { // destination 0.0.0.0
			// gateway is in hex
			gwHex := fields[2]
			if len(gwHex) == 8 {
				ip := fmt.Sprintf("%d.%d.%d.%d",
					hexToInt(gwHex[6:8]),
					hexToInt(gwHex[4:6]),
					hexToInt(gwHex[2:4]),
					hexToInt(gwHex[0:2]),
				)
				return ip, nil
			}
		}
	}
	return "", fmt.Errorf("no default gateway found in /proc/net/route")
}

func hexToInt(hex string) int {
	var val int
	fmt.Sscanf(hex, "%x", &val)
	return val
}

// DNS lookup helper
func CheckDNS() bool {
	_, err := net.LookupHost("google.com")
	return err == nil
}

// Internet connectivity check: TCP connect to Google DNS
func CheckInternet() bool {
	conn, err := net.Dial("tcp", "8.8.8.8:53")
	if err != nil {
		return false
	}
	conn.Close()
	return true
}