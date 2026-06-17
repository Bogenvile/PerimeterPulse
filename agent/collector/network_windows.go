package collector

func init() {
	getWiFiSSIDPlatform = getWiFiSSIDWindows
	getWiFiSignalDBMPlatform = getWiFiSignalDBMWindows
	getNetworkSpeedMbpsPlatform = getNetworkSpeedMbpsWindows
	getDefaultGatewayIPPlatform = getDefaultGatewayIPWindows
}