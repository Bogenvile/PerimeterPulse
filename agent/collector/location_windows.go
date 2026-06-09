package collector

import (
	"fmt"
	"log"
	"os/exec"
	"strings"
)

func CollectWindowsLocation() *Location {
	// Attempt to get location using PowerShell Windows.Devices.Geolocation API
	loc := &Location{
		Latitude:       0,
		Longitude:      0,
		AccuracyMeters: 1000,
		Source:         "geoip",
	}

	// Try using the Windows Geolocator via PowerShell
	cmd := exec.Command("powershell", "-Command",
		`Add-Type -AssemblyName System.Device; $watcher = New-Object System.Device.Location.GeoCoordinateWatcher; $watcher.Start(); Start-Sleep -Seconds 2; $loc = $watcher.Position.Location; if ($loc.IsUnknown) { $null } else { Write-Output "$($loc.Latitude),$($loc.Longitude),$($loc.HorizontalAccuracy)" }`,
	)
	out, err := cmd.Output()
	if err == nil {
		parts := strings.Split(strings.TrimSpace(string(out)), ",")
		if len(parts) == 3 {
			var lat, lng, acc float64
			fmt.Sscanf(parts[0], "%f", &lat)
			fmt.Sscanf(parts[1], "%f", &lng)
			fmt.Sscanf(parts[2], "%f", &acc)
			loc.Latitude = lat
			loc.Longitude = lng
			loc.AccuracyMeters = acc
			loc.Source = "os"
		}
	} else {
		log.Printf("Windows Geolocation failed: %v (falling back to GeoIP)", err)
	}

	return loc
}