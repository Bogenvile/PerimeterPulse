package collector

import "fmt"

// LocationData holds location information
type LocationData struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Source    string  `json:"source"`
	City      string  `json:"city"`
	Country   string  `json:"country"`
	Accuracy  float64 `json:"accuracy_meters"`
	Timestamp string  `json:"timestamp"`
}

// getPlatformLocation is set by platform-specific init()
var getPlatformLocation func() (LocationData, error)

// GetLocation gets platform-specific location
func GetLocation() (LocationData, error) {
	if getPlatformLocation != nil {
		return getPlatformLocation()
	}
	return LocationData{Source: "unavailable"}, fmt.Errorf("platform location not available")
}