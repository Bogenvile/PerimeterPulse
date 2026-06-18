package collector

import (
	"net"
	"runtime"
	"strconv"
	"strings"
)

func CollectNetworkInfo() NetworkPayload {
	var ifaces []net.Interface
	var err error

	ifaces, err = net.Interfaces()
	if err != nil {
		return NetworkPayload{}
	}

	var ips []string
	var macs []string
	for _, i := range ifaces {
		if i.Flags&net.FlagLoopback != 0 || i.Flags&net.FlagUp == 0 {
			continue
		}
		hw := i.HardwareAddr.String()
		if hw != "" {
			macs = append(macs, hw)
		}
		addrs, _ := i.Addrs()
		for _, a := range addrs {
			if ipnet, ok := a.(*net.IPNet); ok && ipnet.IP.To4() != nil {
				ip := ipnet.IP.String()
				if !isVirtualAdapterIP(ip) {
					ips = append(ips, ip)
				}
			}
		}
	}

	result := NetworkPayload{
		IPAddresses:  ips,
		MacAddresses: macs,
	}

	if runtime.GOOS == "windows" {
		wifi := GetWiFiInfo()
		result.WiFiSSID = wifi.SSID
		result.WiFiSignalDBm = float64(wifi.SignalDBM)
		result.NetworkSpeedMbps = wifi.LinkSpeed
		result.WiFiIP = wifi.IP
		result.GatewayIP = wifi.Gateway
	}

	return result
}

func isVirtualAdapterIP(ip string) bool {
	if strings.HasPrefix(ip, "192.168.56.") {
		return true
	}
	if strings.HasPrefix(ip, "10.0.2.") {
		return true
	}
	if strings.HasPrefix(ip, "172.") {
		parts := strings.Split(ip, ".")
		if len(parts) == 4 {
			second, err := strconv.Atoi(parts[1])
			if err == nil && second >= 16 && second <= 31 {
				return true
			}
		}
	}
	return false
}
