package collector

import "runtime"

func GetOSInfo() (string, string) {
	return runtime.GOOS, "0.0"
}