package collector

type NetworkInfo struct {
	MacAddresses    []string `json:"mac_addresses"`
	IPAddresses     []string `json:"ip_addresses"`
	WifiSSID        string   `json:"wifi_ssid"`
	WifiSignalDBM   float64  `json:"wifi_signal_dbm"`
	NetworkSpeedMbps float64 `json:"network_speed_mbps"`
}

func CollectNetworkInfo() NetworkInfo {
	return NetworkInfo{}
}