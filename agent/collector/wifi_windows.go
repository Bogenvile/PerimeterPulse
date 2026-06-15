//go:build windows

package collector

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
	"unsafe"
)

// WiFiInfo holds wireless network details
type WiFiInfo struct {
	SSID      string
	SignalDBM int
	LinkSpeed float64
	IP        string
	Gateway   string
}

// GetWiFiInfo retrieves WiFi information using netsh on Windows
func GetWiFiInfo() WiFiInfo {
	info := WiFiInfo{
		SignalDBM: -999,
	}

	// Get SSID and signal via netsh wlan show interfaces
	cmd := exec.Command("netsh", "wlan", "show", "interfaces")
	out, err := cmd.Output()
	if err != nil {
		return info
	}

	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "SSID") && !strings.Contains(trimmed, "BSSID") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				info.SSID = strings.TrimSpace(parts[1])
			}
		}
		if strings.HasPrefix(trimmed, "Signal") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				signalStr := strings.TrimSpace(parts[1])
				signalStr = strings.TrimRight(signalStr, "%")
				signalStr = strings.TrimSpace(signalStr)
				if pct, err := strconv.Atoi(signalStr); err == nil {
					if pct >= 100 {
						info.SignalDBM = -30
					} else if pct <= 0 {
						info.SignalDBM = -90
					} else {
						info.SignalDBM = -90 + (pct * 60 / 100)
					}
				}
			}
		}
		if strings.Contains(trimmed, "Receive rate") || strings.Contains(trimmed, "Transmit rate") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				rateStr := strings.TrimSpace(parts[1])
				rateStr = strings.TrimSuffix(rateStr, "Mbps")
				rateStr = strings.TrimSpace(rateStr)
				if rate, err := strconv.ParseFloat(rateStr, 64); err == nil && rate > 0 {
					info.LinkSpeed = rate
				}
			}
		}
	}

	// Get IP and Gateway via netsh interface ip show config
	cmd2 := exec.Command("netsh", "interface", "ip", "show", "config")
	out2, err := cmd2.Output()
	if err != nil {
		return info
	}

	lines2 := strings.Split(string(out2), "\n")
	for _, line := range lines2 {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "IP Address") && !strings.Contains(trimmed, "Subnet") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				ip := strings.TrimSpace(parts[1])
				if ip != "" && info.IP == "" {
					info.IP = ip
				}
			}
		}
		if strings.HasPrefix(trimmed, "Default Gateway") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				gw := strings.TrimSpace(parts[1])
				if gw != "" && info.Gateway == "" {
					info.Gateway = gw
				}
			}
		}
	}

	return info
}

// GetDiskModel returns the disk model via PowerShell
func GetDiskModel() string {
	cmd := exec.Command("powershell", "-Command",
		"Get-PhysicalDisk | Select-Object -ExpandProperty FriendlyName | Select-Object -First 1")
	out, err := cmd.Output()
	if err != nil {
		return "Unknown"
	}
	return strings.TrimSpace(string(out))
}

// DetectDiskType returns disk type (SSD, HDD, NVMe, unknown)
func DetectDiskType() string {
	cmd := exec.Command("powershell", "-Command",
		"Get-PhysicalDisk | Select-Object -ExpandProperty MediaType | Select-Object -First 1")
	out, err := cmd.Output()
	if err != nil {
		return "unknown"
	}
	mediaType := strings.TrimSpace(string(out))
	switch mediaType {
	case "SSD":
		return "SSD"
	case "HDD":
		return "HDD"
	case "SCM":
		return "NVMe"
	default:
		model := GetDiskModel()
		if strings.Contains(strings.ToUpper(model), "NVME") {
			return "NVMe"
		}
		return "unknown"
	}
}

// GetDiskUsage returns total and used bytes for C: drive
func GetDiskUsage() (totalBytes uint64, usedBytes uint64) {
	cmd := exec.Command("powershell", "-Command",
		"Get-PSDrive C | Select-Object Used, @{Name='Total';Expression={$_.Used + $_.Free}}")
	out, err := cmd.Output()
	if err != nil {
		return 0, 0
	}
	lines := strings.Split(string(out), "\n")
	var used, total float64
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) >= 2 {
			u, e1 := strconv.ParseFloat(fields[0], 64)
			t, e2 := strconv.ParseFloat(fields[1], 64)
			if e1 == nil && e2 == nil {
				used = u
				total = t
				break
			}
		}
	}
	return uint64(total), uint64(used)
}

// detectCPU returns CPU model and core count via PowerShell
func detectCPU() (model string, cores int) {
	cmd := exec.Command("powershell", "-Command",
		"Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores")
	out, err := cmd.Output()
	if err != nil {
		return "Unknown", 1
	}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		if strings.Contains(line, "Name") && strings.Contains(line, "NumberOfCores") {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) >= 2 {
			model = strings.Join(parts[:len(parts)-1], " ")
			coresStr := parts[len(parts)-1]
			if c, err := strconv.Atoi(coresStr); err == nil {
				cores = c
			}
			break
		}
	}
	if model == "" {
		model = "Unknown"
	}
	if cores == 0 {
		cores = 1
	}
	return
}

// getTotalRAM returns total RAM via PowerShell
func getTotalRAM() uint64 {
	cmd := exec.Command("powershell", "-Command",
		"(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory")
	out, err := cmd.Output()
	if err != nil {
		return 0
	}
	val, err := strconv.ParseUint(strings.TrimSpace(string(out)), 10, 64)
	if err != nil {
		return 0
	}
	return val
}

// getUsedRAM returns used RAM via GlobalMemoryStatusEx kernel32 call
func getUsedRAM() uint64 {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	globalMemoryStatusEx := kernel32.NewProc("GlobalMemoryStatusEx")
	var memStatus [64]byte
	memStatus[0] = 64 // dwLength
	globalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&memStatus[0])))
	totalPhys := *(*uint64)(unsafe.Pointer(&memStatus[8]))
	availPhys := *(*uint64)(unsafe.Pointer(&memStatus[16]))
	return totalPhys - availPhys
}