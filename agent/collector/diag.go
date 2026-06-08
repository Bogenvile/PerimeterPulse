package collector

import (
	"net"
	"time"
)

// NetworkDiag holds basic network reachability checks.
type NetworkDiag struct {
	GatewayReachable  bool   `json:"gateway_reachable"`
	DNSWorking        bool   `json:"dns_working"`
	InternetReachable bool   `json:"internet_reachable"`
	DefaultGateway    string `json:"default_gateway"`
}

// RunNetworkDiag performs a quick reachability check and fills the
// corresponding boolean pointers inside the supplied Metrics struct.
func RunNetworkDiag(m *Metrics) {
	diag := runDiag()

	t := true
	f := false
	if diag.GatewayReachable {
		m.GatewayReachable = &t
	} else {
		m.GatewayReachable = &f
	}
	if diag.DNSWorking {
		m.DNSWorking = &t
	} else {
		m.DNSWorking = &f
	}
	if diag.InternetReachable {
		m.InternetReachable = &t
	} else {
		m.InternetReachable = &f
	}

	m.DefaultGateway = diag.DefaultGateway

	// Determine overall network status
	if !diag.GatewayReachable && !diag.InternetReachable {
		m.NetworkStatus = "down"
	} else if diag.GatewayReachable && !diag.InternetReachable {
		m.NetworkStatus = "degraded"
	} else {
		m.NetworkStatus = "up"
	}
}

func runDiag() NetworkDiag {
	diag := NetworkDiag{}

	// Detect default gateway
	diag.DefaultGateway = detectDefaultGateway()

	// Gateway reachable (TCP port 53 or 80 on gateway)
	if diag.DefaultGateway != "" {
		diag.GatewayReachable = tcpProbe(diag.DefaultGateway+":53", 2*time.Second)
	}

	// DNS working (try resolve google.com)
	diag.DNSWorking = dnsProbe("google.com", 2*time.Second)

	// Internet reachable (TCP to 8.8.8.8:53)
	diag.InternetReachable = tcpProbe("8.8.8.8:53", 3*time.Second)

	return diag
}

func detectDefaultGateway() string {
	// Simplified: use net.Interfaces and pick the first non-loopback with a default route.
	// A full implementation would parse `ip route` or `route print`.
	// For now, fallback to 8.8.8.8 as gateway probe target (not ideal, but functional).
	interfaces, err := net.Interfaces()
	if err != nil {
		return ""
	}
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && ipnet.IP.IsGlobalUnicast() {
				// Try to infer gateway (rough: assume .1 in same subnet)
				gw := make(net.IP, len(ipnet.IP))
				copy(gw, ipnet.IP)
				if len(gw) >= 4 {
					gw[len(gw)-1] = 1
				}
				return gw.String()
			}
		}
	}
	return ""
}

func tcpProbe(address string, timeout time.Duration) bool {
	conn, err := net.DialTimeout("tcp", address, timeout)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

func dnsProbe(host string, timeout time.Duration) bool {
	_, err := net.LookupHost(host)
	return err == nil
}