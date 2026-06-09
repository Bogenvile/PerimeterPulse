//go:build linux

package collector

import (
	"log"
)

// collectPlatformLocation attempts to get Linux location via GeoClue D-Bus.
// Falls back to GeoIP.
func collectPlatformLocation() LocationData {
	// Stub: real implementation would use godbus/dbus to talk to GeoClue2
	// For now, just return empty and let location.go fallback to GeoIP
	lat, lng, err := getGeoIPLinux()
	if err != nil {
		log.Printf("Linux GeoIP fallback failed: %v", err)
		return LocationData{
			Latitude:  0.0,
			Longitude: 0.0,
			Source:    "unknown",
		}
	}
	return LocationData{
		Latitude:      lat,
		Longitude:     lng,
		AccuracyMeters: 5000,
		Source:        "geoip",
	}
}

func getGeoIPLinux() (float64, float64, error) {
	// Stub: use internet GeoIP service
	return 0.0, 0.0, nil
}