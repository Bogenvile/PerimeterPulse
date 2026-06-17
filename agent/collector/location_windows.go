package collector

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// init registers the Windows GeoIP‑based location implementation.
func init() {
	getPlatformLocation = windowsGetLocation
}

// windowsGetLocation obtains approximate location using ip-api.com.
// On Windows, the native geolocation API requires CGO which we avoid,
// so GeoIP is the primary source.
func windowsGetLocation() (LocationData, error) {
	client := &http.Client{Timeout: 5 * time.Second}

	resp, err := client.Get("http://ip-api.com/json/?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone,query")
	if err != nil {
		return LocationData{}, fmt.Errorf("geoip request failed: %w", err)
	}
	defer resp.Body.Close()

	var geo struct {
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
	if err := json.NewDecoder(resp.Body).Decode(&geo); err != nil {
		return LocationData{}, fmt.Errorf("geoip decode failed: %w", err)
	}

	if geo.Status != "success" {
		return LocationData{}, fmt.Errorf("geoip lookup failed: %s", geo.Status)
	}

	return LocationData{
		Latitude:       geo.Lat,
		Longitude:      geo.Lon,
		AccuracyMeters: 5000,
		Source:         "geoip",
		City:           geo.City,
		Country:        geo.Country,
		Timestamp:      time.Now().UTC().Format(time.RFC3339),
	}, nil
}