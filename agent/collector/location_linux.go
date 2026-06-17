// +build linux

package collector

import "fmt"

func getPlatformLocation() (LocationData, error) {
	// TODO: Implement GeoClue2/D-Bus location
	return LocationData{}, fmt.Errorf("Linux location not implemented")
}