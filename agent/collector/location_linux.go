//go:build linux

package collector

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

// getOSLocation uses GeoClue2 via D-Bus to get the device's position.
//
// GeoClue2 is available on most Linux distributions (including Lubuntu).
// Install with: sudo apt install geoclue-2.0
//
// The agent queries GeoClue2 by calling the gdbus command-line tool,
// which is the simplest way to interface with D-Bus without CGo dependencies.
func getOSLocation() (Location, error) {
	// Check if geoclue is available
	if _, err := exec.LookPath("gdbus"); err != nil {
		return Location{}, fmt.Errorf("gdbus not found: install geoclue-2.0 + libglib2.0-bin")
	}

	// Query GeoClue2 for client location
	// We use a one-shot approach: create client, get location, then stop
	output, err := exec.Command(
		"gdbus", "call", "--system",
		"--dest", "org.freedesktop.GeoClue2",
		"--object-path", "/org/freedesktop/GeoClue2/Manager",
		"--method", "org.freedesktop.GeoClue2.Manager.GetClient",
	).CombinedOutput()

	if err != nil {
		// GeoClue2 might not be running — try starting it
		exec.Command("systemctl", "start", "geoclue").Run()
		return Location{}, fmt.Errorf("geoclue2 unavailable: %v (%s)", err, strings.TrimSpace(string(output)))
	}

	// Parse the client path from output like: "(objectpath '/org/freedesktop/GeoClue2/Client/1',)"
	clientPath := extractObjectPath(string(output))
	if clientPath == "" {
		return Location{}, fmt.Errorf("could not get geoclue client path")
	}

	// Start the client
	exec.Command(
		"gdbus", "call", "--system",
		"--dest", "org.freedesktop.GeoClue2",
		"--object-path", clientPath,
		"--method", "org.freedesktop.GeoClue2.Client.Start",
	).Run()

	// Get location
	locOutput, err := exec.Command(
		"gdbus", "call", "--system",
		"--dest", "org.freedesktop.GeoClue2",
		"--object-path", clientPath,
		"--method", "org.freedesktop.DBus.Properties.Get",
		"org.freedesktop.GeoClue2.Client",
		"Location",
	).CombinedOutput()

	if err != nil {
		// Cleanup: stop client
		exec.Command(
			"gdbus", "call", "--system",
			"--dest", "org.freedesktop.GeoClue2",
			"--object-path", clientPath,
			"--method", "org.freedesktop.GeoClue2.Client.Stop",
		).Run()
		return Location{}, fmt.Errorf("geoclue location failed: %v", err)
	}

	// Parse location path: typically like "('/org/freedesktop/GeoClue2/Location/1',)"
	locPath := extractObjectPath(string(locOutput))
	if locPath == "" {
		return Location{}, fmt.Errorf("could not get geoclue location path")
	}

	// Read latitude
	latOutput, _ := exec.Command(
		"gdbus", "call", "--system",
		"--dest", "org.freedesktop.GeoClue2",
		"--object-path", locPath,
		"--method", "org.freedesktop.DBus.Properties.Get",
		"org.freedesktop.GeoClue2.Location",
		"Latitude",
	).CombinedOutput()

	// Read longitude
	lngOutput, _ := exec.Command(
		"gdbus", "call", "--system",
		"--dest", "org.freedesktop.GeoClue2",
		"--object-path", locPath,
		"--method", "org.freedesktop.DBus.Properties.Get",
		"org.freedesktop.GeoClue2.Location",
		"Longitude",
	).CombinedOutput()

	// Read accuracy
	accOutput, _ := exec.Command(
		"gdbus", "call", "--system",
		"--dest", "org.freedesktop.GeoClue2",
		"--object-path", locPath,
		"--method", "org.freedesktop.DBus.Properties.Get",
		"org.freedesktop.GeoClue2.Location",
		"Accuracy",
	).CombinedOutput()

	// Stop client
	exec.Command(
		"gdbus", "call", "--system",
		"--dest", "org.freedesktop.GeoClue2",
		"--object-path", clientPath,
		"--method", "org.freedesktop.GeoClue2.Client.Stop",
	).Run()

	lat := parseVariantDouble(string(latOutput))
	lng := parseVariantDouble(string(lngOutput))
	acc := parseVariantDouble(string(accOutput))

	if lat == 0 && lng == 0 {
		return Location{}, fmt.Errorf("geoclue returned zero coordinates")
	}

	return Location{
		Latitude:       lat,
		Longitude:      lng,
		AccuracyMeters: acc,
	}, nil
}

// extractObjectPath extracts a D-Bus object path from gdbus output.
// Input:  "(objectpath '/org/freedesktop/GeoClue2/Client/1',)"
// Output: "/org/freedesktop/GeoClue2/Client/1"
func extractObjectPath(output string) string {
	start := strings.Index(output, "'")
	if start == -1 {
		return ""
	}
	end := strings.Index(output[start+1:], "'")
	if end == -1 {
		return ""
	}
	return output[start+1 : start+1+end]
}

// parseVariantDouble extracts a double value from gdbus variant output.
// Input:  "(<40.7128>,)"
// Output: 40.7128
func parseVariantDouble(output string) float64 {
	start := strings.Index(output, "<")
	if start == -1 {
		return 0
	}
	end := strings.Index(output[start+1:], ">")
	if end == -1 {
		return 0
	}
	val := output[start+1 : start+1+end]
	var result float64
	json.Unmarshal([]byte(val), &result)
	return result
}
