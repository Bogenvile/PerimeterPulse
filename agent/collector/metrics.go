package collector

import "time"

func collectMetrics() MetricsData {
	return MetricsData{
		CPUPercent:       0,
		RAMPercent:       0,
		RAMUsedBytes:     0,
		RAMTotalBytes:    0,
		StoragePercent:   0,
		StorageUsedBytes: 0,
		StorageTotalBytes: 0,
		UptimeSeconds:    0,
		NetworkStatus:    "unknown",
		NetworkLatencyMS: 0,
		DiskHealthStatus: "unknown",
		DiskTemperatureC: 0,
		Timestamp:        time.Now().UTC().Format(time.RFC3339),
	}
}

func collectNetworkInfo() NetworkInfo {
	return NetworkInfo{
		WiFiSSID:         "",
		WiFiSignalDBM:    0,
		NetworkSpeedMbps: 0,
		IPAddresses:      []string{},
	}
}

func collectLocation() *LocationData {
	return nil
}