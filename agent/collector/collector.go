package collector

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

type ErrorLogItem struct {
	Time    string `json:"time"`
	ID      int    `json:"id"`
	Level   string `json:"level"`
	Source  string `json:"source"`
	Message string `json:"message"`
}

type Metrics struct {
	CPUPercent        float64        `json:"cpu_percent"`
	RAMPercent        float64        `json:"ram_percent"`
	RAMUsedBytes      uint64         `json:"ram_used_bytes"`
	RAMTotalBytes     uint64         `json:"ram_total_bytes"`
	StoragePercent    float64        `json:"storage_percent"`
	StorageUsedBytes  uint64         `json:"storage_used_bytes"`
	StorageTotalBytes uint64         `json:"storage_total_bytes"`
	UptimeSeconds     uint64         `json:"uptime_seconds"`
	NetworkStatus     string         `json:"network_status"`
	NetworkLatencyMs  float64        `json:"network_latency_ms"`
	PingLatencyMs     float64        `json:"ping_latency_ms"`
	ErrorCount        int            `json:"error_count"`
	ErrorLogs         []ErrorLogItem `json:"error_logs,omitempty"`
	Timestamp         string         `json:"timestamp"`
}

type NetworkInfo struct {
	WiFiSSID      string   `json:"wifi_ssid"`
	WiFiSignalDBM int      `json:"wifi_signal_dbm"`
	SpeedMbps     int      `json:"network_speed_mbps"`
	IPAddresses   []string `json:"ip_addresses"`
	WiFiIP        string   `json:"wifi_ip"`
	GatewayIP     string   `json:"gateway_ip"`
}

type Location struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	City           string  `json:"city,omitempty"`
	Country        string  `json:"country,omitempty"`
	Timestamp      string  `json:"timestamp"`
}

type RegistrationInfo struct {
	Hostname          string   `json:"hostname"`
	OS                string   `json:"os"`
	OSVersion         string   `json:"os_version"`
	AgentVersion      string   `json:"agent_version"`
	APIKey            string   `json:"api_key"`
	MACAddresses      []string `json:"mac_addresses"`
	IPAddresses       []string `json:"ip_addresses"`
	CPUModel          string   `json:"cpu_model"`
	CPUCores          int      `json:"cpu_cores"`
	RAMTotalBytes     uint64   `json:"ram_total_bytes"`
	StorageTotalBytes uint64   `json:"storage_total_bytes"`
	DiskModel         string   `json:"disk_model"`
	DiskType          string   `json:"disk_type"`
	WiFiSSID          string   `json:"wifi_ssid"`
	WiFiSignalDBM     int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps  int      `json:"network_speed_mbps"`
}

func CollectInfo(apiKey string) *RegistrationInfo {
	info := &RegistrationInfo{
		Hostname:         hostname(),
		OS:               runtime.GOOS,
		OSVersion:        osVersion(),
		AgentVersion:     "1.0.0",
		APIKey:           apiKey,
		CPUModel:         "Unknown",
		CPUCores:         0,
		RAMTotalBytes:    0,
		StorageTotalBytes: 0,
		DiskModel:        "",
		DiskType:         "unknown",
		WiFiSSID:         "",
		WiFiSignalDBM:    0,
		NetworkSpeedMbps: 0,
	}

	if runtime.GOOS == "windows" {
		info.CPUModel = psString("(Get-CimInstance Win32_Processor | Select-Object -First 1).Name")
		info.CPUCores = psInt("(Get-CimInstance Win32_Processor | Select-Object -First 1).NumberOfCores", runtime.NumCPU())
		info.RAMTotalBytes = psUint64("(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory", 0)
		info.StorageTotalBytes = psUint64("(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Measure-Object -Property Size -Sum).Sum", 0)
		info.DiskModel = psString("(Get-CimInstance Win32_DiskDrive | Select-Object -First 1).Model")
		info.DiskType = getDiskType()
		info.MACAddresses = getMACs()
		info.IPAddresses = getIPs()
		info.WiFiSSID = getWiFiSSID()
		info.WiFiSignalDBM = getWiFiSignalDBM()
		info.NetworkSpeedMbps = psInt("(Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -First 1).LinkSpeed", 100)
	}

	return info
}

func CollectMetrics() *Metrics {
	m := &Metrics{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	if runtime.GOOS == "windows" {
		m.CPUPercent = psFloat("(Get-CimInstance Win32_Processor | Select-Object -First 1).LoadPercentage", 0)
		m.RAMTotalBytes = psUint64("(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory", 0)

		totalKB := psUint64("(Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize", 0)
		freeKB := psUint64("(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory", 0)
		if totalKB > 0 {
			m.RAMUsedBytes = (totalKB - freeKB) * 1024
			m.RAMPercent = float64(m.RAMUsedBytes) / float64(m.RAMTotalBytes) * 100
		}

		m.StorageTotalBytes = psUint64("(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Measure-Object -Property Size -Sum).Sum", 0)
		freeBytes := psUint64("(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Measure-Object -Property FreeSpace -Sum).Sum", 0)
		if m.StorageTotalBytes > 0 {
			m.StorageUsedBytes = m.StorageTotalBytes - freeBytes
			m.StoragePercent = float64(m.StorageUsedBytes) / float64(m.StorageTotalBytes) * 100
		}
		m.UptimeSeconds = getUptime()
		m.PingLatencyMs = pingLatency()
		m.NetworkLatencyMs = m.PingLatencyMs
		m.NetworkStatus = "up"
		if m.PingLatencyMs == 0 {
			m.NetworkStatus = "down"
		}

		// Ambil error count + error logs detail dari Event Log
		m.ErrorCount, m.ErrorLogs = getSystemErrors()
	}

	return m
}

func CollectNetwork() *NetworkInfo {
	n := &NetworkInfo{
		IPAddresses: getIPs(),
	}
	if runtime.GOOS == "windows" {
		n.WiFiSSID = getWiFiSSID()
		n.WiFiSignalDBM = getWiFiSignalDBM()
		n.SpeedMbps = psInt("(Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -First 1).LinkSpeed", 100)
		n.WiFiIP = getWiFiIP()
		n.GatewayIP = getDefaultGateway()
	}
	return n
}

func CollectLocation() *Location {
	loc := geoIPLocation()
	if loc != nil {
		return loc
	}
	return &Location{
		Latitude:       0,
		Longitude:      0,
		AccuracyMeters: 0,
		Source:         "unknown",
		Timestamp:      time.Now().UTC().Format(time.RFC3339),
	}
}

// ======== WiFi-specific ========

func getWiFiSSID() string {
	s := psString("(Get-NetConnectionProfile).Name")
	if s != "" {
		return s
	}
	s = psString("netsh wlan show interfaces | Select-String 'SSID' | Select-Object -First 1 | ForEach-Object { $_ -replace '.*:\\s*', '' }")
	return strings.TrimSpace(s)
}

func getWiFiSignalDBM() int {
	s := psString("netsh wlan show interfaces | Select-String 'Signal' | Select-Object -First 1 | ForEach-Object { [int]($_ -replace '.*:\\s*|%', '') }")
	if s == "" {
		return 0
	}
	var pct int
	fmt.Sscanf(s, "%d", &pct)
	if pct > 0 {
		return -30 - (100-pct)*60/100
	}
	return 0
}

func getWiFiIP() string {
	s := psString("(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias '*Wi-Fi*' | Select-Object -First 1).IPAddress")
	if s != "" {
		return s
	}
	s = psString("(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias '*Wireless*' | Select-Object -First 1).IPAddress")
	return s
}

func getDefaultGateway() string {
	return psString("(Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Select-Object -First 1).NextHop")
}

// ======== System Error Logs ========

func getSystemErrors() (int, []ErrorLogItem) {
	psScript := `Get-WinEvent -FilterHashtable @{LogName='System'; Level=2; StartTime=(Get-Date).AddHours(-1)} -MaxEvents 50 -ErrorAction SilentlyContinue | Select-Object @{N='time';E={$_.TimeCreated.ToString('o')}}, @{N='id';E={$_.Id}}, @{N='level';E={$_.LevelDisplayName}}, @{N='source';E={$_.ProviderName}}, @{N='message';E={$_.Message}} | ConvertTo-Json -Compress`

	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", psScript)
	out, err := cmd.Output()
	if err != nil {
		return 0, nil
	}

	raw := strings.TrimSpace(string(out))
	if raw == "" || raw == "[]" || raw == "null" {
		return 0, nil
	}

	// PowerShell ConvertTo-Json kadang mengembalikan objek tunggal jika hanya 1 hasil
	var logs []ErrorLogItem
	if strings.HasPrefix(raw, "[") {
		if err := json.Unmarshal([]byte(raw), &logs); err != nil {
			return 0, nil
		}
	} else {
		var single ErrorLogItem
		if err := json.Unmarshal([]byte(raw), &single); err != nil {
			return 0, nil
		}
		logs = []ErrorLogItem{single}
	}

	// Bersihkan karakter kontrol dari message (bisa rusak JSON saat dikirim)
	for i := range logs {
		logs[i].Message = cleanMessage(logs[i].Message)
	}

	return len(logs), logs
}

func cleanMessage(msg string) string {
	// Hapus karakter kontrol dan newline berlebih
	msg = strings.ReplaceAll(msg, "\r\n", " | ")
	msg = strings.ReplaceAll(msg, "\n", " | ")
	msg = strings.ReplaceAll(msg, "\r", " | ")
	// Hapus karakter non-printable
	var b strings.Builder
	for _, r := range msg {
		if r >= 32 || r == '\t' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// ======== Helpers ========

var startTime = time.Now()

func hostname() string {
	h, _ := os.Hostname()
	return h
}

func osVersion() string {
	if runtime.GOOS == "windows" {
		return psString("(Get-CimInstance Win32_OperatingSystem).Version")
	}
	return runtime.GOARCH
}

func getMACs() []string {
	s := psString("(Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -First 1).MacAddress")
	if s == "" {
		return nil
	}
	return []string{strings.ToLower(s)}
}

func getIPs() []string {
	var ips []string
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipnet, ok := addr.(*net.IPNet)
			if ok && ipnet.IP.To4() != nil {
				ips = append(ips, ipnet.IP.String())
			}
		}
	}
	return ips
}

func getDiskType() string {
	mt := psString("(Get-CimInstance Win32_DiskDrive | Select-Object -First 1).MediaType")
	switch mt {
	case "4":
		return "SSD"
	case "3":
		return "HDD"
	}
	pm := psString("(Get-PhysicalDisk | Select-Object -First 1).MediaType")
	switch pm {
	case "4":
		return "SSD"
	case "3":
		return "HDD"
	}
	return "SSD"
}

func getUptime() uint64 {
	if runtime.GOOS == "windows" {
		s := psString("(Get-CimInstance Win32_OperatingSystem).LastBootUpTime")
		if len(s) >= 14 {
			t, err := time.Parse("20060102150405", s[:14])
			if err == nil {
				return uint64(time.Since(t).Seconds())
			}
		}
	}
	return uint64(time.Since(startTime).Seconds())
}

func pingLatency() float64 {
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
	if idx := strings.Index(output, "time="); idx != -1 {
		part := output[idx+5:]
		if end := strings.Index(part, "ms"); end != -1 {
			var ms float64
			fmt.Sscanf(part[:end], "%f", &ms)
			return ms
		}
	}
	return 0
}

func geoIPLocation() *Location {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("http://ip-api.com/json/?fields=lat,lon,city,country,status")
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}

	var result struct {
		Status  string  `json:"status"`
		Lat     float64 `json:"lat"`
		Lon     float64 `json:"lon"`
		City    string  `json:"city"`
		Country string  `json:"country"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil
	}

	if result.Status != "success" {
		return nil
	}

	return &Location{
		Latitude:       result.Lat,
		Longitude:      result.Lon,
		AccuracyMeters: 5000,
		Source:         "geoip",
		City:           result.City,
		Country:        result.Country,
		Timestamp:      time.Now().UTC().Format(time.RFC3339),
	}
}

func psString(script string) string {
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script)
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func psInt(script string, fallback int) int {
	s := psString(script)
	if s == "" {
		return fallback
	}
	var v int
	if _, err := fmt.Sscanf(s, "%d", &v); err != nil {
		return fallback
	}
	return v
}

func psFloat(script string, fallback float64) float64 {
	s := psString(script)
	if s == "" {
		return fallback
	}
	var v float64
	if _, err := fmt.Sscanf(s, "%f", &v); err != nil {
		return fallback
	}
	return v
}

func psUint64(script string, fallback uint64) uint64 {
	s := psString(script)
	if s == "" {
		return fallback
	}
	var v uint64
	if _, err := fmt.Sscanf(s, "%d", &v); err != nil {
		return fallback
	}
	return v
}
