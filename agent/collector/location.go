package collector

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"runtime"
	"time"
)

// LocationData represents the collected location information
type LocationData struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	City           string  `json:"city,omitempty"`
	Country        string  `json:"country,omitempty"`
	Timestamp      string  `json:"timestamp"`
}

// GeoIPResponse represents the response from ip-api.com
type GeoIPResponse struct {
	Status      string  `json:"status"`
	Lat         float64 `json:"lat"`
	Lon         float64 `json:"lon"`
	City        string  `json:"city"`
	Country     string  `json:"country"`
	CountryCode string  `json:"countryCode"`
	RegionName  string  `json:"regionName"`
	Message     string  `json:"message,omitempty"`
}

// isValidCoordinate checks if lat/lng are within valid Earth ranges
func isValidCoordinate(lat, lng float64) bool {
	if math.IsNaN(lat) || math.IsNaN(lng) {
		return false
	}
	if math.IsInf(lat, 0) || math.IsInf(lng, 0) {
		return false
	}
	// Tolak nilai default yang sering muncul dari sensor error
	if lat == 0 && lng == 0 {
		return false
	}
	if lat < -90 || lat > 90 {
		return false
	}
	if lng < -180 || lng > 180 {
		return false
	}
	// Tolak koordinat yang tepat di kutub (kemungkinan error sensor)
	if (lat == 90 || lat == -90) && lng == 0 {
		return false
	}
	return true
}

// getOSLocation menggunakan API sistem operasi (Windows/Linux)
func getOSLocation() (*LocationData, error) {
	switch runtime.GOOS {
	case "windows":
		return getWindowsLocation()
	case "linux":
		return getLinuxLocation()
	default:
		return nil, fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}
}

// getGeoIPLocation menggunakan multiple GeoIP services sebagai fallback
func getGeoIPLocation() (*LocationData, error) {
	// Coba beberapa service GeoIP secara berurutan
	services := []string{
		"http://ip-api.com/json/?fields=status,lat,lon,city,country,countryCode,regionName,message",
		"https://ipapi.co/json/",
		"https://ipinfo.io/json",
	}

	for _, url := range services {
		loc, err := fetchGeoIP(url)
		if err == nil && isValidCoordinate(loc.Latitude, loc.Longitude) {
			return loc, nil
		}
	}

	return nil, fmt.Errorf("all GeoIP services failed")
}

func fetchGeoIP(url string) (*LocationData, error) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if url == "https://ipapi.co/json/" {
		var result struct {
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
			City      string  `json:"city"`
			Country   string  `json:"country_name"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return nil, err
		}
		return &LocationData{
			Latitude:       result.Latitude,
			Longitude:      result.Longitude,
			AccuracyMeters: 5000, // GeoIP typically accurate to city level (~5km)
			Source:         "geoip",
			City:           result.City,
			Country:        result.Country,
			Timestamp:      time.Now().UTC().Format(time.RFC3339),
		}, nil
	}

	if url == "https://ipinfo.io/json" {
		var result struct {
			Loc     string `json:"loc"`
			City    string `json:"city"`
			Country string `json:"country"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return nil, err
		}
		var lat, lng float64
		fmt.Sscanf(result.Loc, "%f,%f", &lat, &lng)
		return &LocationData{
			Latitude:       lat,
			Longitude:      lng,
			AccuracyMeters: 5000,
			Source:         "geoip",
			City:           result.City,
			Country:        result.Country,
			Timestamp:      time.Now().UTC().Format(time.RFC3339),
		}, nil
	}

	// Default: ip-api.com
	var result GeoIPResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	if result.Status != "success" {
		return nil, fmt.Errorf("GeoIP API error: %s", result.Message)
	}

	return &LocationData{
		Latitude:       result.Lat,
		Longitude:      result.Lon,
		AccuracyMeters: 5000,
		Source:         "geoip",
		City:           result.City,
		Country:        result.Country,
		Timestamp:      time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// CollectLocation mengumpulkan lokasi dengan prioritas:
// 1. GPS/WiFi dari OS (akurat)
// 2. GeoIP (perkiraan, fallback)
// Jika tidak ada yang valid, return error (jangan kirim data palsu)
func CollectLocation() (*LocationData, error) {
	// Coba OS location dulu (paling akurat)
	osLoc, err := getOSLocation()
	if err == nil && osLoc != nil && isValidCoordinate(osLoc.Latitude, osLoc.Longitude) {
		return osLoc, nil
	}

	// Fallback ke GeoIP
	geoLoc, err := getGeoIPLocation()
	if err == nil && geoLoc != nil && isValidCoordinate(geoLoc.Latitude, geoLoc.Longitude) {
		return geoLoc, nil
	}

	// Jika semua gagal, jangan kirim lokasi palsu
	return nil, fmt.Errorf("no valid location source available")
}

// GetHostname mendapatkan hostname perangkat
func GetHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return hostname
}