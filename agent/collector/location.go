package collector

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Location holds the result of a device location lookup.
type Location struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
}

// geoIPResponse is the relevant part of the ip-api.com JSON response.
type geoIPResponse struct {
	Latitude  float64 `json:"lat"`
	Longitude float64 `json:"lon"`
}

// GetGeoIPLocation performs a GeoIP lookup using ip-api.com.
// It returns latitude, longitude, accuracy (metres), source name, and any error.
func GetGeoIPLocation() (float64, float64, float64, string, error) {
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

	var geo geoIPResponse
	if err := json.NewDecoder(resp.Body).Decode(&geo); err != nil {
		return 0, 0, 0, "", fmt.Errorf("geoip: decode failed: %w", err)
	}

	if geo.Latitude == 0 && geo.Longitude == 0 {
		return 0, 0, 0, "", fmt.Errorf("geoip: zero coordinates returned")
	}

	return geo.Latitude, geo.Longitude, 20000, "geoip", nil
}