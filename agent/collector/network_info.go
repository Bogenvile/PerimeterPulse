package collector

// These are function variables overridden by platform-specific init()
var (
	getWiFiSSIDFunc        func() string = func() string { return "" }
	getWiFiSignalDBMFunc   func() int    = func() int { return 0 }
	getNetworkSpeedMbpsFunc func() uint64 = func() uint64 { return 0 }
	getWiFiIPFunc          func() string = func() string { return "" }
	getDefaultGatewayFunc  func() string = func() string { return "" }
)

func getWiFiSSID() string       { return getWiFiSSIDFunc() }
func getWiFiSignalDBM() int     { return getWiFiSignalDBMFunc() }
func getNetworkSpeedMbps() uint64 { return getNetworkSpeedMbpsFunc() }
func getWiFiIP() string         { return getWiFiIPFunc() }
func getDefaultGatewayIP() string { return getDefaultGatewayFunc() }