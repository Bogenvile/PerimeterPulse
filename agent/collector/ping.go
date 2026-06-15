package collector

import (
	"fmt"
	"net"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const pingTarget = "8.8.8.8"

// MeasurePingLatencyMs measures round-trip latency to 8.8.8.8 in milliseconds.
// Tries TCP connection to port 53 first (fast, no root required).
// Falls back to system ping command if TCP fails.
func MeasurePingLatencyMs() float64 {
	if ms := measurePingTCP(); ms > 0 {
		return ms
	}
	return measurePingSystem()
}

func measurePingTCP() float64 {
	start := time.Now()
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:53", pingTarget), 3*time.Second)
	if err != nil {
		return 0
	}
	elapsed := time.Since(start)
	conn.Close()
	return float64(elapsed.Milliseconds())
}

func measurePingSystem() float64 {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("ping", "-n", "1", "-w", "3000", pingTarget)
	} else {
		cmd = exec.Command("ping", "-c", "1", "-W", "3", pingTarget)
	}

	output, err := cmd.Output()
	if err != nil {
		return 0
	}

	return parsePingOutput(string(output), runtime.GOOS)
}

func parsePingOutput(output string, goos string) float64 {
	lines := strings.Split(output, "\n")
	if goos == "windows" {
		// Windows: "Minimum = 12ms, Maximum = 12ms, Average = 12ms"
		for _, line := range lines {
			if strings.Contains(line, "Average") || strings.Contains(line, "average") {
				parts := strings.Split(line, "=")
				if len(parts) >= 2 {
					msStr := strings.TrimSpace(parts[len(parts)-1])
					msStr = strings.TrimSuffix(msStr, "ms")
					msStr = strings.TrimSpace(msStr)
					if v, err := strconv.ParseFloat(msStr, 64); err == nil && v > 0 {
						return v
					}
				}
			}
		}
	} else {
		// Linux/macOS: "time=12.3 ms"
		for _, line := range lines {
			if idx := strings.Index(line, "time="); idx >= 0 {
				rest := line[idx+5:]
				if endIdx := strings.Index(rest, " "); endIdx > 0 {
					msStr := rest[:endIdx]
					if v, err := strconv.ParseFloat(msStr, 64); err == nil && v > 0 {
						return v
					}
				}
			}
		}
	}
	return 0
}