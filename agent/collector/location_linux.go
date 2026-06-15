//go:build linux

package collector

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// getLinuxLocation menggunakan GeoClue2 melalui D-Bus
func getLinuxLocation() (*LocationData, error) {
	// Metode 1: Coba gunakan geoclue2 via where-am-i (paling akurat jika tersedia)
	loc, err := getGeoClueLocation()
	if err == nil && loc != nil {
		return loc, nil
	}

	// Metode 2: Coba baca dari GPSD jika ada GPS hardware
	loc, err = getGPSDLocation()
	if err == nil && loc != nil {
		return loc, nil
	}

	return nil, fmt.Errorf("no Linux location source available")
}

// getGeoClueLocation menggunakan geoclue2
func getGeoClueLocation() (*LocationData, error) {
	// Coba menggunakan gclue-2.0 atau where-am-i command
	// Ini memerlukan geoclue-2.0 terinstall dan berjalan

	// Cek apakah geoclue tersedia
	_, err := exec.LookPath("where-am-i")
	if err != nil {
		// Coba alternatif dengan dbus-send
		return getGeoClueDBus()
	}

	cmd := exec.Command("where-am-i", "-f", "json")
	output, err := cmd.Output()
	if err != nil {
		return getGeoClueDBus()
	}

	// Parse output JSON sederhana
	// Format: {"latitude": -6.2, "longitude": 106.8, "accuracy": 10}
	outputStr := string(output)
	latStr := extractJSONValue(outputStr, "latitude")
	lngStr := extractJSONValue(outputStr, "longitude")
	accStr := extractJSONValue(outputStr, "accuracy")

	lat, _ := strconv.ParseFloat(latStr, 64)
	lng, _ := strconv.ParseFloat(lngStr, 64)
	acc, _ := strconv.ParseFloat(accStr, 64)

	if lat == 0 && lng == 0 {
		return nil, fmt.Errorf("geoclue returned zero coordinates")
	}

	return &LocationData{
		Latitude:       lat,
		Longitude:      lng,
		AccuracyMeters: acc,
		Source:         "os",
		Timestamp:      time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// getGeoClueDBus mencoba mendapatkan lokasi via D-Bus langsung
func getGeoClueDBus() (*LocationData, error) {
	// Coba menggunakan dbus-send untuk mendapatkan lokasi dari GeoClue2
	// Ini adalah fallback jika where-am-i tidak tersedia
	_, err := exec.LookPath("dbus-send")
	if err != nil {
		return nil, fmt.Errorf("dbus-send not available")
	}

	// D-Bus call ke GeoClue2 Client
	cmd := exec.Command("dbus-send",
		"--print-reply",
		"--dest=org.freedesktop.GeoClue2",
		"/org/freedesktop/GeoClue2/Client/1",
		"org.freedesktop.DBus.Properties.Get",
		"string:org.freedesktop.GeoClue2.Client",
		"string:Location",
	)
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	// Parse D-Bus output untuk mendapatkan path lokasi
	outputStr := string(output)
	if !strings.Contains(outputStr, "Location") {
		return nil, fmt.Errorf("no location from GeoClue2")
	}

	return nil, fmt.Errorf("GeoClue2 D-Bus location parsing not fully implemented")
}

// getGPSDLocation mencoba mendapatkan lokasi dari GPSD (GPS hardware)
func getGPSDLocation() (*LocationData, error) {
	_, err := exec.LookPath("gpspipe")
	if err != nil {
		return nil, fmt.Errorf("gpsd not available")
	}

	cmd := exec.Command("gpspipe", "-w", "-n", "5")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	// Parse output GPSD JSON
	// Mencari TPV (Time-Position-Velocity) sentence
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.Contains(line, "\"class\":\"TPV\"") {
			latStr := extractJSONValue(line, "lat")
			lngStr := extractJSONValue(line, "lon")
			altStr := extractJSONValue(line, "alt")

			lat, _ := strconv.ParseFloat(latStr, 64)
			lng, _ := strconv.ParseFloat(lngStr, 64)
			alt, _ := strconv.ParseFloat(altStr, 64)

			_ = alt // altitude tersedia jika diperlukan

			if lat != 0 || lng != 0 {
				return &LocationData{
					Latitude:       lat,
					Longitude:      lng,
					AccuracyMeters: 3, // GPS typically 3-5 meters
					Source:         "gps",
					Timestamp:      time.Now().UTC().Format(time.RFC3339),
				}, nil
			}
		}
	}

	return nil, fmt.Errorf("no GPS fix")
}

// extractJSONValue mengekstrak nilai dari JSON string sederhana
func extractJSONValue(jsonStr, key string) string {
	// Simple extraction untuk format "key": value
	searchStr := fmt.Sprintf("\"%s\":", key)
	idx := strings.Index(jsonStr, searchStr)
	if idx == -1 {
		searchStr = fmt.Sprintf("\"%s\": ", key)
		idx = strings.Index(jsonStr, searchStr)
		if idx == -1 {
			return ""
		}
	}

	start := idx + len(searchStr)
	remaining := strings.TrimSpace(jsonStr[start:])

	// Handle string values
	if strings.HasPrefix(remaining, "\"") {
		remaining = remaining[1:]
		endIdx := strings.Index(remaining, "\"")
		if endIdx == -1 {
			return ""
		}
		return remaining[:endIdx]
	}

	// Handle numeric values
	endIdx := strings.IndexAny(remaining, ",}\n ")
	if endIdx == -1 {
		return remaining
	}
	val := remaining[:endIdx]
	return strings.TrimSpace(val)
}

// GetSystemUptime di Linux dari /proc/uptime
func GetSystemUptime() (uint64, error) {
	data, err := exec.Command("cat", "/proc/uptime").Output()
	if err != nil {
		return 0, err
	}
	parts := strings.Fields(string(data))
	if len(parts) < 1 {
		return 0, fmt.Errorf("cannot parse /proc/uptime")
	}
	uptime, err := strconv.ParseFloat(parts[0], 64)
	if err != nil {
		return 0, err
	}
	return uint64(uptime), nil
}

// GetTimeSinceBoot di Linux
func GetTimeSinceBoot() string {
	uptime, err := GetSystemUptime()
	if err != nil {
		return "unknown"
	}
	d := time.Duration(uptime) * time.Second
	hours := int(d.Hours())
	minutes := int(d.Minutes()) % 60
	return fmt.Sprintf("%dh %dm", hours, minutes)
}