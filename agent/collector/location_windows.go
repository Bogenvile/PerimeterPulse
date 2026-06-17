package collector

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"time"
)

func init() {
	getPlatformLocation = windowsGetLocation
}

func windowsGetLocation() (LocationData, error) {
	now := time.Now().UTC().Format(time.RFC3339)

	// 1. Try Windows Geolocator
	loc, err := getWindowsGeoLocator()
	if err == nil && loc.Latitude != 0 && loc.Longitude != 0 {
		loc.Timestamp = now
		loc.Source = "os"
		fmt.Printf("[location] OS geolocator success: %.4f, %.4f\n", loc.Latitude, loc.Longitude)
		return loc, nil
	}
	fmt.Printf("[location] OS geolocator failed: %v, trying GeoIP...\n", err)

	// 2. Fallback: GeoIP
	loc, err = getGeoIPLocation()
	if err == nil && loc.Latitude != 0 && loc.Longitude != 0 {
		loc.Timestamp = now
		loc.Source = "geoip"
		fmt.Printf("[location] GeoIP success: %.4f, %.4f (%s, %s)\n", loc.Latitude, loc.Longitude, loc.City, loc.Country)
		return loc, nil
	}
	fmt.Printf("[location] GeoIP failed: %v\n", err)

	fmt.Println("[location] No location source available, sending empty location")
	return LocationData{Source: "none", Timestamp: now}, nil
}

// getWindowsGeoLocator uses Windows.Devices.Geolocation via PowerShell
func getWindowsGeoLocator() (LocationData, error) {
	psScript := `
Add-Type -AssemblyName System.Device
$geo = New-Object System.Device.Location.GeoCoordinateWatcher
$geo.TryStart($false, [TimeSpan]::FromMilliseconds(5000))
$pos = $geo.Position
if ($pos -and $pos.Location.IsUnknown -eq $false) {
    $loc = $pos.Location
    Write-Output "$($loc.Latitude),$($loc.Longitude)"
} else {
    Write-Output "NONE"
}
`

	cmd := exec.Command("powershell", "-NoProfile", "-Command", psScript)
	output, err := cmd.Output()
	if err != nil {
		return LocationData{}, fmt.Errorf("powershell error: %w", err)
	}

	result := strings.TrimSpace(string(output))
	if result == "NONE" || result == "" {
		return LocationData{}, fmt.Errorf("no location from Windows geolocator")
	}

	parts := strings.Split(result, ",")
	if len(parts) != 2 {
		return LocationData{}, fmt.Errorf("unexpected geolocator output: %s", result)
	}

	var lat, lon float64
	if _, err := fmt.Sscanf(parts[0], "%f", &lat); err != nil {
		return LocationData{}, fmt.Errorf("bad latitude: %s", parts[0])
	}
	if _, err := fmt.Sscanf(parts[1], "%f", &lon); err != nil {
		return LocationData{}, fmt.Errorf("bad longitude: %s", parts[1])
	}

	return LocationData{
		Latitude:  lat,
		Longitude: lon,
	}, nil
}

// getGeoIPLocation uses ip-api.com for free GeoIP lookup
func getGeoIPLocation() (LocationData, error) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("http://ip-api.com/json/?fields=lat,lon,city,country")
	if err != nil {
		return LocationData{}, err
	}
	defer resp.Body.Close()

	var result struct {
		Lat     float64 `json:"lat"`
		Lon     float64 `json:"lon"`
		City    string  `json:"city"`
		Country string  `json:"country"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return LocationData{}, err
	}

	return LocationData{
		Latitude:  result.Lat,
		Longitude: result.Lon,
		City:      result.City,
		Country:   result.Country,
	}, nil
}