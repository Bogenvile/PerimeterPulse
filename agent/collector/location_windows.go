//go:build windows

package collector

import (
	"log"
)

// collectPlatformLocation attempts to get Windows location via WinRT Geolocator.
// Falls back to GeoIP.
func collectPlatformLocation() LocationData {
	// Stub: real implementation would use WinRT/COM API (e.g., via syscall)
	// For now, just return empty and let location.go fallback to GeoIP
	lat, lng, err := getGeoIP()
	if err != nil {
		log.Printf("Windows GeoIP fallback failed: %v", err)
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

func getGeoIP() (float64, float64, error) {
	// Stub: use system or internet GeoIP service
	return 0.0, 0.0, nil
}