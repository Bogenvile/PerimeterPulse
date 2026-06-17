package collector

import (
	"time"
)

// LocationData represents a GPS/WiFi location snapshot.
type LocationData struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	City           string  `json:"city"`
	Country        string  `json:"country"`
	Timestamp      string  `json:"timestamp"`
}

// getPlatformLocation is assigned by the platform-specific file (e.g. location_windows.go).
var getPlatformLocation func() (LocationData, error)

// GetLocation obtains the current location using platform-specific methods.
func GetLocation() (LocationData, error) {
	return getPlatformLocation()
}