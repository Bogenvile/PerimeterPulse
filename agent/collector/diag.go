package collector

import (
	"net"
	"strings"
	"time"
)

type NetworkDiagResult struct {
	Status            string
	LatencyMs         float64
	GatewayReachable  bool
	DNSWorking        bool
	InternetReachable bool
	DefaultGateway    string
}

// RunNetworkDiag runs a 4-stage network diagnostic
func RunNetworkDiag() NetworkDiagResult {
	result := NetworkDiagResult{
		Status: "down",
	}

	// Stage 1: Check if any non-loopback interface is up with an IP
	interfaces, err := net.Interfaces()
	if err != nil {
		return result
	}

	hasInterface := false
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipStr := strings.Split(addr.String(), "/")[0]
			if ipStr != "" && !strings.HasPrefix(ipStr, "127.") && !strings.HasPrefix(ipStr, "::1") {
				hasInterface = true
				break
			}
		}
		if hasInterface {
			break
		}
	}

	if !hasInterface {
		return result
	}

	result.Status = "limited"

	// Get default gateway
	gw := getDefaultGatewayIP()
	result.DefaultGateway = gw

	// Stage 2: Gateway reachability
	if gw != "" {
		start := time.Now()
		conn, err := net.DialTimeout("tcp", net.JoinHostPort(gw, "80"), 2*time.Second)
		if err == nil {
			result.LatencyMs = float64(time.Since(start).Milliseconds())
			result.GatewayReachable = true
			conn.Close()
		}
	}

	if !result.GatewayReachable {
		return result
	}

	result.Status = "degraded"

	// Stage 3: DNS resolution
	_, err = net.LookupHost("google.com")
	if err == nil {
		result.DNSWorking = true
	}

	// Stage 4: Internet connectivity (connect to 8.8.8.8:53)
	conn2, err := net.DialTimeout("tcp", "8.8.8.8:53", 3*time.Second)
	if err == nil {
		result.InternetReachable = true
		conn2.Close()
	}

	if result.InternetReachable {
		result.Status = "up"
	}

	return result
}