package collector

import (
	"encoding/json"
	"math"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/mem"
	gonet "github.com/shirou/gopsutil/v4/net"
)

// RegistrationPayload - Data saat agent pertama kali register
type RegistrationPayload struct {
	Hostname          string   `json:"hostname"`
	OS                string   `json:"os"`
	OSVersion         string   `json:"os_version"`
	AgentVersion      string   `json:"agent_version"`
	APIKey            string   `json:"api_key"`
	MACAddresses      []string `json:"mac_addresses"`
	IPAddresses       []string `json:"ip_addresses,omitempty"`
	CPUModel          string   `json:"cpu_model"`
	CPUCores          int      `json:"cpu_cores,omitempty"`
	RAMTotalBytes     uint64   `json:"ram_total_bytes"`
	StorageTotalBytes uint64   `json:"storage_total_bytes"`
	DiskModel         string   `json:"disk_model,omitempty"`
	DiskType          string   `json:"disk_type,omitempty"`
	WiFiSSID          string   `json:"wifi_ssid,omitempty"`
	WiFiSignalDBM     int      `json:"wifi_signal_dbm,omitempty"`
	NetworkSpeedMbps  int      `json:"network_speed_mbps,omitempty"`
}

// MetricsData - Data metrics untuk heartbeat
type MetricsData struct {
	CPUPercent        float64 `json:"cpu_percent"`
	RAMPercent        float64 `json:"ram_percent"`
	RAMUsedBytes      uint64  `json:"ram_used_bytes"`
	RAMTotalBytes     uint64  `json:"ram_total_bytes"`
	StoragePercent    float64 `json:"storage_percent"`
	StorageUsedBytes  uint64  `json:"storage_used_bytes"`
	StorageTotalBytes uint64  `json:"storage_total_bytes"`
	UptimeSeconds     float64 `json:"uptime_seconds"`
	NetworkStatus     string  `json:"network_status"`
	NetworkLatencyMs  float64 `json:"network_latency_ms"`
	PingLatencyMs     float64 `json:"ping_latency_ms,omitempty"`
	ErrorCount        int     `json:"error_count,omitempty"`
	GatewayReachable  bool    `json:"gateway_reachable,omitempty"`
	DNSWorking        bool    `json:"dns_working,omitempty"`
	InternetReachable bool    `json:"internet_reachable,omitempty"`
	DefaultGateway    string  `json:"default_gateway,omitempty"`
	DiskHealthStatus  string  `json:"disk_health_status,omitempty"`
	DiskTemperatureC  float64 `json:"disk_temperature_c,omitempty"`
	Timestamp         string  `json:"timestamp"`
}

// LocationData - Data lokasi
type LocationData struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	Timestamp      string  `json:"timestamp"`
	City           string  `json:"city,omitempty"`
	Country        string  `json:"country,omitempty"`
}

// NetworkInfo - Data network untuk heartbeat
type NetworkInfo struct {
	WiFiSSID         string   `json:"wifi_ssid"`
	WiFiSignalDBM    int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps int      `json:"network_speed_mbps"`
	IPAddresses      []string `json:"ip_addresses"`
	WiFiIP           string   `json:"wifi_ip,omitempty"`
	GatewayIP        string   `json:"gateway_ip,omitempty"`
}

// CollectInfo mengumpulkan informasi sistem untuk registrasi
func CollectInfo(apiKey string) RegistrationPayload {
	info := RegistrationPayload{APIKey: apiKey, AgentVersion: "1.2.0"}

	// Hostname
	h, _ := os.Hostname()
	info.Hostname = h

	// OS Info
	if runtime.GOOS == "windows" {
		info.OS = "Windows"
		out, _ := exec.Command("cmd", "/c", "ver").Output()
		info.OSVersion = strings.TrimSpace(string(out))
	} else {
		info.OS = runtime.GOOS
		out, _ := exec.Command("uname", "-r").Output()
		info.OSVersion = strings.TrimSpace(string(out))
	}

	// CPU Info
	cpuInfo, _ := cpu.Info()
	if len(cpuInfo) > 0 {
		info.CPUModel = cpuInfo[0].ModelName
		info.CPUCores = int(cpuInfo[0].Cores)
	}

	// RAM Info
	memInfo, _ := mem.VirtualMemory()
	info.RAMTotalBytes = memInfo.Total

	// Storage Info
	partitions, _ := disk.Partitions(false)
	for _, p := range partitions {
		usage, err := disk.Usage(p.Mountpoint)
		if err == nil && usage.Total > info.StorageTotalBytes {
			info.StorageTotalBytes = usage.Total
			info.DiskModel = p.Device
			fs := strings.ToLower(p.Fstype)
			if strings.Contains(fs, "ntfs") || strings.Contains(fs, "ext4") || strings.Contains(fs, "apfs") {
				info.DiskType = "HDD"
			} else {
				info.DiskType = "SSD"
			}
		}
	}

	// MAC & IP Addresses
	ifaces, _ := net.Interfaces()
	for _, iface := range ifaces {
		if iface.Name == "lo" || strings.HasPrefix(iface.Name, "Loopback") || (iface.Flags&net.FlagLoopback != 0) {
			continue
		}
		info.MACAddresses = append(info.MACAddresses, iface.HardwareAddr.String())
		
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
				if ipnet.IP.To4() != nil {
					info.IPAddresses = append(info.IPAddresses, ipnet.IP.String())
				}
			}
		}
	}

	// WiFi Info (Windows)
	if runtime.GOOS == "windows" {
		out, _ := exec.Command("netsh", "wlan", "show", "interfaces").Output()
		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			if strings.Contains(line, "SSID") && !strings.Contains(line, "BSSID") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					info.WiFiSSID = strings.TrimSpace(parts[1])
				}
			}
			if strings.Contains(line, "Signal") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					signal := strings.TrimSpace(parts[1])
					signal = strings.TrimSuffix(signal, "%")
					if sig, err := strconv.Atoi(signal); err == nil {
						info.WiFiSignalDBM = -100 + sig
					}
				}
			}
		}
	}

	return info
}

// CollectMetrics mengumpulkan metrics untuk heartbeat
func CollectMetrics() MetricsData {
	metrics := MetricsData{Timestamp: time.Now().UTC().Format(time.RFC3339)}

	// CPU
	cpuPercent, _ := cpu.Percent(0, false)
	if len(cpuPercent) > 0 {
		metrics.CPUPercent = cpuPercent[0]
	}

	// RAM
	memInfo, _ := mem.VirtualMemory()
	metrics.RAMPercent = memInfo.UsedPercent
	metrics.RAMUsedBytes = memInfo.Used
	metrics.RAMTotalBytes = memInfo.Total

	// Storage
	partitions, _ := disk.Partitions(false)
	maxUsage := 0.0
	for _, p := range partitions {
		usage, err := disk.Usage(p.Mountpoint)
		if err == nil {
			metrics.StorageUsedBytes += usage.Used
			metrics.StorageTotalBytes += usage.Total
			if usage.UsedPercent > maxUsage {
				maxUsage = usage.UsedPercent
			}
		}
	}
	metrics.StoragePercent = maxUsage

	// Uptime
	bootTime, _ := host.BootTime()
	metrics.UptimeSeconds = float64(time.Now().Unix()) - float64(bootTime)

	// Network Diagnostics
	metrics.NetworkStatus = checkNetwork(&metrics)

	// SMART Disk Health
	checkSMART(&metrics)

	return metrics
}

// CollectLocation mengumpulkan data lokasi
func CollectLocation() LocationData {
	loc := LocationData{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Source:    "geoip",
	}

	// Try GeoIP first (always works)
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("http://ip-api.com/json")
	if err == nil {
		defer resp.Body.Close()
		var geoResp struct {
			Lat     float64 `json:"lat"`
			Lon     float64 `json:"lon"`
			City    string  `json:"city"`
			Country string  `json:"country"`
			Status  string  `json:"status"`
		}
		if json.NewDecoder(resp.Body).Decode(&geoResp) == nil && geoResp.Status == "success" {
			loc.Latitude = geoResp.Lat
			loc.Longitude = geoResp.Lon
			loc.City = geoResp.City
			loc.Country = geoResp.Country
			loc.AccuracyMeters = 50000 // GeoIP accuracy is ~50km
			return loc
		}
	}

	// Fallback: Google DNS location (8.8.8.8)
	loc.Latitude = 37.4056
	loc.Longitude = -122.0775
	loc.AccuracyMeters = 100000
	return loc
}

// CollectNetwork mengumpulkan informasi network
func CollectNetwork() NetworkInfo {
	netInfo := NetworkInfo{}

	// IP Addresses
	ifaces, _ := net.Interfaces()
	for _, iface := range ifaces {
		if iface.Name == "lo" || strings.HasPrefix(iface.Name, "Loopback") || (iface.Flags&net.FlagLoopback != 0) {
			continue
		}
		addrs, _ := iface.Addrs()
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
				if ipnet.IP.To4() != nil {
					netInfo.IPAddresses = append(netInfo.IPAddresses, ipnet.IP.String())
				}
			}
		}
	}

	// WiFi Info (Windows)
	if runtime.GOOS == "windows" {
		out, _ := exec.Command("netsh", "wlan", "show", "interfaces").Output()
		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			if strings.Contains(line, "SSID") && !strings.Contains(line, "BSSID") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					netInfo.WiFiSSID = strings.TrimSpace(parts[1])
				}
			}
			if strings.Contains(line, "Signal") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					signal := strings.TrimSpace(parts[1])
					signal = strings.TrimSuffix(signal, "%")
					if sig, err := strconv.Atoi(signal); err == nil {
						netInfo.WiFiSignalDBM = -100 + sig
					}
				}
			}
		}
	}

	// Network Speed (approximate)
	ioCounters, _ := gonet.IOCounters(true)
	for _, counter := range ioCounters {
		if counter.BytesSent > 0 || counter.BytesRecv > 0 {
			totalBytes := counter.BytesSent + counter.BytesRecv
			speedMbps := float64(totalBytes) * 8 / 1000000 / 60 // per minute average
			netInfo.NetworkSpeedMbps = int(speedMbps)
			break
		}
	}

	return netInfo
}

// checkNetwork melakukan network diagnostics
func checkNetwork(metrics *MetricsData) string {
	// Check default gateway
	gateway := getDefaultGateway()
	metrics.DefaultGateway = gateway

	if gateway == "" {
		metrics.NetworkStatus = "down"
		return "down"
	}

	// Ping gateway
	gwReachable := pingHost(gateway, 1000)
	metrics.GatewayReachable = gwReachable

	if !gwReachable {
		metrics.NetworkStatus = "limited"
		return "limited"
	}

	// Check DNS
	dnsWorking := checkDNS()
	metrics.DNSWorking = dnsWorking

	// Check internet (ping 8.8.8.8)
	internetReachable := pingHost("8.8.8.8", 2000)
	metrics.InternetReachable = internetReachable

	// Measure latency
	latency := measureLatency("8.8.8.8", 3)
	metrics.PingLatencyMs = latency

	if internetReachable {
		metrics.NetworkStatus = "up"
		metrics.NetworkLatencyMs = latency
		return "up"
	}

	if dnsWorking {
		metrics.NetworkStatus = "degraded"
		metrics.NetworkLatencyMs = latency
		return "degraded"
	}

	metrics.NetworkStatus = "limited"
	return "limited"
}

func getDefaultGateway() string {
	if runtime.GOOS == "windows" {
		out, _ := exec.Command("ipconfig").Output()
		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			if strings.Contains(strings.ToLower(line), "default gateway") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					gw := strings.TrimSpace(parts[1])
					if gw != "" && gw != "0.0.0.0" {
						return gw
					}
				}
			}
		}
	} else {
		out, _ := exec.Command("ip", "route", "show", "default").Output()
		parts := strings.Fields(string(out))
		if len(parts) >= 3 {
			return parts[2]
		}
	}
	return ""
}

func pingHost(host string, timeoutMs int) bool {
	if runtime.GOOS == "windows" {
		out, err := exec.Command("ping", "-n", "1", "-w", strconv.Itoa(timeoutMs), host).Output()
		return err == nil && strings.Contains(string(out), "Reply from")
	}
	out, err := exec.Command("ping", "-c", "1", "-W", strconv.Itoa(timeoutMs/1000), host).Output()
	return err == nil && strings.Contains(string(out), "1 received")
}

func checkDNS() bool {
	_, err := net.LookupHost("google.com")
	return err == nil
}

func measureLatency(host string, attempts int) float64 {
	var total float64
	count := 0

	for i := 0; i < attempts; i++ {
		start := time.Now()
		if pingHost(host, 1000) {
			total += float64(time.Since(start).Milliseconds())
			count++
		}
		time.Sleep(200 * time.Millisecond)
	}

	if count == 0 {
		return 0
	}
	return math.Round(total/float64(count)*10) / 10
}

// checkSMART melakukan SMART check untuk disk health
func checkSMART(metrics *MetricsData) {
	metrics.DiskHealthStatus = "unknown"

	if runtime.GOOS == "windows" {
		// Windows: Use wmic diskdrive get status
		out, err := exec.Command("wmic", "diskdrive", "get", "status").Output()
		if err == nil {
			lines := strings.Split(string(out), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "Status" || line == "" {
					continue
				}
				if strings.Contains(strings.ToLower(line), "ok") {
					metrics.DiskHealthStatus = "ok"
				} else if strings.Contains(strings.ToLower(line), "pred fail") || strings.Contains(strings.ToLower(line), "bad") {
					metrics.DiskHealthStatus = "critical"
				} else {
					metrics.DiskHealthStatus = "warning"
				}
			}
		}

		// Temperature via WMI (if available)
		tempOut, _ := exec.Command("wmic", "msstorage_temperature", "get", "CurrentTemperature").Output()
		if len(tempOut) > 0 {
			lines := strings.Split(string(tempOut), "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line == "CurrentTemperature" || line == "" {
					continue
				}
				if temp, err := strconv.ParseFloat(line, 64); err == nil {
					// WMI temperature is in Kelvin, convert to Celsius
					metrics.DiskTemperatureC = temp - 273.15
				}
			}
		}
	} else {
		// Linux: Use smartmontools
		smartCheckDisk("/dev/sda", metrics)
		if metrics.DiskHealthStatus == "unknown" {
			smartCheckDisk("/dev/nvme0n1", metrics)
		}
	}
}

func smartCheckDisk(device string, metrics *MetricsData) {
	// Check SMART overall health
	out, err := exec.Command("smartctl", "-H", device).Output()
	if err != nil {
		return
	}

	output := strings.ToLower(string(out))
	if strings.Contains(output, "passed") || strings.Contains(output, "ok") {
		metrics.DiskHealthStatus = "ok"
	} else if strings.Contains(output, "failed") || strings.Contains(output, "critical") {
		metrics.DiskHealthStatus = "critical"
	} else {
		metrics.DiskHealthStatus = "warning"
	}

	// Get temperature
	tempOut, _ := exec.Command("smartctl", "-A", device).Output()
	tempOutput := string(tempOut)
	lines := strings.Split(tempOutput, "\n")
	for _, line := range lines {
		if strings.Contains(strings.ToLower(line), "temperature") || strings.Contains(strings.ToLower(line), "temp") {
			fields := strings.Fields(line)
			for _, field := range fields {
				if temp, err := strconv.ParseFloat(field, 64); err == nil && temp > 0 && temp < 100 {
					metrics.DiskTemperatureC = temp
					break
				}
			}
		}
	}
}