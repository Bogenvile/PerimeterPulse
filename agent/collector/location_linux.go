package collector

import (
	"log"
)

// collectLinuxLocation attempts to get Linux location via GeoClue or GeoIP fallback
func collectLinuxLocation() LocationData {
	// Placeholder: try GeoClue D-Bus; fallback to GeoIP
	lat, lng, err := getGeoIPLinux()
	if err != nil {
		log.Printf("Linux GeoIP lookup failed: %v", err)
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
	// Stub: in production, use ip-api.com or system GeoIP service
	return 0.0, 0.0, nil
}