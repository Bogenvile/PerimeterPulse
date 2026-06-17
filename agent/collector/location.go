package collector

// LocationData holds geographical location information
type LocationData struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	City           string  `json:"city,omitempty"`
	Country        string  `json:"country,omitempty"`
	Timestamp      string  `json:"timestamp"`
}

// GetLocation gets the current location (platform-specific)
func GetLocation() (LocationData, error) {
	return getPlatformLocation()
}