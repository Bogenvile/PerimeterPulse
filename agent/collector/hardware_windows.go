//go:build windows

package collector

import (
	"os/exec"
	"strconv"
	"strings"
)

func collectDiskHealthWindows() (status string, tempC float64) {
	cmd := exec.Command("cmd", "/c", "wmic diskdrive get Status")
	out, err := cmd.Output()
	if err != nil {
		return "unknown", 0
	}

	// Parse wmic output
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	// First line is header "Status", second line is value
	for _, line := range lines {
		l := strings.TrimSpace(line)
		if l == "OK" {
			return "ok", 0
		} else if l != "" && l != "Status" {
			return strings.ToLower(l), 0
		}
	}

	return "ok", 0
}

func collectCPUModelWindows() string {
	cmd := exec.Command("wmic", "cpu", "get", "name")
	out, err := cmd.Output()
	if err != nil {
		return "Unknown"
	}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" && !strings.EqualFold(trimmed, "Name") {
			return trimmed
		}
	}
	return "Unknown"
}

// collectDiskInfoWindows gets disk model and type
func collectDiskInfoWindows() (model string, diskType string) {
	cmd := exec.Command("wmic", "diskdrive", "get", "Model,MediaType")
	out, err := cmd.Output()
	if err != nil {
		return "Unknown", "unknown"
	}

	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "Model") {
			continue
		}
		// Format: "ModelName  MediaType"
		parts := strings.Fields(trimmed)
		if len(parts) >= 2 {
			// Last part is media type
			mediaType := parts[len(parts)-1]
			model = strings.Join(parts[:len(parts)-1], " ")
			switch {
			case strings.Contains(mediaType, "SSD"):
				diskType = "SSD"
			case strings.Contains(mediaType, "HDD"):
				diskType = "HDD"
			default:
				diskType = "unknown"
			}
			return
		}
		model = trimmed
	}

	return "Unknown", "unknown"
}