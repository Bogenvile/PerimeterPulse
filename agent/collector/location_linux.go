//go:build linux

package collector

import (
	"fmt"
	"math"
	"os/exec"
	"strconv"
	"strings"
)

// CollectLocation returns the device location using GeoClue2 when available,
// otherwise falls back to GeoIP.
func CollectLocation() (Location, error) {
	lat, lon, err := getGeoClueLocation()
	if err == nil && (lat != 0 || lon != 0) {
		return Location{
			Latitude:       lat,
			Longitude:      lon,
			AccuracyMeters: 50,
			Source:         "os",
		}, nil
	}

	lat, lon, acc, src, err := GetGeoIPLocation()
	if err != nil {
		return Location{}, err
	}
	return Location{
		Latitude:       lat,
		Longitude:      lon,
		AccuracyMeters: acc,
		Source:         src,
	}, nil
}

func getGeoClueLocation() (float64, float64, error) {
	// 1) Try the GeoClue "where-am-i" demo tool (often shipped on Lubuntu).
	cmd := exec.Command("where-am-i")
	output, err := cmd.Output()
	if err == nil {
		return parseWhereAmI(string(output))
	}

	// 2) Fallback: call dbus-send directly.
	cmd = exec.Command("dbus-send", "--print-reply",
		"--dest=org.freedesktop.GeoClue2",
		"/org/freedesktop/GeoClue2/Client/1",
		"org.freedesktop.GeoClue2.Client.Location")
	output, err = cmd.Output()
	if err != nil {
		return 0, 0, fmt.Errorf("geoclue: %w", err)
	}
	return parseGeoClueOutput(string(output))
}

func parseWhereAmI(output string) (float64, float64, error) {
	lines := strings.Split(output, "\n")
	var lat, lon float64
	foundLat, foundLon := false, false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "Latitude") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				val, err := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
				if err == nil {
					lat = val
					foundLat = true
				}
			}
		}
		if strings.HasPrefix(trimmed, "Longitude") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				val, err := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
				if err == nil {
					lon = val
					foundLon = true
				}
			}
		}
	}
	if !foundLat || !foundLon {
		return 0, 0, fmt.Errorf("could not parse where-am-i output")
	}
	return lat, lon, nil
}

func parseGeoClueOutput(output string) (float64, float64, error) {
	lines := strings.Split(output, "\n")
	var lat, lon float64
	foundLat, foundLon := false, false
	for _, line := range lines {
		lower := strings.ToLower(line)
		if strings.Contains(lower, "latitude") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				val, err := strconv.ParseFloat(parts[len(parts)-1], 64)
				if err == nil {
					lat = val
					foundLat = true
				}
			}
		}
		if strings.Contains(lower, "longitude") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				val, err := strconv.ParseFloat(parts[len(parts)-1], 64)
				if err == nil {
					lon = val
					foundLon = true
				}
			}
		}
	}
	if !foundLat || !foundLon {
		return 0, 0, fmt.Errorf("could not parse geoclue output")
	}
	if math.Abs(lat) > 90 || math.Abs(lon) > 180 {
		return 0, 0, fmt.Errorf("invalid coordinates from geoclue")
	}
	return lat, lon, nil
}