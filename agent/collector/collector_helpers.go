package collector

import (
	"crypto/sha256"
	"fmt"
	"os"
	"runtime"
	"sort"
	"strings"
)

// CollectSystemInfo gathers base system info using platform-specific collectHardwareInfo
func CollectSystemInfo() SystemInfo {
	info := collectHardwareInfo() // from hardware_windows.go or hardware_linux.go
	return info
}

// GetOSInfo returns OS and version
func GetOSInfo() OSInfo {
	info := collectOSInfo() // from os-specific files
	return info
}

// GenerateAgentID creates a deterministic agent ID from hostname + MACs
func GenerateAgentID(hostname string, macs []string) string {
	sorted := make([]string, len(macs))
	copy(sorted, macs)
	sort.Strings(sorted)
	input := hostname + strings.Join(sorted, ",")
	hash := sha256.Sum256([]byte(input))
	return fmt.Sprintf("agent-%x", hash[:8])
}

// CollectMetrics wraps the platform-specific metric collection
func CollectMetrics() MetricsData {
	return collectMetrics()
}

// CollectNetworkInfo wraps the platform-specific network collection
func CollectNetworkInfo() NetworkInfo {
	return collectNetworkInfo()
}

// CollectLocation wraps location collection
func CollectLocation() *LocationData {
	return collectLocation()
}

// Stub for OS info collection
func collectOSInfo() OSInfo {
	return OSInfo{
		OS:        runtime.GOOS,
		OSVersion: getOSVersion(),
	}
}

func getOSVersion() string {
	// Platform-specific files override this
	if v := getWindowsOSVersion(); v != "" {
		return v
	}
	if v := getLinuxOSVersion(); v != "" {
		return v
	}
	return runtime.GOOS
}