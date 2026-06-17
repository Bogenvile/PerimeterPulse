package collector

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type GeoIPResponse struct {
	Lat         float64 `json:"lat"`
	Lon         float64 `json:"lon"`
	City        string  `json:"city"`
	Country     string  `json:"country"`
	CountryCode string  `json:"countryCode"`
	ISP         string  `json:"isp"`
}

// LocationData holds geographic location info with metadata
type LocationData struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	City           string  `json:"city"`
	Country        string  `json:"country"`
	Timestamp      string  `json:"timestamp"`
}

// CollectLocation tries OS-specific → GeoIP fallback
func CollectLocation() LocationData {
	loc := getOSLocation()
	if loc.Latitude != 0 && loc.Longitude != 0 {
		return loc
	}
	return geoIPFallback()
}

func getOSLocation() LocationData {
	return LocationData{}
}

func geoIPFallback() LocationData {
	client := http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("http://ip-api.com/json?fields=lat,lon,city,country,countryCode,isp")
	if err != nil {
		fmt.Printf("[location] GeoIP fallback failed: %v\n", err)
		return LocationData{}
	}
	defer resp.Body.Close()

	var geo GeoIPResponse
	if err := json.NewDecoder(resp.Body).Decode(&geo); err != nil {
		fmt.Printf("[location] GeoIP decode error: %v\n", err)
		return LocationData{}
	}

	fmt.Printf("[location] GeoIP: lat=%.4f lon=%.4f city=%s country=%s\n",
		geo.Lat, geo.Lon, geo.City, geo.Country)

	return LocationData{
		Latitude:       geo.Lat,
		Longitude:      geo.Lon,
		AccuracyMeters: 5000,
		Source:         "geoip",
		City:           geo.City,
		Country:        geo.Country,
		Timestamp:      time.Now().UTC().Format(time.RFC3339),
	}
}