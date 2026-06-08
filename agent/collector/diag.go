package collector

import (
	"net"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// NetworkDiag holds detailed network diagnostic results.
type NetworkDiag struct {
	Status           string  `json:"status"`            // "up" | "degraded" | "limited" | "down"
	GatewayReachable bool    `json:"gateway_reachable"`
	DNSWorking       bool    `json:"dns_working"`
	InternetReachable bool   `json:"internet_reachable"`
	GatewayLatencyMs float64 `json:"gateway_latency_ms"`
	DNSTimeMs        float64 `json:"dns_time_ms"`
	InternetLatencyMs float64 `json:"internet_latency_ms"`
	DefaultGateway   string  `json:"default_gateway"`
}

// RunNetworkDiag performs a full network diagnostic and returns structured results.
func RunNetworkDiag() NetworkDiag {
	diag := NetworkDiag{Status: "down"}

	// Step 1: Find default gateway
	diag.DefaultGateway = findDefaultGateway()

	// Step 2: Check if any network interface is up
	if !hasActiveInterface() {
		return diag // status stays "down"
	}

	// Step 3: Check gateway reachability (LAN check)
	if diag.DefaultGateway != "" {
		start := time.Now()
		if pingHost(diag.DefaultGateway) {
			diag.GatewayReachable = true
			diag.GatewayLatencyMs = float64(time.Since(start).Milliseconds())
		}
	}

	// Step 4: DNS resolution check
	start := time.Now()
	if resolveHost("google.com") {
		diag.DNSWorking = true
		diag.DNSTimeMs = float64(time.Since(start).Milliseconds())
	}

	// Step 5: Internet connectivity check
	diag.InternetReachable = checkInternet()
	diag.InternetLatencyMs = measureLatencyTo("8.8.8.8:53")

	// Determine overall status
	if diag.GatewayReachable && diag.DNSWorking && diag.InternetReachable {
		diag.Status = "up"
	} else if diag.GatewayReachable {
		diag.Status = "degraded" // LAN works, WAN issues
	} else if hasActiveInterface() {
		diag.Status = "limited" // Interface up but no gateway
	}

	return diag
}

// findDefaultGateway returns the default gateway IP address.
func findDefaultGateway() string {
	switch runtime.GOOS {
	case "windows":
		return findGatewayWindows()
	case "linux":
		return findGatewayLinux()
	default:
		return ""
	}
}

func findGatewayWindows() string {
	out, err := exec.Command("ipconfig").CombinedOutput()
	if err != nil {
		return ""
	}
	lines := strings.Split(string(out), "\n")
	for i, line := range lines {
		if strings.Contains(line, "Default Gateway") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				gw := strings.TrimSpace(parts[1])
				if gw != "" && gw != "0.0.0.0" {
					return gw
				}
			}
			// Sometimes the gateway is on the next line
			if i+1 < len(lines) {
				gw := strings.TrimSpace(lines[i+1])
				if gw != "" && gw != "0.0.0.0" && !strings.Contains(gw, ":") {
					return gw
				}
			}
		}
	}
	return ""
}

func findGatewayLinux() string {
	// Try ip route
	out, err := exec.Command("ip", "route", "show", "default").CombinedOutput()
	if err == nil {
		fields := strings.Fields(string(out))
		for i, f := range fields {
			if f == "via" && i+1 < len(fields) {
				return fields[i+1]
			}
		}
	}

	// Fallback: route -n
	out, err = exec.Command("route", "-n").CombinedOutput()
	if err == nil {
		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			if strings.HasPrefix(strings.TrimSpace(line), "0.0.0.0") {
				fields := strings.Fields(line)
				if len(fields) >= 2 {
					gw := fields[1]
					if gw != "0.0.0.0" && gw != "*" {
						return gw
					}
				}
			}
		}
	}

	return ""
}

// hasActiveInterface checks if any non-loopback network interface is up.
func hasActiveInterface() bool {
	ifaces, err := net.Interfaces()
	if err != nil {
		return false
	}
	for _, iface := range ifaces {
		if iface.Name == "lo" {
			continue
		}
		if iface.Flags&net.FlagUp != 0 {
			addrs, _ := iface.Addrs()
			for _, addr := range addrs {
				ip := addr.String()
				if ip != "" && !strings.HasPrefix(ip, "127.") && !strings.HasPrefix(ip, "::1") {
					return true
				}
			}
		}
	}
	return false
}

// pingHost tries to establish a TCP connection to port 80 or 443.
// This works even when ICMP is blocked.
func pingHost(host string) bool {
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, "80"), 2*time.Second)
	if err == nil {
		conn.Close()
		return true
	}
	conn, err = net.DialTimeout("tcp", net.JoinHostPort(host, "443"), 2*time.Second)
	if err == nil {
		conn.Close()
		return true
	}
	return false
}

// resolveHost checks if a hostname can be resolved via DNS.
func resolveHost(host string) bool {
	addrs, err := net.LookupHost(host)
	return err == nil && len(addrs) > 0
}

// checkInternet verifies internet connectivity by connecting to multiple well-known hosts.
func checkInternet() bool {
	hosts := []string{"8.8.8.8:53", "1.1.1.1:53", "208.67.222.222:53"}
	for _, host := range hosts {
		conn, err := net.DialTimeout("tcp", host, 3*time.Second)
		if err == nil {
			conn.Close()
			return true
		}
	}
	return false
}

// measureLatencyTo measures TCP handshake latency to a specific host.
func measureLatencyTo(host string) float64 {
	start := time.Now()
	conn, err := net.DialTimeout("tcp", host, 3*time.Second)
	if err != nil {
		return 0
	}
	conn.Close()
	return float64(time.Since(start).Milliseconds())
}
