package collector

import (
	"net"
	"time"
)

type DiagInfo struct {
	Status            string `json:"status"`
	GatewayReachable  bool   `json:"gateway_reachable"`
	DNSWorking        bool   `json:"dns_working"`
	InternetReachable bool   `json:"internet_reachable"`
	DefaultGateway    string `json:"default_gateway"`
}

func RunDiagnostics() DiagInfo {
	result := DiagInfo{Status: "unknown"}

	gateway := detectDefaultGateway()
	result.DefaultGateway = gateway

	if gateway != "" {
		result.GatewayReachable = tcpDial(gateway+":80", 2*time.Second) ||
			tcpDial(gateway+":443", 2*time.Second) ||
			tcpDial(gateway+":53", 2*time.Second)
	}

	result.DNSWorking = tcpDial("8.8.8.8:53", 3*time.Second) ||
		tcpDial("1.1.1.1:53", 3*time.Second)

	result.InternetReachable = tcpDial("8.8.8.8:53", 3*time.Second) ||
		tcpDial("1.1.1.1:53", 3*time.Second) ||
		tcpDial("google.com:443", 3*time.Second)

	switch {
	case result.InternetReachable && result.GatewayReachable:
		result.Status = "online"
	case result.GatewayReachable:
		result.Status = "degraded"
	case result.InternetReachable:
		result.Status = "limited"
	default:
		result.Status = "offline"
	}

	return result
}

func tcpDial(addr string, timeout time.Duration) bool {
	conn, err := net.DialTimeout("tcp", addr, timeout)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

func detectDefaultGateway() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ""
	}
	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() && ipnet.IP.To4() != nil {
			ip := ipnet.IP.To4()
			ip[3] = 1
			return ip.String()
		}
	}
	return ""
}
