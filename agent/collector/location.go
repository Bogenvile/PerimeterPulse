package collector

import (
	"time"
)

type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Source    string  `json:"source"`
	Timestamp string  `json:"timestamp"`
}

// CollectLocation returns a LocationData by converting from the basic Location
func CollectLocation() LocationData {
	loc := GetLocation()
	return LocationData{
		Latitude:       loc.Latitude,
		Longitude:      loc.Longitude,
		AccuracyMeters: 5000, // default accuracy
		Source:         loc.Source,
		Timestamp:      loc.Timestamp,
	}
}

// GetLocation returns placeholder location
func GetLocation() Location {
	return Location{
		Latitude:  -6.2088,
		Longitude: 106.8456,
		Source:    "geoip",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}