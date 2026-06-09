package collector

import (
	"time"
)

type Metrics struct {
	CPUPercent       float64
	RAMPercent       float64
	MemoryUsed       int64   // used instead of RAMUsedBytes
	MemoryTotal      int64   // used instead of RAMTotalBytes
	StoragePercent   float64
	DiskUsed         int64   // used instead of StorageUsedBytes
	DiskTotal        int64   // used instead of StorageTotalBytes
	UptimeSeconds    int64
	NetworkStatus    string
	NetworkLatencyMs float64
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

func CollectMetrics() *Metrics {
	// placeholder — implement actual collection
	return &Metrics{
		CPUPercent:       0,
		RAMPercent:       0,
		MemoryUsed:       0,
		MemoryTotal:      0,
		StoragePercent:   0,
		DiskUsed:         0,
		DiskTotal:        0,
		UptimeSeconds:    int64(time.Now().Sub(startTime).Seconds()),
		NetworkStatus:    "unknown",
		NetworkLatencyMs: 0,
	}
}

func CollectLocation() *Location {
	// placeholder — implement geo location
	return &Location{
		Latitude:       0,
		Longitude:      0,
		AccuracyMeters: 0,
		Source:         "geoip",
	}
}

func CollectNetworkInfo() *NetworkInfo {
	// placeholder — implement network info
	return &NetworkInfo{
		WiFiSSID:        "",
		WiFiSignalDBM:   0,
		NetworkSpeedMbps: 0,
		IPAddresses:     []string{},
	}
}

func CollectInfo() *Info {
	// placeholder — implement system info
	return &Info{
		Hostname:          "localhost",
		OS:                "unknown",
		OSVersion:         "",
		AgentVersion:      "1.0.0",
		AgentID:           "agent-00000000",
		MACAddresses:      []string{},
		IPAddresses:       []string{},
		CPUModel:          "",
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

var startTime time.Time

func init() {
	startTime = time.Now()
}