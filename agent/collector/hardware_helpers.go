package collector

import "runtime"

func collectHardwareInfo() SystemInfo {
	if runtime.GOOS == "windows" {
		return collectWindowsHardware()
	}
	return collectLinuxHardware()
}

func getWindowsOSVersion() string {
	if runtime.GOOS == "windows" {
		return collectWindowsOSVersion()
	}
	return ""
}

func getLinuxOSVersion() string {
	if runtime.GOOS != "windows" {
		return collectLinuxOSVersion()
	}
	return ""
}