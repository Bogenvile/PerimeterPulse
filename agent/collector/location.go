package collector

import (
	"encoding/json"
	"net/http"
	"time"
)

type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Source    string  `json:"source"`
	Timestamp string  `json:"timestamp"`
}

func GetLocation() Location {
	// Fallback ke GeoIP
	return Location{
		Latitude:  -6.2088, // Jakarta
		Longitude: 106.8456,
		Source:    "geoip",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}