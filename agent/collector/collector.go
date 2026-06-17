package collector

type RegistrationInfo struct {
	Hostname         string
	OS               string
	OSVersion        string
	AgentVersion     string
	MacAddresses     []string
	IPAddresses      []string
	CPUModel         string
	CPUCores         int
	RAMTotalBytes    uint64
	StorageTotalBytes uint64
	DiskModel        string
	DiskType         string
	WifiSSID         string
	WifiSignalDBM    float64
	NetworkSpeedMbps float64
}

func CollectRegistrationInfo() RegistrationInfo {
	return RegistrationInfo{
		Hostname: "unknown",
		OS:       "windows",
		DiskType: "unknown",
	}
}