//go:build !linux

package collector

func collectLinuxHardware() SystemInfo {
	return SystemInfo{
		Hostname:         "unknown",
	}
}

func collectLinuxOSVersion() string {
	return ""
}