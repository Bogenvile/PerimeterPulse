package collector

import (
	"runtime"
)

type LocationData struct {
	Latitude      float64 `json:"latitude"`
	Longitude     float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source        string  `json:"source"`
}

func CollectLocation() LocationData {
	switch runtime.GOOS {
	case "windows":
		return collectWindowsLocation()
	case "linux":
		return collectLinuxLocation()
	default:
		return LocationData{
			Latitude:  0.0,
			Longitude: 0.0,
			Source:    "unknown",
		}
	}
}