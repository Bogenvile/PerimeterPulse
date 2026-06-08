package collector

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Location holds the result of an OS-level location lookup.
type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Accuracy  float64 `json:"accuracy_meters"`
	Source    string  `json:"source"`
}

// GeoIPLocation holds the result of a GeoIP lookup.
type GeoIPLocation struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// getGeoIPLocation attempts to fetch the approximate location via ip-api.com.
// It returns (latitude, longitude, accuracyMeters, source, error).
// Accuracy is fixed at 20000 meters for GeoIP.
func getGeoIPLocation() (float64, float64, float64, string, error) {
	client := &http.Client{Timeout: 5 * time.Second}

	req, err := http.NewRequest("GET", "http://ip-api.com/json/?fields=lat,lon", nil)
	if err != nil {
		return 0, 0, 0, "", fmt.Errorf("geoip: create request: %w", err)
	}
	req.Header.Set("User-Agent", "PerimeterPulse-Agent/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return 0, 0, 0, "", fmt.Errorf("geoip: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, 0, 0, "", fmt.Errorf("geoip: non-200 status: %d", resp.StatusCode)
	}

	var geo GeoIPLocation
	if err := json.NewDecoder(resp.Body).Decode(&geo); err != nil {
		return 0, 0, 0, "", fmt.Errorf("geoip: decode failed: %w", err)
	}

	if geo.Latitude == 0 && geo.Longitude == 0 {
		return 0, 0, 0, "", fmt.Errorf("geoip: zero coordinates returned")
	}

	return geo.Latitude, geo.Longitude, 20000, "geoip", nil
}