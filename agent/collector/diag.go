package collector

// DiagInfo holds network diagnostic results
type DiagInfo struct {
	Status             string `json:"status"`
	GatewayReachable   bool   `json:"gateway_reachable"`
	DNSWorking         bool   `json:"dns_working"`
	InternetReachable  bool   `json:"internet_reachable"`
}

// RunDiagnostics performs basic network checks
func RunDiagnostics() DiagInfo {
	return DiagInfo{
		Status:            "unknown",
		GatewayReachable:  false,
		DNSWorking:        false,
		InternetReachable: false,
	}
}