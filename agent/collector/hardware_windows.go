package collector

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

// DetectDiskType detects whether the system disk is SSD or HDD
func DetectDiskType() string {
	cmd := exec.Command("powershell", "-NoProfile", "-Command",
		`Get-PhysicalDisk | Where-Object {$_.OperationalStatus -eq 'OK'} | Select-Object -First 1 -ExpandProperty MediaType`)
	output, err := cmd.Output()
	if err == nil {
		mediaType := strings.TrimSpace(string(output))
		switch {
		case strings.EqualFold(mediaType, "SSD"):
			return "SSD"
		case strings.EqualFold(mediaType, "HDD"):
			return "HDD"
		case strings.EqualFold(mediaType, "Unspecified"):
			return detectDiskTypeFromModel()
		default:
			return detectDiskTypeFromModel()
		}
	}
	return detectDiskTypeFromModel()
}

func detectDiskTypeFromModel() string {
	cmd := exec.Command("wmic", "diskdrive", "get", "Model")
	output, err := cmd.Output()
	if err != nil {
		return "unknown"
	}

	model := strings.ToLower(string(output))
	if strings.Contains(model, "nvme") || strings.Contains(model, "ssd") ||
		strings.Contains(model, "solid") || strings.Contains(model, "samsung ssd") ||
		strings.Contains(model, "kingston sa") || strings.Contains(model, "sandisk sd") {
		return "SSD"
	}
	if strings.Contains(model, "hdd") || strings.Contains(model, "hard") {
		return "HDD"
	}

	return "unknown"
}

// GetDiskModel returns the disk model name
func GetDiskModel() string {
	cmd := exec.Command("wmic", "diskdrive", "where", "Index=0", "get", "Model", "/format:value")
	output, err := cmd.Output()
	if err != nil {
		return ""
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "Model=") {
			return strings.TrimSpace(strings.TrimPrefix(line, "Model="))
		}
	}
	return ""
}

// GetSystemDriveLetter returns the system drive letter
func GetSystemDriveLetter() string {
	cmd := exec.Command("cmd", "/C", "echo %SystemDrive%")
	output, err := cmd.Output()
	if err == nil {
		drive := strings.TrimSpace(string(output))
		if len(drive) >= 2 && drive[1] == ':' {
			return drive
		}
	}
	return "C:"
}

// GetDiskUsage returns used and total bytes for the system drive
func GetDiskUsage() (totalBytes uint64, usedBytes uint64) {
	drive := GetSystemDriveLetter()
	cmd := exec.Command("wmic", "logicaldisk", "where", fmt.Sprintf("DeviceID='%s'", drive),
		"get", "Size,FreeSpace", "/format:value")
	output, err := cmd.Output()
	if err != nil {
		return 0, 0
	}

	lines := strings.Split(string(output), "\n")
	var total, free uint64

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "Size=") {
			valStr := strings.TrimPrefix(line, "Size=")
			if v, err := strconv.ParseUint(valStr, 10, 64); err == nil {
				total = v
			}
		}
		if strings.HasPrefix(line, "FreeSpace=") {
			valStr := strings.TrimPrefix(line, "FreeSpace=")
			if v, err := strconv.ParseUint(valStr, 10, 64); err == nil {
				free = v
			}
		}
	}

	if total > 0 && free <= total {
		usedBytes = total - free
		return total, usedBytes
	}

	return total, 0
}