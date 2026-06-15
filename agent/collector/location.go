package collector

// LocationData holds the agent's geographic coordinates
type LocationData struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	City           string  `json:"city"`
	Country        string  `json:"country"`
	Timestamp      string  `json:"timestamp"`
}

// GetLocation retrieves the current location (platform specific)
func GetLocation() LocationData {
	return getPlatformLocation()
}