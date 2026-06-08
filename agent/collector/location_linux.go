package collector

import (
	"fmt"
	"math"
	"os/exec"
	"strconv"
	"strings"
)

// CollectLocation tries to get the device location via GeoClue2.
// Falls back to a GeoIP lookup if GeoClue is not available.
func CollectLocation() (Location, error) {
	lat, lon, err := getGeoClueLocation()
	if err == nil && (lat != 0 || lon != 0) {
		return Location{
			Latitude:       lat,
			Longitude:      lon,
			AccuracyMeters: 50, // GeoClue typically provides good accuracy
			Source:         "os",
		}, nil
	}

	// Fallback to GeoIP
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

// getGeoClueLocation queries GeoClue2 via dbus-send for the current location.
func getGeoClueLocation() (float64, float64, error) {
	// Try to get location from GeoClue2 using the where-am-i demo
	cmd := exec.Command("where-am-i")
	output, err := cmd.Output()
	if err == nil {
		return parseWhereAmI(string(output))
	}

	// Fallback: try dbus-send directly
	// This is a simplified approach - in production you'd use a D-Bus library
	cmd = exec.Command("dbus-send", "--print-reply", "--dest=org.freedesktop.GeoClue2",
		"/org/freedesktop/GeoClue2/Client/1", "org.freedesktop.GeoClue2.Client.Location")
	output, err = cmd.Output()
	if err != nil {
		return 0, 0, fmt.Errorf("geoclue: %w", err)
	}

	return parseGeoClueOutput(string(output))
}

func parseWhereAmI(output string) (float64, float64, error) {
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		if strings.Contains(line, "Latitude") {
			latStr := strings.TrimSpace(strings.Split(line, ":")[1])
			lat, err := strconv.ParseFloat(latStr, 64)
			if err != nil {
				return 0, 0, err
			}
			for _, l := range lines {
				if strings.Contains(l, "Longitude") {
					lonStr := strings.TrimSpace(strings.Split(l, ":")[1])
					lon, err := strconv.ParseFloat(lonStr, 64)
					if err != nil {
						return 0, 0, err
					}
					return lat, lon, nil
				}
			}
		}
	}
	return 0, 0, fmt.Errorf("could not parse where-am-i output")
}

func parseGeoClueOutput(output string) (float64, float64, error) {
	lines := strings.Split(output, "\n")
	var lat, lon float64
	foundLat, foundLon := false, false

	for _, line := range lines {
		if strings.Contains(line, "latitude") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				val, err := strconv.ParseFloat(parts[len(parts)-1], 64)
				if err == nil {
					lat = val
					foundLat = true
				}
			}
		}
		if strings.Contains(line, "longitude") {
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