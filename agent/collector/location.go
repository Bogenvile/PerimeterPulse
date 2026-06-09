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
	loc := LocationData{
		Latitude:      0.0,
		Longitude:     0.0,
		AccuracyMeters: 0,
		Source:        "geoip",
	}

	switch runtime.GOOS {
	case "windows":
		loc = collectWindowsLocation()
	case "linux":
		loc = collectLinuxLocation()
	}

	return loc
}

func collectWindowsLocation() LocationData {
	// Windows location via WinRT API - stub for now
	// In production use geolocator.dll or GeoCoordinateWatcher
	return LocationData{
		Latitude:      0.0,
		Longitude:     0.0,
		AccuracyMeters: 0,
		Source:        "geoip",
	}
}

func collectLinuxLocation() LocationData {
	// Linux location via GeoClue2 D-Bus - stub for now
	// In production use geoclue-2.0 D-Bus API
	return LocationData{
		Latitude:      0.0,
		Longitude:     0.0,
		AccuracyMeters: 0,
		Source:        "geoip",
	}
}