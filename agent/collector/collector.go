package collector

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

type Metrics struct {
	CPUPercent        float64
	RAMPercent        float64
	MemoryUsed        int64
	MemoryTotal       int64
	StoragePercent    float64
	DiskUsed          int64
	DiskTotal         int64
	UptimeSeconds    int64
	NetworkStatus    string
	NetworkLatencyMs float64
	GatewayReachable bool
	DNSWorking       bool
	InternetReachable bool
	DefaultGateway   string
	DiskHealthStatus string
	DiskTemperatureC float64
}

type Location struct {
	Latitude       float64
	Longitude      float64
	AccuracyMeters float64
	Source         string
}

type NetworkInfo struct {
	WiFiSSID        string
	WiFiSignalDBM   int
	NetworkSpeedMbps int
	IPAddresses     []string
}

type Info struct {
	Hostname          string
	OS                string
	OSVersion         string
	AgentVersion      string
	AgentID           string
	APIKey            string
	MACAddresses      []string
	IPAddresses       []string
	CPUModel          string
	CPUCores          int
	RAMTotalBytes     int64
	StorageTotalBytes int64
	DiskModel         string
	DiskType          string
	WiFiSSID          string
	WiFiSignalDBM     int
	NetworkSpeedMbps  int
}

func CollectInfo(apiKey string) *Info {
	hostname, _ := os.Hostname()
	info := &Info{
		Hostname:          hostname,
		OS:                runtime.GOOS,
		OSVersion:         runtime.GOARCH,
		AgentVersion:      "1.0.0",
		AgentID:           hostname + "-" + runtime.GOOS,
		APIKey:            apiKey,
		MACAddresses:      []string{},
		IPAddresses:       []string{},
		CPUModel:          "Unknown",
		CPUCores:          0,
		RAMTotalBytes:     0,
		StorageTotalBytes: 0,
		DiskModel:         "",
		DiskType:          "unknown",
		WiFiSSID:          "",
		WiFiSignalDBM:     0,
		NetworkSpeedMbps:  0,
	}

	if runtime.GOOS == "windows" {
		info.OSVersion = getWindowsOSVersion()
		info.CPUModel = getWindowsCPUModel()
		info.CPUCores = getWindowsCPUCores()
		info.RAMTotalBytes = getWindowsRAMTotal()
		info.StorageTotalBytes = getWindowsStorageTotal()
		info.DiskModel = getWindowsDiskModel()
		info.DiskType = getWindowsDiskType()
		info.MACAddresses = getWindowsMACAddresses()
		info.IPAddresses = getWindowsIPAddresses()
		info.WiFiSSID = getWindowsWiFiSSID()
		info.WiFiSignalDBM = getWindowsWiFiSignal()
		info.NetworkSpeedMbps = getWindowsNetworkSpeed()

		// Create stable agent ID from hostname + first MAC
		if len(info.MACAddresses) > 0 {
			shortMAC := strings.ReplaceAll(info.MACAddresses[0], ":", "")
			if len(shortMAC) > 8 {
				shortMAC = shortMAC[:8]
			}
			info.AgentID = hostname + "-" + shortMAC
		}
	}

	return info
}

func CollectMetrics() *Metrics {
	m := &Metrics{
		CPUPercent:       0,
		RAMPercent:       0,
		MemoryUsed:       0,
		MemoryTotal:      0,
		StoragePercent:   0,
		DiskUsed:         0,
		DiskTotal:        0,
		UptimeSeconds:    0,
		NetworkStatus:    "up",
		NetworkLatencyMs: 0,
		DiskHealthStatus: "unknown",
		DiskTemperatureC: 0,
	}

	if runtime.GOOS == "windows" {
		m.CPUPercent = getWindowsCPUPercent()
		m.MemoryTotal = getWindowsRAMTotal()
		m.MemoryUsed = getWindowsRAMUsed()
		if m.MemoryTotal > 0 {
			m.RAMPercent = float64(m.MemoryUsed) / float64(m.MemoryTotal) * 100
		}
		m.DiskTotal = getWindowsStorageTotal()
		m.DiskUsed = getWindowsStorageUsed()
		if m.DiskTotal > 0 {
			m.StoragePercent = float64(m.DiskUsed) / float64(m.DiskTotal) * 100
		}
		m.UptimeSeconds = getWindowsUptime()
		m.NetworkLatencyMs = getWindowsNetworkLatency()
		m.DiskHealthStatus = getWindowsDiskHealth()
	}

	gw, err := GetDefaultGateway()
	if err == nil {
		m.DefaultGateway = gw
		m.GatewayReachable = true
	}
	m.DNSWorking = CheckDNS()
	m.InternetReachable = CheckInternet()

	return m
}

func CollectNetwork() *NetworkInfo {
	info := &NetworkInfo{
		WiFiSSID:         "",
		WiFiSignalDBM:    0,
		NetworkSpeedMbps: 0,
		IPAddresses:      []string{},
	}
	if runtime.GOOS == "windows" {
		info.WiFiSSID = getWindowsWiFiSSID()
		info.WiFiSignalDBM = getWindowsWiFiSignal()
		info.NetworkSpeedMbps = getWindowsNetworkSpeed()
		info.IPAddresses = getWindowsIPAddresses()
	}
	return info
}

// ======== Windows helpers ========

func runPS(script string) string {
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script)
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func getWindowsOSVersion() string {
	return runPS("(Get-CimInstance Win32_OperatingSystem).Version")
}

func getWindowsCPUModel() string {
	return runPS("(Get-CimInstance Win32_Processor | Select-Object -First 1).Name")
}

func getWindowsCPUCores() int {
	s := runPS("(Get-CimInstance Win32_Processor | Select-Object -First 1).NumberOfCores")
	if s == "" {
		return runtime.NumCPU()
	}
	var c int
	fmt.Sscanf(s, "%d", &c)
	if c == 0 {
		return runtime.NumCPU()
	}
	return c
}

func getWindowsRAMTotal() int64 {
	s := runPS("(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory")
	if s == "" {
		return 0
	}
	var t int64
	fmt.Sscanf(s, "%d", &t)
	return t
}

func getWindowsRAMUsed() int64 {
	totalKB := runPS("(Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize")
	freeKB := runPS("(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory")
	if totalKB == "" || freeKB == "" {
		return 0
	}
	var tk, fk int64
	fmt.Sscanf(totalKB, "%d", &tk)
	fmt.Sscanf(freeKB, "%d", &fk)
	if tk == 0 {
		return 0
	}
	return (tk - fk) * 1024
}

func getWindowsCPUPercent() float64 {
	s := runPS("(Get-CimInstance Win32_Processor | Select-Object -First 1).LoadPercentage")
	if s == "" {
		return 0
	}
	var p float64
	fmt.Sscanf(s, "%f", &p)
	return p
}

func getWindowsStorageTotal() int64 {
	s := runPS("(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Measure-Object -Property Size -Sum).Sum")
	if s == "" {
		return 0
	}
	var t int64
	fmt.Sscanf(s, "%d", &t)
	return t
}

func getWindowsStorageUsed() int64 {
	total := getWindowsStorageTotal()
	if total == 0 {
		return 0
	}
	freeS := runPS("(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Measure-Object -Property FreeSpace -Sum).Sum")
	if freeS == "" {
		return 0
	}
	var f int64
	fmt.Sscanf(freeS, "%d", &f)
	return total - f
}

func getWindowsDiskModel() string {
	return runPS("(Get-CimInstance Win32_DiskDrive | Select-Object -First 1).Model")
}

func getWindowsDiskType() string {
	// MediaType: 3=HDD, 4=SSD
	mt := runPS("(Get-CimInstance Win32_DiskDrive | Select-Object -First 1).MediaType")
	switch mt {
	case "4":
		return "SSD"
	case "3":
		return "HDD"
	}
	// Fallback via Get-PhysicalDisk
	pm := runPS("(Get-PhysicalDisk | Select-Object -First 1).MediaType")
	switch pm {
	case "4", "SSD":
		return "SSD"
	case "3", "HDD":
		return "HDD"
	}
	return "SSD"
}

func getWindowsMACAddresses() []string {
	s := runPS("(Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -First 1).MacAddress")
	if s == "" {
		return []string{}
	}
	return []string{strings.ToLower(s)}
}

func getWindowsIPAddresses() []string {
	s := runPS("(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike '*Loopback*'}).IPAddress")
	if s == "" {
		return []string{}
	}
	return strings.Split(s, "\r\n")
}

func getWindowsWiFiSSID() string {
	return runPS("(Get-NetConnectionProfile).Name")
}

func getWindowsWiFiSignal() int {
	s := runPS("(netsh wlan show interfaces | Select-String 'Signal' | ForEach-Object { [int]($_ -replace '.*:\\s*|%', '') })")
	if s == "" {
		return 0
	}
	var sig int
	fmt.Sscanf(s, "%d", &sig)
	return sig
}

func getWindowsNetworkSpeed() int {
	s := runPS("(Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -First 1).LinkSpeed")
	if s == "" {
		return 0
	}
	s = strings.ReplaceAll(s, " Mbps", "")
	var sp int
	fmt.Sscanf(s, "%d", &sp)
	return sp
}

func getWindowsNetworkLatency() float64 {
	cmd := exec.Command("ping", "-n", "1", "-w", "3000", "8.8.8.8")
	out, err := cmd.Output()
	if err != nil {
		return 0
	}
	output := string(out)
	if idx := strings.Index(output, "Average = "); idx != -1 {
		part := output[idx+10:]
		if end := strings.Index(part, "ms"); end != -1 {
			var ms float64
			fmt.Sscanf(part[:end], "%f", &ms)
			return ms
		}
	}
	return 0
}

func getWindowsDiskHealth() string {
	return runPS("(Get-PhysicalDisk | Select-Object -First 1).HealthStatus")
}

func getWindowsUptime() int64 {
	s := runPS("(Get-CimInstance Win32_OperatingSystem).LastBootUpTime")
	if s == "" || len(s) < 14 {
		return 0
	}
	t, err := time.Parse("20060102150405", s[:14])
	if err != nil {
		return 0
	}
	return int64(time.Since(t).Seconds())
}
