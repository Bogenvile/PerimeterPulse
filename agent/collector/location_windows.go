// +build windows

package collector

import "fmt"

func getPlatformLocation() (LocationData, error) {
	// TODO: Implement Windows Geolocator API for real location
	return LocationData{}, fmt.Errorf("Windows location not implemented")
}