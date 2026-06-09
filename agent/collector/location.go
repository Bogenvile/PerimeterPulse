package collector

import (
	"log"
	"math/rand"
)

func CollectLocation() *Location {
	// Placeholder: in production, get GPS or GeoIP
	// On Windows, use Windows.Devices.Geolocation API
	// On Linux, use GeoClue2 D-Bus
	loc := &Location{
		Latitude:       0,
		Longitude:      0,
		AccuracyMeters: 1000,
		Source:         "geoip",
	}
	log.Println("Location collection not fully implemented, using defaults")
	return loc
}

// Example stub for GeoIP fallback
func geoIPLocation() *Location {
	// Would call an external service or parse IP geolocation
	return &Location{
		Latitude:       rand.Float64()*180 - 90,
		Longitude:      rand.Float64()*360 - 180,
		AccuracyMeters: 5000,
		Source:         "geoip",
	}
}