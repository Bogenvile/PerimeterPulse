package collector

import (
	"os"
	"runtime"
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
	return &Info{
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
		UptimeSeconds:    int64(time.Now().Unix()),
		NetworkStatus:    "up",
		NetworkLatencyMs: 5.0,
		DiskHealthStatus: "ok",
		DiskTemperatureC: 35.0,
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
	return &NetworkInfo{
		WiFiSSID:         "",
		WiFiSignalDBM:    0,
		NetworkSpeedMbps: 0,
		IPAddresses:      []string{},
	}
}
