package collector

import (
	"fmt"
	"net"
)

// LocationData holds geographical location information
type LocationData struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	City           string  `json:"city,omitempty"`
	Country        string  `json:"country,omitempty"`
	Timestamp      string  `json:"timestamp"`
}

// GetLocation gets the current location (platform-specific fallback)
func GetLocation() (LocationData, error) {
	loc, err := getOSLocation()
	if err == nil && loc.Latitude != 0 && loc.Longitude != 0 {
		return loc, nil
	}

	// Fallback to GeoIP
	ip, err := getPublicIP()
	if err != nil {
		return LocationData{}, fmt.Errorf("cannot determine location: %w", err)
	}
	return geoIPLookup(ip)
}

// getPublicIP returns the public IP address
func getPublicIP() (string, error) {
	resp, err := httpGet("https://api.ipify.org")
	if err != nil {
		return "", err
	}
	return resp, nil
}

// geoIPLookup does a simple GeoIP lookup
func geoIPLookup(ip string) (LocationData, error) {
	body, err := httpGet(fmt.Sprintf("http://ip-api.com/json/%s", ip))
	if err != nil {
		return LocationData{}, err
	}
	// Parse JSON response (simplified — in production use proper JSON parsing)
	return parseGeoIP(body, ip)
}

// parseGeoIP parses the GeoIP JSON response
func parseGeoIP(body, ip string) (LocationData, error) {
	// Basic JSON key extraction (simplified — full implementation would use encoding/json)
	var lat, lng float64
	var city, country string
	_, err := fmt.Sscanf(body, `{"status":"success","country":"%s","regionName":"%s","city":"%s","lat":%f,"lon":%f`,
		&country, new(string), &city, &lat, &lng)
	if err != nil {
		return LocationData{}, fmt.Errorf("failed to parse GeoIP: %w", err)
	}
	return LocationData{
		Latitude:       lat,
		Longitude:      lng,
		AccuracyMeters: 10000, // approximate
		Source:         "geoip",
		City:           city,
		Country:        country,
	}, nil
}

// httpGet does a simple HTTP GET and returns the body as string
func httpGet(url string) (string, error) {
	resp, err := net.Dial("tcp", "api.ipify.org:80")
	if err != nil {
		// fallback for simple HTTP get
		return "", err
	}
	defer resp.Close()
	// This is a stub — real implementation would use net/http
	return "", nil
}

// getOSLocation is platform-specific
func getOSLocation() (LocationData, error) {
	return LocationData{}, fmt.Errorf("not implemented on this platform")
}