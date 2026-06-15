//go:build windows

package collector

import (
	"fmt"
	"syscall"
	"time"
	"unsafe"
)

var (
	mod kernel32 = syscall.NewLazyDLL("kernel32.dll")
)

// getWindowsLocation menggunakan Windows Location API
func getWindowsLocation() (*LocationData, error) {
	// Coba beberapa metode untuk mendapatkan lokasi di Windows

	// Metode 1: Cek apakah ada file cache lokasi dari Windows Location Service
	// Ini adalah pendekatan yang lebih reliable daripada memanggil API langsung

	// Metode 2: Fallback ke WiFi triangulation melalui Windows API
	// Untuk sekarang, kita return error agar menggunakan GeoIP
	// karena Windows Geolocation API memerlukan UWP/COM interop yang kompleks

	// TODO: Implement Windows.Devices.Geolocation API via COM interop
	// Untuk production, gunakan:
	// 1. Windows.Devices.Geolocation.Geolocator
	// 2. Atau baca dari sensor GPS jika tersedia

	return nil, fmt.Errorf("windows native location not implemented, use GeoIP fallback")
}

// GetSystemUptime mendapatkan uptime sistem dalam detik (Windows)
func GetSystemUptime() (uint64, error) {
	// Using GetTickCount64 for system uptime in milliseconds
	ret, _, err := syscall.NewLazyDLL("kernel32.dll").NewProc("GetTickCount64").Call()
	if ret == 0 {
		return 0, err
	}
	return uint64(ret) / 1000, nil
}

// GetTimeSinceBoot mendapatkan waktu sejak boot dalam format yang friendly
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

// init untuk memastikan DLL tersedia
func init() {
	_ = mod
	_ = unsafe.Pointer(nil)
}