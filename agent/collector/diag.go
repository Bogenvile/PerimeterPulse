package collector

import (
	"net"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// RunNetworkDiagnostics checks connectivity and returns status + latency in ms
func RunNetworkDiagnostics() (string, float64) {
	status := "up"
	latency := 0.0

	// Check: any active non-loopback interface?
	if !hasActiveInterface() {
		return "down", 0.0
	}

	// Check gateway reachability
	gw := GetDefaultGateway()
	if gw == "" {
		return "limited", 0.0
	}

	// Measure latency to gateway
	latency = pingLatency(gw)

	// DNS check
	if !dnsWorks() {
		status = "degraded"
	}

	// Internet check
	if !internetReachable() {
		status = "degraded"
	}

	if status == "degraded" && latency == 0.0 {
		latency = pingLatency("8.8.8.8")
	}

	return status, latency
}

func hasActiveInterface() bool {
	interfaces, err := net.Interfaces()
	if err != nil {
		return false
	}
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok {
				if ipnet.IP.IsGlobalUnicast() || ipnet.IP.IsPrivate() {
					return true
				}
			}
		}
	}
	return false
}

func dnsWorks() bool {
	_, err := net.LookupHost("google.com")
	return err == nil
}

func internetReachable() bool {
	conn, err := net.DialTimeout("tcp", "8.8.8.8:53", 3*time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

func pingLatency(target string) float64 {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("ping", "-n", "1", "-w", "2000", target)
	} else {
		cmd = exec.Command("ping", "-c", "1", "-W", "2", target)
	}
	start := time.Now()
	out, err := cmd.Output()
	elapsed := time.Since(start).Seconds() * 1000

	if err != nil {
		return 0.0
	}

	output := string(out)
	if strings.Contains(output, "time=") || strings.Contains(output, "time<") {
		return elapsed
	}
	return 0.0
}