package collector

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

func collectWindowsHardware() SystemInfo {
	hostname, _ := os.Hostname()
	macs := getWindowsMACs()
	ips := getWindowsIPs()
	cpu := getWindowsCPU()
	cores := getWindowsCPUCores()
	ram := getWindowsRAM()
	storage := getWindowsStorage()
	diskModel, diskType := getWindowsDisk()
	wifiSSID, wifiSignal := getWindowsWiFi()
	speed := getWindowsNetworkSpeed()

	return SystemInfo{
		Hostname:         hostname,
		MACAddresses:     macs,
		IPAddresses:      ips,
		CPUModel:         cpu,
		CPUCores:         cores,
		RAMTotalBytes:    ram,
		StorageTotalBytes: storage,
		DiskModel:        diskModel,
		DiskType:         diskType,
		WiFiSSID:         wifiSSID,
		WiFiSignalDBM:    wifiSignal,
		NetworkSpeedMbps: speed,
	}
}

func collectWindowsOSVersion() string {
	cmd := exec.Command("cmd", "/c", "ver")
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func getWindowsMACs() []string {
	cmd := exec.Command("powershell", "-Command",
		"Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -ExpandProperty MacAddress")
	out, err := cmd.Output()
	if err != nil {
		return nil
	}
	var macs []string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		m := strings.TrimSpace(line)
		if m != "" {
			macs = append(macs, m)
		}
	}
	return macs
}

func getWindowsIPs() []string {
	cmd := exec.Command("powershell", "-Command",
		"Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' } | Select-Object -ExpandProperty IPAddress")
	out, err := cmd.Output()
	if err != nil {
		return nil
	}
	var ips []string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		ip := strings.TrimSpace(line)
		if ip != "" {
			ips = append(ips, ip)
		}
	}
	return ips
}

func getWindowsCPU() string {
	cmd := exec.Command("powershell", "-Command", "(Get-CimInstance Win32_Processor).Name")
	out, err := cmd.Output()
	if err != nil {
		return "Unknown"
	}
	return strings.TrimSpace(string(out))
}

func getWindowsCPUCores() int {
	cmd := exec.Command("powershell", "-Command", "(Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors")
	out, err := cmd.Output()
	if err != nil {
		return 0
	}
	cores := 0
	fmt.Sscanf(strings.TrimSpace(string(out)), "%d", &cores)
	return cores
}

func getWindowsRAM() int64 {
	cmd := exec.Command("powershell", "-Command",
		"(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory")
	out, err := cmd.Output()
	if err != nil {
		return 0
	}
	var ram int64
	fmt.Sscanf(strings.TrimSpace(string(out)), "%d", &ram)
	return ram
}

func getWindowsStorage() int64 {
	cmd := exec.Command("powershell", "-Command",
		"(Get-CimInstance Win32_LogicalDisk -Filter 'DeviceID=\"C:\"').Size")
	out, err := cmd.Output()
	if err != nil {
		return 0
	}
	var size int64
	fmt.Sscanf(strings.TrimSpace(string(out)), "%d", &size)
	return size
}

func getWindowsDisk() (string, string) {
	cmd := exec.Command("powershell", "-Command",
		"(Get-PhysicalDisk | Select-Object FriendlyName, MediaType | Format-List)")
	out, err := cmd.Output()
	if err != nil {
		return "", "unknown"
	}
	text := string(out)
	model := ""
	mediaType := "unknown"
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "FriendlyName") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				model = strings.TrimSpace(parts[1])
			}
		}
		if strings.HasPrefix(line, "MediaType") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				mediaType = strings.TrimSpace(parts[1])
			}
		}
	}
	return model, mediaType
}

func getWindowsWiFi() (string, int) {
	cmd := exec.Command("netsh", "wlan", "show", "interfaces")
	out, err := cmd.Output()
	if err != nil {
		return "", 0
	}
	text := string(out)
	ssid := ""
	signal := 0
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "SSID") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				ssid = strings.TrimSpace(parts[1])
			}
		}
		if strings.HasPrefix(line, "Signal") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				s := strings.TrimSpace(parts[1])
				s = strings.TrimSuffix(s, "%")
				fmt.Sscanf(s, "%d", &signal)
			}
		}
	}
	return ssid, signal
}

func getWindowsNetworkSpeed() float64 {
	cmd := exec.Command("powershell", "-Command",
		"(Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object -First 1 -ExpandProperty LinkSpeed)")
	out, err := cmd.Output()
	if err != nil {
		return 0
	}
	speed := strings.TrimSpace(string(out))
	speed = strings.Replace(speed, " Gbps", "000", 1)
	speed = strings.Replace(speed, " Mbps", "", 1)
	var mbps float64
	fmt.Sscanf(speed, "%f", &mbps)
	return mbps
}