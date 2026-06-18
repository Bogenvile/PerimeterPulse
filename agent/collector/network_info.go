package collector

import (
	"net"
	"runtime"
)

// CollectNetworkInfo gathers network adapter details.
func CollectNetworkInfo() NetworkInfo {
	var ifaces []net.Interface
	var err error

	if runtime.GOOS == "windows" {
		ifaces, err = net.Interfaces()
	} else {
		ifaces, err = net.Interfaces()
	}
	if err != nil {
		return NetworkInfo{}
	}

	var ips []string
	for _, i := range ifaces {
		if i.Flags&net.FlagLoopback != 0 || i.Flags&net.FlagUp == 0 {
			continue
		}
		addrs, _ := i.Addrs()
		for _, a := range addrs {
			if ipnet, ok := a.(*net.IPNet); ok && ipnet.IP.To4() != nil {
				ips = append(ips, ipnet.IP.String())
			}
		}
	}

	// Additional data (WiFi, Gateway) need OS-specific code, left as empty.
	return NetworkInfo{
		IPAddresses: ips,
	}
}