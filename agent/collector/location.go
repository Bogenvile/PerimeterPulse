package collector

import (
	"log"
)

// LocationData holds coordinates, accuracy, source, and error info.
type LocationData struct {
	Latitude      float64 `json:"latitude"`
	Longitude     float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source        string   `json:"source"` // "os", "geoip", "unknown"
}

// CollectLocation returns the current location of this machine.
// It tries OS-provided location first (Windows Geolocator / GeoClue),
// then falls back to GeoIP.
func CollectLocation() LocationData {
	loc := collectPlatformLocation()
	if loc.Source == "unknown" || loc.Source == "geoip" {
		// Optional: try GeoIP as fallback
		lat, lng, err := GetGeoIPLocation()
		if err == nil {
			loc.Latitude = lat
			loc.Longitude = lng
			loc.AccuracyMeters = 5000 // GeoIP ~5 km
			loc.Source = "geoip"
		} else {
			log.Printf("GeoIP fallback failed: %v", err)
		}
	}
	// Default to some fallback location if still unknown
	return loc
}

// GetGeoIPLocation performs a GeoIP lookup to determine the approximate location.
func GetGeoIPLocation() (float64, float64, error) {
	// Stub: in production, call a GeoIP API (e.g., ip-api.com, ipinfo.io)
	// Returning a default (0,0) and no error means "no location available"
	return 0.0, 0.0, nil
}