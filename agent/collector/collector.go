package collector

type Metrics struct {
	CPUPercent       float64
	RAMPercent       float64
	MemoryUsed       int64
	MemoryTotal      int64
	StoragePercent   float64
	DiskUsed         int64
	DiskTotal        int64
	UptimeSeconds    int64
	NetworkStatus    string
	NetworkLatencyMs float64
}

type Location struct {
	Latitude       float64
	Longitude      float64
	AccuracyMeters float64
	Source         string
}

type NetworkInfo struct {
	WiFiSSID        string
	WiFiSignalDBM   int
	NetworkSpeedMbps int
	IPAddresses     []string
}

type Info struct {
	Hostname          string
	OS                string
	OSVersion         string
	AgentVersion      string
	AgentID           string
	MACAddresses      []string
	IPAddresses       []string
	CPUModel          string
	CPUCores          int
	RAMTotalBytes     int64
	StorageTotalBytes int64
	DiskModel         string
	DiskType          string
	WiFiSSID          string
	WiFiSignalDBM     int
	NetworkSpeedMbps  int
}