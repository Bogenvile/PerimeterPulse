//go:build linux

package collector

import "os"

func collectLinuxHardware() (hostname string, macs []string) {
	hostname, _ = os.Hostname()
	return
}

func collectLinuxOSVersion() string {
	return ""
}
