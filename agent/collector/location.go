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

func GetLocation() Location {
	// Placeholder location (Jakarta) until GeoIP is fully implemented
	return Location{
		Latitude:  -6.2088,
		Longitude: 106.8456,
		Source:    "geoip",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}