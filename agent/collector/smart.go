package collector

import (
	"os/exec"
	"runtime"
	"strconv"
	"strings"
)

// collectSMART gathers disk health data via platform-specific tools.
func collectSMART() (*SMARTData, error) {
	switch runtime.GOOS {
	case "windows":
		return collectSMARTWindows()
	case "linux":
		return collectSMARTLinux()
	default:
		return &SMARTData{Status: "unknown"}, nil
	}
}

func collectSMARTWindows() (*SMARTData, error) {
	// Use wmic to query disk drive status
	out, err := exec.Command(
		"wmic", "diskdrive",
		"get", "Status,Model,MediaType",
		"/format:csv",
	).CombinedOutput()
	if err != nil {
		return &SMARTData{Status: "unknown"}, nil
	}

	status := "unknown"
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.Contains(line, "Node,Model,Status") {
			continue
		}
		lower := strings.ToLower(line)
		if strings.Contains(lower, "ok") {
			status = "ok"
		} else if strings.Contains(lower, "pred fail") || strings.Contains(lower, "bad") {
			status = "critical"
		} else if strings.Contains(lower, "caution") {
			status = "warning"
		}
	}

	return &SMARTData{Status: status}, nil
}

func collectSMARTLinux() (*SMARTData, error) {
	// Check if smartctl is available
	if _, err := exec.LookPath("smartctl"); err != nil {
		return &SMARTData{Status: "unknown"}, nil
	}

	// Find the system disk
	diskDevice := findSystemDisk()
	if diskDevice == "" {
		return &SMARTData{Status: "unknown"}, nil
	}

	// Get SMART health status
	out, err := exec.Command(
		"smartctl", "-H", diskDevice,
	).CombinedOutput()
	if err != nil {
		return &SMARTData{Status: "unknown"}, nil
	}

	status := "unknown"
	output := string(out)
	if strings.Contains(output, "PASSED") || strings.Contains(output, "OK") {
		status = "ok"
	} else if strings.Contains(output, "FAILED") || strings.Contains(output, "FAIL") {
		status = "critical"
	}

	// Get temperature
	temp := 0.0
	tempOut, err := exec.Command(
		"smartctl", "-A", diskDevice,
	).CombinedOutput()
	if err == nil {
		for _, line := range strings.Split(string(tempOut), "\n") {
			if strings.Contains(line, "Temperature_Celsius") ||
				strings.Contains(line, "Temperature") {
				fields := strings.Fields(line)
				if len(fields) >= 10 {
					// SMART attribute format: ID ATTRIBUTE_NAME FLAG VALUE WORST THRESH TYPE UPDATED WHEN_FAILED RAW_VALUE
					if t, err := strconv.ParseFloat(fields[len(fields)-1], 64); err == nil {
						temp = t
					}
				}
			}
		}
	}

	return &SMARTData{
		Status:      status,
		Temperature: temp,
	}, nil
}

func findSystemDisk() string {
	// Try common device names
	candidates := []string{"/dev/sda", "/dev/nvme0n1", "/dev/vda", "/dev/sdb"}
	for _, dev := range candidates {
		out, err := exec.Command("smartctl", "-i", dev).CombinedOutput()
		if err == nil && strings.Contains(string(out), "Device Model") {
			return dev
		}
	}
	return ""
}

// getDiskInfo returns the disk model and type (SSD/HDD/NVMe).
func getDiskInfo() (model, diskType string) {
	switch runtime.GOOS {
	case "windows":
		return getDiskInfoWindows()
	case "linux":
		return getDiskInfoLinux()
	default:
		return "", "unknown"
	}
}

func getDiskInfoWindows() (string, string) {
	out, err := exec.Command(
		"wmic", "diskdrive",
		"get", "Model,MediaType",
		"/format:csv",
	).CombinedOutput()
	if err != nil {
		return "", "unknown"
	}
	var model, mediaType string
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.Contains(line, "Node,Model,MediaType") {
			continue
		}
		// Skip header
		parts := strings.Split(line, ",")
		if len(parts) >= 3 {
			model = strings.TrimSpace(parts[1])
			mediaType = strings.TrimSpace(parts[2])
			break
		}
	}
	dt := "unknown"
	if strings.Contains(strings.ToLower(mediaType), "ssd") ||
		strings.Contains(strings.ToLower(mediaType), "nvme") {
		dt = "SSD"
	} else if strings.Contains(strings.ToLower(mediaType), "hdd") ||
		strings.Contains(strings.ToLower(mediaType), "fixed hard disk") {
		dt = "HDD"
	}
	return model, dt
}

func getDiskInfoLinux() (string, string) {
	diskDevice := findSystemDisk()
	if diskDevice == "" {
		return "", "unknown"
	}

	out, err := exec.Command("smartctl", "-i", diskDevice).CombinedOutput()
	if err != nil {
		return "", "unknown"
	}

	var model string
	output := string(out)
	for _, line := range strings.Split(output, "\n") {
		if strings.Contains(line, "Device Model") || strings.Contains(line, "Model Family") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				model = strings.TrimSpace(parts[1])
			}
		}
	}

	// Detect type
	diskType := "unknown"
	if strings.Contains(diskDevice, "nvme") {
		diskType = "NVMe"
	} else {
		// Check rotation rate — 0 = SSD, >0 = HDD
		rotOut, err := exec.Command(
			"cat", "/sys/block/"+strings.TrimPrefix(diskDevice, "/dev/")+"/queue/rotational",
		).CombinedOutput()
		if err == nil {
			if strings.TrimSpace(string(rotOut)) == "0" {
				diskType = "SSD"
			} else {
				diskType = "HDD"
			}
		}
	}

	return model, diskType
}
