//go:build windows

package collector

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

type WiFiInfo struct {
	SSID      string
	SignalDBM int
	LinkSpeed float64
	IP        string
	Gateway   string
}

func GetWiFiInfo() WiFiInfo {
	info := WiFiInfo{SignalDBM: -999}

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
				if pct, err := strconv.Atoi(strings.TrimSpace(signalStr)); err == nil {
					switch {
					case pct >= 100:
						info.SignalDBM = -30
					case pct <= 0:
						info.SignalDBM = -90
					default:
						info.SignalDBM = -90 + (pct * 60 / 100)
					}
				}
			}
		}
		if strings.HasPrefix(trimmed, "Receive rate") || strings.HasPrefix(trimmed, "Transmit rate") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				rateStr := strings.TrimSuffix(strings.TrimSpace(parts[1]), " Mbps")
				if rate, err := strconv.ParseFloat(rateStr, 64); err == nil && rate > 0 {
					info.LinkSpeed = rate
				}
			}
		}
	}

	cmd2 := exec.Command("netsh", "interface", "ip", "show", "config")
	out2, err := cmd2.Output()
	if err != nil {
		return info
	}

	for _, line := range strings.Split(string(out2), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "IP Address") && !strings.Contains(trimmed, "Subnet") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 && info.IP == "" {
				info.IP = strings.TrimSpace(parts[1])
			}
		}
		if strings.HasPrefix(trimmed, "Default Gateway") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 && info.Gateway == "" {
				info.Gateway = strings.TrimSpace(parts[1])
			}
		}
	}

	return info
}

func detectCPU() (model string, cores int) {
	out, err := exec.Command("powershell", "-NoProfile", "-Command",
		"Get-CimInstance Win32_Processor | Select-Object -ExpandProperty Name -First 1").Output()
	if err == nil {
		model = strings.TrimSpace(string(out))
	}
	if model == "" {
		model = "Unknown"
	}

	out2, err := exec.Command("powershell", "-NoProfile", "-Command",
		"(Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors").Output()
	if err == nil {
		if c, e := strconv.Atoi(strings.TrimSpace(string(out2))); e == nil && c > 0 {
			cores = c
		}
	}
	if cores == 0 {
		cores = 1
	}
	return
}

func detectRAM() (totalBytes, usedBytes uint64) {
	out, err := exec.Command("powershell", "-NoProfile", "-Command",
		"$os=Get-CimInstance Win32_OperatingSystem; Write-Output \"$($os.TotalVisibleMemorySize)|$($os.FreePhysicalMemory)\"").Output()
	if err == nil {
		parts := strings.SplitN(strings.TrimSpace(string(out)), "|", 2)
		if len(parts) == 2 {
			if totalKB, e := strconv.ParseUint(parts[0], 10, 64); e == nil {
				totalBytes = totalKB * 1024
			}
			if freeKB, e := strconv.ParseUint(parts[1], 10, 64); e == nil {
				usedBytes = totalBytes - (freeKB * 1024)
			}
		}
	}
	return
}

func detectDiskUsage() (pct float64, used, total uint64) {
	out, err := exec.Command("powershell", "-NoProfile", "-Command",
		"$d=Get-PSDrive C; Write-Output \"$($d.Used)|$($d.Free)\"").Output()
	if err == nil {
		parts := strings.SplitN(strings.TrimSpace(string(out)), "|", 2)
		if len(parts) == 2 {
			if u, e := strconv.ParseUint(parts[0], 10, 64); e == nil {
				used = u
			}
			if f, e := strconv.ParseUint(parts[1], 10, 64); e == nil {
				total = used + f
			}
		}
	}
	if total > 0 {
		pct = float64(used) / float64(total) * 100
	}
	return
}

func detectDiskInfo() (diskType, diskModel, diskHealth string, diskTemp float64) {
	out, err := exec.Command("powershell", "-NoProfile", "-Command",
		"$d=Get-CimInstance Win32_DiskDrive | Select-Object -First 1; if($d){Write-Output \"$($d.Model)|$($d.MediaType)\"}else{Write-Output '|'}").Output()
	if err == nil {
		trimmed := strings.TrimSpace(string(out))
		parts := strings.SplitN(trimmed, "|", 2)
		if len(parts) >= 1 && parts[0] != "" {
			diskModel = parts[0]
		}
		if len(parts) >= 2 {
			mt := strings.ToLower(strings.TrimSpace(parts[1]))
			switch {
			case strings.Contains(mt, "ssd") || strings.Contains(mt, "solid state"):
				diskType = "ssd"
			case strings.Contains(mt, "nvme"):
				diskType = "nvme"
			case mt == "fixed hard disk media" || mt == "external hard disk media":
				if strings.Contains(strings.ToUpper(diskModel), "SSD") ||
					strings.Contains(strings.ToUpper(diskModel), "NVME") ||
					strings.Contains(strings.ToUpper(diskModel), "SSDP") {
					diskType = "ssd"
				} else {
					diskType = "hdd"
				}
			case mt != "":
				diskType = mt
			default:
				diskType = "unknown"
			}
		}
	}

	out2, err := exec.Command("powershell", "-NoProfile", "-Command",
		"$d=Get-PhysicalDisk | Select-Object -First 1; if($d -and $d.HealthStatus){Write-Output $d.HealthStatus}else{Write-Output 'unknown'}").Output()
	if err == nil {
		h := strings.ToLower(strings.TrimSpace(string(out2)))
		if h != "" && h != "unknown" {
			diskHealth = h
		}
	}
	if diskHealth == "" {
		diskHealth = "unknown"
	}
	if diskType == "" {
		diskType = "unknown"
	}
	return
}

func detectDiskHealthPercent() float64 {
	script := `try{$d=Get-PhysicalDisk|Select -First 1;$r=$d|Get-StorageReliabilityCounter -EA Stop;if($r.Wear -ne $null){[math]::Max(0,100-$r.Wear)}else{switch($d.HealthStatus){'Healthy'{100}'Warning'{70}default{30}}}}catch{switch((Get-PhysicalDisk|Select -First 1).HealthStatus){'Healthy'{100}'Warning'{70}default{30}}}`
	out, err := exec.Command("powershell", "-NoProfile", "-Command", script).Output()
	if err == nil {
		trimmed := strings.TrimSpace(string(out))
		if pct, e := strconv.ParseFloat(trimmed, 64); e == nil && pct >= 0 && pct <= 100 {
			return pct
		}
	}
	return 100
}

func collectProcessList() []ProcessInfo {
	out, err := exec.Command("powershell", "-NoProfile", "-Command",
		"Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 | ForEach-Object { $n=if($_.MainWindowTitle){$_.MainWindowTitle}else{$_.Name}; Write-Output \"$n|$($_.Id)|$($_.CPU)|$([math]::Round($_.WorkingSet64/1MB,1))\" }").Output()
	if err != nil {
		return nil
	}
	var result []ProcessInfo
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		parts := strings.SplitN(strings.TrimSpace(line), "|", 4)
		if len(parts) < 4 {
			continue
		}
		pid, _ := strconv.Atoi(parts[1])
		cpu, _ := strconv.ParseFloat(parts[2], 64)
		mem, _ := strconv.ParseFloat(parts[3], 64)
		result = append(result, ProcessInfo{
			Name:     parts[0],
			PID:      int32(pid),
			CPU:      cpu,
			MemoryMB: mem,
		})
	}
	return result
}

func getLocalIPs() []string {
	cmd := exec.Command("powershell", "-NoProfile", "-Command",
		"(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*'}).IPAddress")
	out, err := cmd.Output()
	if err != nil {
		return nil
	}
	var ips []string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		ip := strings.TrimSpace(line)
		if ip != "" && !isVirtualAdapterIP(ip) {
			ips = append(ips, ip)
		}
	}
	return ips
}

func getDefaultGatewayForInterface(idx int) string {
	cmd := exec.Command("powershell", "-NoProfile", "-Command",
		fmt.Sprintf("(Get-NetRoute -InterfaceIndex %d -DestinationPrefix '0.0.0.0/0').NextHop", idx))
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}
