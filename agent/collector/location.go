package collector

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Location represents a geographic position.
type Location struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"` // "os" or "geoip"
	Timestamp      string  `json:"timestamp"`
}

// geoipResponse is the response from ip-api.com (free tier).
type geoipResponse struct {
	Status string  `json:"status"`
	Lat    float64 `json:"lat"`
	Lon    float64 `json:"lon"`
	Query  string  `json:"query"`
}

// CollectLocation attempts OS-native location first, then falls back to GeoIP.
//
// On Windows: Uses the Windows.Devices.Geolocation API via COM.
// On Linux:   Uses GeoClue2 via D-Bus.
// Fallback:   Uses ip-api.com for IP-based geolocation.
func CollectLocation() Location {
	now := time.Now().UTC().Format(time.RFC3339)

	// Try OS-native location first
	loc, err := getOSLocation()
	if err == nil {
		loc.Timestamp = now
		loc.Source = "os"
		return loc
	}

	// Fall back to IP-based GeoIP
	loc, err = getGeoIPLocation()
	if err == nil {
		loc.Timestamp = now
		loc.Source = "geoip"
		return loc
	}

	// Absolute fallback — zero coordinates
	return Location{
		Latitude:       0,
		Longitude:      0,
		AccuracyMeters: 999999,
		Source:         "geoip",
		Timestamp:      now,
	}
}

// getOSLocation is implemented in platform-specific files:
//
//	location_windows.go — Windows.Devices.Geolocation via COM
//	location_linux.go   — GeoClue2 via D-Bus
//
// This file provides a default no-op implementation for unsupported platforms.
func getOSLocation() (Location, error) {
	return Location{}, fmt.Errorf("os location not available on this platform")
}

// getGeoIPLocation queries ip-api.com for IP-based geolocation.
func getGeoIPLocation() (Location, error) {
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Get("http://ip-api.com/json/?fields=status,lat,lon,query")
	if err != nil {
		return Location{}, fmt.Errorf("geoip request failed: %w", err)
	}
	defer resp.Body.Close()

	var result geoipResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return Location{}, fmt.Errorf("geoip decode failed: %w", err)
	}

	if result.Status != "success" {
		return Location{}, fmt.Errorf("geoip lookup failed: status=%s", result.Status)
	}

	return Location{
		Latitude:       result.Lat,
		Longitude:      result.Lon,
		AccuracyMeters: 5000, // IP-based is typically accurate to city level (~5km)
	}, nil
}
