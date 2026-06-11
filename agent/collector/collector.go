package collector

import (
	"encoding/json"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// ──── Types (unchanged) ────

type RegistrationInfo struct {
	Hostname          string   `json:"hostname"`
	OS                string   `json:"os"`
	OSVersion         string   `json:"os_version"`
	AgentVersion      string   `json:"agent_version"`
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
	APIKey            string   `json:"api_key"`
}

type MetricsData struct {
	CPUPercent        float64 `json:"cpu_percent"`
	RAMPercent        float64 `json:"ram_percent"`
	RAMUsedBytes      uint64  `json:"ram_used_bytes"`
	RAMTotalBytes     uint64  `json:"ram_total_bytes"`
	StoragePercent    float64 `json:"storage_percent"`
	StorageUsedBytes  uint64  `json:"storage_used_bytes"`
	StorageTotalBytes uint64  `json:"storage_total_bytes"`
	UptimeSeconds     uint64  `json:"uptime_seconds"`
	NetworkStatus     string  `json:"network_status"`
	NetworkLatencyMs  int     `json:"network_latency_ms"`
	PingLatencyMs     int     `json:"ping_latency_ms"`
	ErrorCount        int     `json:"error_count"`
	DiskHealthStatus  string  `json:"disk_health_status"`
	DiskTemperatureC  int     `json:"disk_temperature_c"`
	Timestamp         string  `json:"timestamp"`

	GatewayReachable  bool   `json:"gateway_reachable"`
	DNSWorking        bool   `json:"dns_working"`
	InternetReachable bool   `json:"internet_reachable"`
	DefaultGateway    string `json:"default_gateway"`
}

type LocationData struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters int     `json:"accuracy_meters"`
	Source         string  `json:"source"`
	Timestamp      string  `json:"timestamp"`
}

type NetworkInfoData struct {
	WiFiSSID         string   `json:"wifi_ssid"`
	WiFiSignalDBM    int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps int      `json:"network_speed_mbps"`
	WiFiIP           string   `json:"wifi_ip,omitempty"`
	GatewayIP        string   `json:"gateway_ip,omitempty"`
	IPAddresses      []string `json:"ip_addresses"`
}

// ──── Public API ────

// CollectInfo accepts an optional custom hostname (e.g., from --hostname flag)
func CollectInfo(apiKey string, customHostname string) RegistrationInfo {
	return collectInfo(apiKey, customHostname)
}

// ──── Internal ────

func collectInfo(apiKey string, customHostname string) RegistrationInfo {
	hn, _ := os.Hostname()
	if customHostname != "" {
		hn = customHostname
	}
	osName, osVer := detectOS()

	totalRAM := getTotalRAM()
	totalDisk, _ := GetDiskUsage()
	diskModel := GetDiskModel()
	diskType := DetectDiskType()

	wifiInfo := GetWiFiInfo()
	macs := GetMACAddresses()
	ips := getLocalIPs()

	cpuModel, cpuCores := detectCPU()

	return RegistrationInfo{
		Hostname:          hn,
		OS:                osName,
		OSVersion:         osVer,
		AgentVersion:      "1.2.0",
		MACAddresses:      macs,
		IPAddresses:       ips,
		CPUModel:          cpuModel,
		CPUCores:          cpuCores,
		RAMTotalBytes:     totalRAM,
		StorageTotalBytes: totalDisk,
		DiskModel:         diskModel,
		DiskType:          diskType,
		WiFiSSID:          wifiInfo.SSID,
		WiFiSignalDBM:     wifiInfo.SignalDBM,
		NetworkSpeedMbps:  wifiInfo.LinkSpeed,
		APIKey:            apiKey,
	}
}

func CollectMetrics() MetricsData {
	// ... (unchanged, same as before)
	now := time.Now().UTC().Format(time.RFC3339)
	totalRAM := getTotalRAM()
	usedRAM := getUsedRAM()
	ramPct := 0.0
	if totalRAM > 0 {
		ramPct = (float64(usedRAM) / float64(totalRAM)) * 100
	}

	totalDisk, usedDisk := GetDiskUsage()
	diskPct := 0.0
	if totalDisk > 0 {
		diskPct = (float64(usedDisk) / float64(totalDisk)) * 100
	}

	cpuPct := getCPUUsage()

	pingMs := ping8x8()
	netStatus := "up"
	if pingMs == -1 {
		netStatus = "degraded"
	}

	wifiInfo := GetWiFiInfo()
	gatewayReachable := isGatewayReachable(wifiInfo.Gateway)
	dnsWorking := isDNWorking()
	internetReachable := isInternetReachable()

	diskHealth, diskTemp := getDiskHealth()

	return MetricsData{
		CPUPercent:        cpuPct,
		RAMPercent:        ramPct,
		RAMUsedBytes:      usedRAM,
		RAMTotalBytes:     totalRAM,
		StoragePercent:    diskPct,
		StorageUsedBytes:  usedDisk,
		StorageTotalBytes: totalDisk,
		UptimeSeconds:     getUptime(),
		NetworkStatus:     netStatus,
		NetworkLatencyMs:  pingMs,
		PingLatencyMs:     pingMs,
		ErrorCount:        0,
		DiskHealthStatus:  diskHealth,
		DiskTemperatureC:  diskTemp,
		Timestamp:         now,
		GatewayReachable:  gatewayReachable,
		DNSWorking:        dnsWorking,
		InternetReachable: internetReachable,
		DefaultGateway:    wifiInfo.Gateway,
	}
}

func CollectLocation() LocationData {
	lat, lng, acc, src := getLocation()
	return LocationData{
		Latitude:       lat,
		Longitude:      lng,
		AccuracyMeters: acc,
		Source:         src,
		Timestamp:      time.Now().UTC().Format(time.RFC3339),
	}
}

func CollectNetwork() NetworkInfoData {
	wifiInfo := GetWiFiInfo()
	ipList := getLocalIPs()

	wifiIP := wifiInfo.IP
	if wifiIP == "" && len(ipList) > 0 {
		wifiIP = ipList[0]
	}

	return NetworkInfoData{
		WiFiSSID:         wifiInfo.SSID,
		WiFiSignalDBM:    wifiInfo.SignalDBM,
		NetworkSpeedMbps: wifiInfo.LinkSpeed,
		WiFiIP:           wifiIP,
		GatewayIP:        wifiInfo.Gateway,
		IPAddresses:      ipList,
	}
}

// ──── Location: use Windows Location API (OS-level) ────

func getLocation() (float64, float64, int, string) {
	if runtime.GOOS == "windows" {
		return getLocationWindowsAccurate()
	}
	return getLocationWindows()  // fallback to geoip for Linux
}

// getLocationWindowsAccurate uses Windows.Devices.Geolocation (Wi‑Fi triangulation)
func getLocationWindowsAccurate() (float64, float64, int, string) {
	script := `
Add-Type -AssemblyName System.Device
$watcher = New-Object System.Device.Location.GeoCoordinateWatcher
$watcher.TryStart($false, [System.TimeSpan]::FromSeconds(5))
$coord = $watcher.Position.Location
if ($coord.IsUnknown) {
    Write-Output "0,0,0,os_failed"
} else {
    Write-Output "$($coord.Latitude),$($coord.Longitude),$([Math]::Round($coord.HorizontalAccuracy)),os"
}
`
	cmd := exec.Command("powershell", "-NoProfile", "-Command", script)
	out, err := cmd.Output()
	if err != nil {
		// fallback to geoip
		return getLocationWindows()
	}

	parts := strings.Split(strings.TrimSpace(string(out)), ",")
	if len(parts) != 4 {
		return 0, 0, 99999, "os_failed"
	}
	lat, _ := strconv.ParseFloat(parts[0], 64)
	lng, _ := strconv.ParseFloat(parts[1], 64)
	acc, _ := strconv.Atoi(parts[2])
	src := parts[3]
	if lat == 0 && lng == 0 {
		return getLocationWindows() // fallback
	}
	return lat, lng, acc, src
}

// old geoip fallback
func getLocationWindows() (float64, float64, int, string) {
	type geoResp struct {
		Lat float64 `json:"lat"`
		Lon float64 `json:"lon"`
	}

	resp, err := httpGet("https://ipapi.co/json/", 5*time.Second)
	if err != nil {
		return 0, 0, 99999, "geoip_failed"
	}

	var geo geoResp
	if err := json.Unmarshal([]byte(resp), &geo); err != nil {
		return 0, 0, 99999, "geoip_failed"
	}

	return geo.Lat, geo.Lon, 5000, "geoip"
}

// ... (rest of helpers unchanged)
func detectOS() (string, string) {
	switch runtime.GOOS {
	case "windows":
		return detectWindowsVersion()
	case "linux":
		return detectLinuxVersion()
	default:
		return runtime.GOOS, ""
	}
}

func detectWindowsVersion() (string, string) {
	cmd := exec.Command("cmd", "/C", "ver")
	out, err := cmd.Output()
	if err != nil {
		return "Windows", ""
	}
	ver := strings.TrimSpace(string(out))
	idx := strings.Index(ver, "Version")
	if idx >= 0 {
		verPart := strings.TrimSpace(ver[idx+len("Version"):])
		verPart = strings.TrimRight(verPart, "]")
		return "Windows", strings.TrimSpace(verPart)
	}
	return "Windows", ver
}

func detectLinuxVersion() (string, string) {
	data, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return "Linux", ""
	}
	name := "Linux"
	version := ""
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "PRETTY_NAME=") {
			v := strings.Trim(line[len("PRETTY_NAME="):], `"`)
			if strings.Contains(strings.ToLower(v), "ubuntu") {
				name = "Ubuntu"
			} else if strings.Contains(strings.ToLower(v), "lubuntu") {
				name = "Lubuntu"
			} else if strings.Contains(strings.ToLower(v), "debian") {
				name = "Debian"
			}
			version = v
		}
	}
	return name, version
}

func detectCPU() (string, int) {
	cmd := exec.Command("wmic", "cpu", "get", "Name,NumberOfCores", "/format:value")
	out, err := cmd.Output()
	if err != nil {
		return "unknown", 0
	}
	model := "unknown"
	cores := 0
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "Name=") {
			model = strings.TrimPrefix(line, "Name=")
		}
		if strings.HasPrefix(line, "NumberOfCores=") {
			if v, err := strconv.Atoi(strings.TrimPrefix(line, "NumberOfCores=")); err == nil {
				cores = v
			}
		}
	}
	return model, cores
}

func getTotalRAM() uint64 {
	cmd := exec.Command("wmic", "computersystem", "get", "TotalPhysicalMemory", "/format:value")
	out, err := cmd.Output()
	if err != nil {
		return 0
	}
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "TotalPhysicalMemory=") {
			if v, err := strconv.ParseUint(strings.TrimPrefix(line, "TotalPhysicalMemory="), 10, 64); err == nil {
				return v
			}
		}
	}
	return 0
}

func getUsedRAM() uint64 {
	cmd := exec.Command("wmic", "OS", "get", "FreePhysicalMemory", "/format:value")
	out, err := cmd.Output()
	if err != nil {
		return 0
	}
	total := getTotalRAM()
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "FreePhysicalMemory=") {
			if v, err := strconv.ParseUint(strings.TrimPrefix(line, "FreePhysicalMemory="), 10, 64); err == nil {
				return total - (v * 1024)
			}
		}
	}
	return 0
}

func getCPUUsage() float64 {
	cmd := exec.Command("wmic", "cpu", "get", "LoadPercentage", "/format:value")
	out, err := cmd.Output()
	if err != nil {
		return 0
	}
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "LoadPercentage=") {
			if v, err := strconv.ParseFloat(strings.TrimPrefix(line, "LoadPercentage="), 64); err == nil {
				return v
			}
		}
	}
	return 0
}

func getUptime() uint64 {
	cmd := exec.Command("wmic", "os", "get", "LastBootUpTime", "/format:value")
	out, err := cmd.Output()
	if err != nil {
		return 0
	}
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "LastBootUpTime=") {
			bootStr := strings.TrimPrefix(line, "LastBootUpTime=")
			if len(bootStr) >= 14 {
				y, _ := strconv.Atoi(bootStr[0:4])
				m, _ := strconv.Atoi(bootStr[4:6])
				d, _ := strconv.Atoi(bootStr[6:8])
				h, _ := strconv.Atoi(bootStr[8:10])
				min, _ := strconv.Atoi(bootStr[10:12])
				s, _ := strconv.Atoi(bootStr[12:14])
				bootTime := time.Date(y, time.Month(m), d, h, min, s, 0, time.Local)
				return uint64(time.Since(bootTime).Seconds())
			}
		}
	}
	return 0
}

func getLocalIPs() []string {
	var ips []string
	seen := map[string]bool{}
	interfaces, err := net.Interfaces()
	if err != nil {
		return ips
	}
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			if ipNet, ok := addr.(*net.IPNet); ok {
				ip4 := ipNet.IP.To4()
				if ip4 != nil && !ip4.IsLoopback() && !ip4.IsLinkLocalUnicast() {
					ipStr := ip4.String()
					if !seen[ipStr] {
						ips = append(ips, ipStr)
						seen[ipStr] = true
					}
				}
			}
		}
	}
	return ips
}

func ping8x8() int {
	cmd := exec.Command("ping", "-n", "1", "-w", "2000", "8.8.8.8")
	out, err := cmd.Output()
	if err != nil {
		return -1
	}
	output := string(out)
	if idx := strings.LastIndex(output, "time="); idx >= 0 {
		rest := output[idx+len("time="):]
		if end := strings.IndexAny(rest, "ms \n"); end > 0 {
			msStr := rest[:end]
			if msStr == "<1" {
				return 1
			}
			if v, err := strconv.Atoi(msStr); err == nil {
				return v
			}
		}
	}
	return -1
}

func getDiskHealth() (string, int) {
	if runtime.GOOS != "windows" {
		return "unknown", 0
	}
	cmd := exec.Command("wmic", "diskdrive", "get", "Status", "/format:value")
	out, err := cmd.Output()
	if err != nil {
		return "unknown", 0
	}
	status := "unknown"
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "Status=") {
			s := strings.TrimPrefix(line, "Status=")
			switch strings.ToLower(s) {
			case "ok":
				status = "ok"
			case "pred fail":
				status = "warning"
			default:
				status = "unknown"
			}
		}
	}

	temp := getDiskTemperature()
	return status, temp
}

func getDiskTemperature() int {
	cmd := exec.Command("powershell", "-NoProfile", "-Command",
		`Get-PhysicalDisk | Where-Object {$_.OperationalStatus -eq 'OK'} | Select-Object -First 1 | ForEach-Object { 
			$temp = Get-CimInstance -Namespace root/wmi -ClassName MSStorageDriver_ATAPISmartData | Where-Object {$_.InstanceName -like "*PHYSICALDRIVE*"} | Select-Object -ExpandProperty Temperature
			if ($temp) { $temp } else { "0" }
		}`)
	out, err := cmd.Output()
	if err == nil {
		tempStr := strings.TrimSpace(string(out))
		if v, err := strconv.Atoi(tempStr); err == nil && v > 0 {
			return v
		}
	}

	return 0
}

func isGatewayReachable(gateway string) bool {
	if gateway == "" {
		return false
	}
	cmd := exec.Command("ping", "-n", "1", "-w", "1000", gateway)
	err := cmd.Run()
	return err == nil
}

func isDNWorking() bool {
	_, err := net.LookupHost("google.com")
	return err == nil
}

func isInternetReachable() bool {
	cmd := exec.Command("ping", "-n", "1", "-w", "2000", "8.8.8.8")
	err := cmd.Run()
	return err == nil
}

func httpGet(url string, timeout time.Duration) (string, error) {
	client := &http.Client{Timeout: timeout}
	resp, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}