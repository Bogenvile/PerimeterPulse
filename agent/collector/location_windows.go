package collector

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// LocationInfo holds geographic location data
type LocationInfo struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	City           string  `json:"city"`
	Country        string  `json:"country"`
	Timestamp      string  `json:"timestamp"`
}

type geoIPResponse struct {
	Status      string  `json:"status"`
	Country     string  `json:"country"`
	CountryCode string  `json:"countryCode"`
	Region      string  `json:"region"`
	RegionName  string  `json:"regionName"`
	City        string  `json:"city"`
	Lat         float64 `json:"lat"`
	Lon         float64 `json:"lon"`
	Timezone    string  `json:"timezone"`
	Query       string  `json:"query"`
}

// getPlatformLocation is called by location.go to get location on Windows.
func getPlatformLocation() (*LocationInfo, error) {
	client := &http.Client{Timeout: 5 * time.Second}

	resp, err := client.Get("http://ip-api.com/json/?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone,query")
	if err != nil {
		return nil, fmt.Errorf("geoip request failed: %w", err)
	}
	defer resp.Body.Close()

	var geo geoIPResponse
	if err := json.NewDecoder(resp.Body).Decode(&geo); err != nil {
		return nil, fmt.Errorf("geoip decode failed: %w", err)
	}

	if geo.Status != "success" {
		return nil, fmt.Errorf("geoip lookup failed: %s", geo.Status)
	}

	return &LocationInfo{
		Latitude:       geo.Lat,
		Longitude:      geo.Lon,
		AccuracyMeters: 5000,
		Source:         "geoip",
		City:           geo.City,
		Country:        geo.Country,
		Timestamp:      time.Now().UTC().Format(time.RFC3339),
	}, nil
}