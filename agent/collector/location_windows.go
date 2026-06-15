//go:build windows

package collector

import (
	"fmt"
	"os/exec"
	"strings"
)

// getPlatformLocation attempts to get location from Windows Location API via PowerShell
func getPlatformLocation() LocationData {
	// Try using Windows.Devices.Geolocation via PowerShell
	cmd := exec.Command("powershell", "-Command", `
		Add-Type -AssemblyName System.Device
		$geo = New-Object System.Device.Location.GeoCoordinateWatcher
		$geo.Start()
		$timeout = 0
		while ($geo.Status -ne 'Ready' -and $timeout -lt 5000) {
			Start-Sleep -Milliseconds 100
			$timeout += 100
		}
		if ($geo.Status -eq 'Ready') {
			$pos = $geo.Position.Location
			Write-Output "$($pos.Latitude) $($pos.Longitude)"
		} else {
			Write-Output ""
		}
	`)
	out, err := cmd.Output()
	if err != nil {
		return LocationData{Source: "none"}
	}

	output := strings.TrimSpace(string(out))
	if output == "" {
		return LocationData{Source: "none"}
	}

	var lat, lng float64
	_, scanErr := fmt.Sscanf(output, "%f %f", &lat, &lng)
	if scanErr != nil {
		return LocationData{Source: "none"}
	}

	return LocationData{
		Latitude:       lat,
		Longitude:      lng,
		AccuracyMeters: 10, // approximate
		Source:         "os",
	}
}