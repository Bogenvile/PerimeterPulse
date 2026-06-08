//go:build windows

package collector

import (
	"fmt"
	"syscall"
	"unsafe"
)

// getOSLocation uses the Windows.Devices.Geolocation API to get the device's
// current position. It uses the Windows Runtime Geolocator class.
//
// Note: The app must have location permissions enabled in Windows Settings,
// and the Location Service must be running.
func getOSLocation() (Location, error) {
	// Load the Windows.Devices.Geolocation API
	// This uses CoCreateInstance with CLSID_Geolocator
	geolocator, err := createGeolocator()
	if err != nil {
		return Location{}, fmt.Errorf("windows geolocator unavailable: %w", err)
	}
	defer releaseGeolocator(geolocator)

	pos, err := geolocator.getGeoposition()
	if err != nil {
		return Location{}, fmt.Errorf("windows geoposition failed: %w", err)
	}

	return Location{
		Latitude:       pos.Latitude,
		Longitude:      pos.Longitude,
		AccuracyMeters: pos.Accuracy,
	}, nil
}

// The Windows Runtime Geolocator implementation is non-trivial and requires
// linking against the Windows Runtime C++ libraries. In a production build,
// you would use the official Go Windows Runtime bindings or CGo.
//
// For a practical deployment, consider these alternatives:
//  1. Use a Go-sidecar that calls the Windows Location API via PowerShell
//  2. Use the Microsoft Geolocation WinRT API via CGo
//  3. Rely on Wi-Fi positioning via the WLAN API (wlanapi.dll)
//
// Here we provide a stub that returns an error on Windows — the caller falls
// back to GeoIP automatically. Replace stub with real implementation.

type geoposition struct {
	Latitude  float64
	Longitude float64
	Accuracy  float64
}

type windowsGeolocator struct {
	ptr unsafe.Pointer
}

func createGeolocator() (*windowsGeolocator, error) {
	// Stub: Load ole32.dll, call CoInitialize, then RoGetActivationFactory
	// for Windows.Devices.Geolocation.Geolocator.
	// Full implementation requires CGo + Windows Runtime headers.
	_ = syscall.StringToUTF16("placeholder")
	return nil, fmt.Errorf("windows geolocation: WinRT binding not compiled (use GeoIP fallback)")
}

func releaseGeolocator(g *windowsGeolocator) {
	if g != nil && g.ptr != nil {
		// Release COM reference
	}
}

func (g *windowsGeolocator) getGeoposition() (*geoposition, error) {
	return nil, fmt.Errorf("not implemented")
}
