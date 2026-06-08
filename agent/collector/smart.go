package collector

import (
	"log"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

// DiskHealth holds SMART health status and optionally disk temperature.
type DiskHealth struct {
	Status            string   `json:"status"`
	TemperatureCelsius *float64 `json:"temperature_celsius,omitempty"`
}

// CollectDiskHealth queries SMART data via smartctl.
// Returns nil if SMART is not available on this system.
func CollectDiskHealth() *DiskHealth {
	// Find the primary disk
	diskDevice := getPrimaryDiskDevice()
	if diskDevice == "" {
		log.Println("WARNING: could not determine primary disk device")
		return nil
	}

	args := []string{"-H", "-A", diskDevice}
	if runtime.GOOS == "windows" {
		args = []string{"-H", "-A", diskDevice, "-d", "ata"}
	}

	out, err := exec.Command("smartctl", args...).Output()
	if err != nil {
		log.Printf("WARNING: smartctl failed for %s: %v", diskDevice, err)
		return nil
	}

	health := &DiskHealth{Status: "unknown"}
	output := string(out)
	lines := strings.Split(output, "\n")

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		// Overall health
		if strings.Contains(trimmed, "SMART overall-health") || strings.Contains(trimmed, "SMART Health Status") {
			if strings.Contains(strings.ToLower(trimmed), "passed") || strings.Contains(strings.ToLower(trimmed), "ok") {
				health.Status = "ok"
			} else if strings.Contains(strings.ToLower(trimmed), "warning") {
				health.Status = "warning"
			} else {
				health.Status = "critical"
			}
		}
		// Temperature (attribute 194 or Temperature_Celsius)
		if strings.Contains(trimmed, "Temperature_Celsius") || strings.Contains(trimmed, "194") {
			fields := strings.Fields(trimmed)
			if len(fields) >= 10 {
				// The RAW_VALUE is typically the last field
				rawVal := fields[len(fields)-1]
				if temp, err := strconv.ParseFloat(rawVal, 64); err == nil && temp > 0 && temp < 150 {
					health.TemperatureCelsius = &temp
				}
			}
		}
	}

	if health.Status == "unknown" {
		health.Status = "ok" // default to ok if we got output but couldn't parse
	}

	return health
}

func getPrimaryDiskDevice() string {
	if runtime.GOOS == "windows" {
		return "/dev/sda" // fallback; smartctl on Windows uses different naming
	}
	// Linux: find the root device
	out, err := exec.Command("lsblk", "-no", "PKNAME", "/").Output()
	if err != nil {
		// Fallback to /dev/sda
		return "/dev/sda"
	}
	dev := strings.TrimSpace(string(out))
	if dev != "" {
		return "/dev/" + dev
	}
	return "/dev/sda"
}