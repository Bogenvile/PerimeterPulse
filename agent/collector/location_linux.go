// +build linux

package collector

import (
	"fmt"
	"time"

	"github.com/godbus/dbus/v5"
)

// getOSLocation on Linux uses GeoClue2 via D-Bus.
func getOSLocation() LocationData {
	conn, err := dbus.SystemBus()
	if err != nil {
		fmt.Printf("[location] D-Bus system bus failed: %v\n", err)
		return LocationData{}
	}
	defer conn.Close()

	obj := conn.Object("org.freedesktop.GeoClue2", "/org/freedesktop/GeoClue2/Client/1")
	if obj == nil {
		fmt.Println("[location] GeoClue2 object not found")
		return LocationData{}
	}

	variant, err := obj.GetProperty("org.freedesktop.GeoClue2.Client.Location")
	if err != nil {
		fmt.Printf("[location] Failed to get location property: %v\n", err)
		return LocationData{}
	}

	locObjPath, ok := variant.Value().(dbus.ObjectPath)
	if !ok {
		fmt.Println("[location] Invalid location path")
		return LocationData{}
	}

	locObj := conn.Object("org.freedesktop.GeoClue2", locObjPath)
	latitudeVariant, err := locObj.GetProperty("org.freedesktop.GeoClue2.Location.Latitude")
	if err != nil {
		return LocationData{}
	}
	longitudeVariant, err := locObj.GetProperty("org.freedesktop.GeoClue2.Location.Longitude")
	if err != nil {
		return LocationData{}
	}
	accuracyVariant, err := locObj.GetProperty("org.freedesktop.GeoClue2.Location.Accuracy")
	if err != nil {
		return LocationData{}
	}

	lat, ok := latitudeVariant.Value().(float64)
	if !ok {
		return LocationData{}
	}
	lon, ok := longitudeVariant.Value().(float64)
	if !ok {
		return LocationData{}
	}
	acc, _ := accuracyVariant.Value().(float64)

	fmt.Printf("[location] GeoClue2: lat=%.4f lon=%.4f acc=%.1f\n", lat, lon, acc)

	return LocationData{
		Latitude:       lat,
		Longitude:      lon,
		AccuracyMeters: acc,
		Source:         "os",
		Timestamp:      time.Now().UTC().Format(time.RFC3339),
	}
}