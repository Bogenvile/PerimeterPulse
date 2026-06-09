package collector

import (
	"log"
	"os"
)

// collectWindowsLocation attempts to get Windows location via GeoIP fallback
func collectWindowsLocation() LocationData {
	// Placeholder: try GeoIP as fallback; real implementation would use WinRT Geolocator
	lat, lng, err := getGeoIP()
	if err != nil {
		log.Printf("Windows GeoIP lookup failed: %v", err)
		return LocationData{
			Latitude:  0.0,
			Longitude: 0.0,
			Source:    "unknown",
		}
	}

	return LocationData{
		Latitude:      lat,
		Longitude:     lng,
		AccuracyMeters: 5000, // GeoIP accuracy ~5km
		Source:        "geoip",
	}
}

func getGeoIP() (float64, float64, error) {
	// Stub: in production, fetch from ip-api.com or similar
	// Return default location
	return 0.0, 0.0, nil
}