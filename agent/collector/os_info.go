package collector

import (
	"fmt"
	"runtime"

	"golang.org/x/sys/windows/registry"
)

// GetOSInfo returns the OS name and version.
func GetOSInfo() (string, string) {
	if runtime.GOOS != "windows" {
		return runtime.GOOS, "unknown"
	}

	name := "Windows"
	version := "0.0"

	// Try to read from registry: CurrentVersion
	k, err := registry.OpenKey(
		registry.LOCAL_MACHINE,
		`SOFTWARE\Microsoft\Windows NT\CurrentVersion`,
		registry.QUERY_VALUE,
	)
	if err == nil {
		defer k.Close()

		if productName, _, err := k.GetStringValue("ProductName"); err == nil {
			name = productName
		}
		if displayVersion, _, err := k.GetStringValue("DisplayVersion"); err == nil {
			version = displayVersion
		} else if releaseID, _, err := k.GetStringValue("ReleaseId"); err == nil {
			version = releaseID
		} else if currentBuild, _, err := k.GetStringValue("CurrentBuild"); err == nil {
			// Fallback: build number with major.minor
			major, _, _ := k.GetIntegerValue("CurrentMajorVersionNumber")
			minor, _, _ := k.GetIntegerValue("CurrentMinorVersionNumber")
			if major > 0 {
				version = fmt.Sprintf("%d.%d.%s", major, minor, currentBuild)
			} else {
				version = "10.0." + currentBuild
			}
		}
	}

	return name, version
}