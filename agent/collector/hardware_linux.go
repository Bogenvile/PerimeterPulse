package collector

import "os"

func collectLinuxHardware() SystemInfo {
	hostname, _ := os.Hostname()
	return SystemInfo{
		Hostname:         hostname,
		MACAddresses:     []string{},
		IPAddresses:      []string{},
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
}

func collectLinuxOSVersion() string {
	return ""
}