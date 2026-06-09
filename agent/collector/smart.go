package collector

import (
	"os/exec"
	"strconv"
	"strings"
)

type DiskInfo struct {
	Model        string `json:"disk_model"`
	Type         string `json:"disk_type"`
	HealthStatus string `json:"disk_health_status"`
	Temperature  int    `json:"disk_temperature_c"`
}

func CollectDiskInfo() DiskInfo {
	info := DiskInfo{
		Model:        "",
		Type:         "unknown",
		HealthStatus: "unknown",
		Temperature:  0,
	}

	// Collect model & type
	info.Model, info.Type = getDiskModelAndType()

	// SMART data
	if HasSmartctl() {
		info.HealthStatus, info.Temperature = getSMARTInfo()
	}

	return info
}

func getDiskModelAndType() (string, string) {
	model := ""
	diskType := "unknown"

	// Linux: use lsblk to get disk model and type
	// lsblk -d -o NAME,MODEL,ROTA,TRAN -n
	cmd := exec.Command("lsblk", "-d", "-o", "NAME,MODEL,ROTA,TRAN", "-n")
	output, err := cmd.Output()
	if err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			fields := strings.Fields(line)
			if len(fields) < 2 {
				continue
			}

			name := fields[0]
			// Skip loop, ram, snap, sr devices
			if strings.HasPrefix(name, "loop") ||
				strings.HasPrefix(name, "ram") ||
				strings.HasPrefix(name, "sr") ||
				strings.Contains(name, "snap") {
				continue
			}

			// Model: fields[1] sampai sebelum ROTA column
			// ROTA is second-to-last field, TRAN is last
			if len(fields) >= 3 {
				// Last field is TRAN, second-to-last is ROTA
				transport := fields[len(fields)-1]
				rotStr := fields[len(fields)-2]
				modelParts := fields[1 : len(fields)-2]
				model = strings.Join(modelParts, " ")

				rot, _ := strconv.Atoi(rotStr)
				if rot == 0 {
					diskType = "SSD"
					if strings.Contains(transport, "nvme") {
						diskType = "NVMe"
					}
				} else {
					diskType = "HDD"
				}

				break // Take first physical disk
			} else if len(fields) == 2 {
				model = fields[1]
			}
		}
	}

	// Fallback: sysfs
	if model == "" {
		out, err := exec.Command("sh", "-c", "cat /sys/block/sda/device/model 2>/dev/null").Output()
		if err == nil && len(out) > 0 {
			model = strings.TrimSpace(string(out))
		}
	}
	if diskType == "unknown" || diskType == "" {
		out, err := exec.Command("sh", "-c", "cat /sys/block/sda/queue/rotational 2>/dev/null || echo 1").Output()
		if err == nil {
			rot := strings.TrimSpace(string(out))
			if rot == "0" {
				diskType = "SSD"
			} else if rot == "1" {
				diskType = "HDD"
			}
		}
	}

	// Windows: PowerShell
	if model == "" || diskType == "unknown" {
		winModel, winType := getWindowsDiskInfo()
		if model == "" {
			model = winModel
		}
		if diskType == "unknown" {
			diskType = winType
		}
	}

	return model, diskType
}

func getWindowsDiskInfo() (string, string) {
	model := ""
	diskType := "unknown"

	// Get physical disk model
	cmd := exec.Command("powershell", "-Command",
		"(Get-PhysicalDisk | Select-Object -First 1).Model")
	out, err := cmd.Output()
	if err == nil {
		model = strings.TrimSpace(string(out))
	}

	// Get disk type
	cmd = exec.Command("powershell", "-Command",
		"(Get-PhysicalDisk | Select-Object -First 1).MediaType")
	out, err = cmd.Output()
	if err == nil {
		mediaType := strings.TrimSpace(string(out))
		if mediaType != "" {
			diskType = mediaType
		}
	}

	// Fallback: check if SSD via Get-Disk
	if diskType == "unknown" {
		cmd = exec.Command("powershell", "-Command",
			"(Get-Disk | Select-Object -First 1).BusType")
		out, err = cmd.Output()
		if err == nil {
			busType := strings.TrimSpace(string(out))
			if strings.Contains(strings.ToUpper(busType), "NVME") {
				diskType = "NVMe"
			} else if strings.Contains(strings.ToUpper(busType), "SATA") || strings.Contains(strings.ToUpper(busType), "SAS") {
				// Still unknown if SSD or HDD
			}
		}
	}

	return model, diskType
}

func HasSmartctl() bool {
	_, err := exec.LookPath("smartctl")
	return err == nil
}

func getSMARTInfo() (string, int) {
	health := "unknown"
	temp := 0

	// Find physical disk devices (skip partitions)
	devices := findPhysicalDisks()

	for _, dev := range devices {
		// Get SMART health status
		cmdHealth := exec.Command("smartctl", "-H", dev)
		outHealth, err := cmdHealth.Output()
		if err != nil {
			continue
		}
		statusStr := strings.ToLower(string(outHealth))
		if strings.Contains(statusStr, "passed") || strings.Contains(statusStr, "ok") {
			health = "ok"
		} else if strings.Contains(statusStr, "failing") || strings.Contains(statusStr, "failed") {
			health = "critical"
		} else if strings.Contains(statusStr, "unknown") {
			// Keep trying other devices
		}

		// Get temperature from SMART attributes
		cmd := exec.Command("smartctl", "-A", dev)
		output, err := cmd.Output()
		if err != nil {
			continue
		}

		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)

			// Standard ATA: "194 Temperature_Celsius" or "190 Airflow_Temperature_Cel"
			if strings.Contains(line, "Temperature_Celsius") || strings.Contains(line, "Temperature_Cel") {
				fields := strings.Fields(line)
				// The raw value is the last field
				if len(fields) >= 10 {
					lastField := fields[len(fields)-1]
					if t, err := strconv.Atoi(lastField); err == nil && t > 0 && t < 150 {
						temp = t
					}
				}
			}

			// NVMe: "Temperature: 34 Celsius"
			if strings.Contains(line, "Temperature") && strings.Contains(line, "Celsius") {
				fields := strings.Fields(line)
				for i, f := range fields {
					if f == "Temperature:" && i+1 < len(fields) {
						if t, err := strconv.Atoi(fields[i+1]); err == nil && t > 0 && t < 150 {
							temp = t
						}
					}
				}
			}

			// NVMe: "Temperature Sensor 1: 34 Celsius"
			if strings.Contains(line, "Temperature Sensor") && strings.Contains(line, "Celsius") {
				fields := strings.Fields(line)
				for i, f := range fields {
					if (f == "Celsius" || strings.Contains(f, "Celsius")) && i > 0 {
						// Value is before "Celsius"
						val := strings.TrimSuffix(fields[i-1], "Celsius")
						val = strings.TrimSpace(val)
						if t, err := strconv.Atoi(val); err == nil && t > 0 && t < 150 {
							temp = t
						}
					}
				}
			}
		}

		// If we got both, stop
		if health != "unknown" && temp > 0 {
			break
		}
	}

	return health, temp
}

func findPhysicalDisks() []string {
	var devices []string

	// Use lsblk to find physical disk devices
	cmd := exec.Command("lsblk", "-d", "-o", "NAME,TYPE", "-n")
	out, err := cmd.Output()
	if err != nil {
		// Fallback to common paths
		return []string{"/dev/sda", "/dev/nvme0n1", "/dev/nvme0"}
	}

	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 2 && fields[1] == "disk" {
			name := fields[0]
			// Skip loop, ram devices
			if strings.HasPrefix(name, "loop") || strings.HasPrefix(name, "ram") {
				continue
			}
			devices = append(devices, "/dev/"+name)
		}
	}

	if len(devices) == 0 {
		devices = []string{"/dev/sda", "/dev/nvme0n1", "/dev/nvme0"}
	}

	return devices
}