package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

type RegistrationRequest struct {
	Hostname         string   `json:"hostname"`
	OS               string   `json:"os"`
	OSVersion        string   `json:"os_version"`
	AgentVersion     string   `json:"agent_version"`
	APIKey           string   `json:"api_key"`
	MACAddresses     []string `json:"mac_addresses"`
	IPAddresses      []string `json:"ip_addresses"`
	CPUModel         string   `json:"cpu_model"`
	CPUCores         int      `json:"cpu_cores"`
	RAMTotalBytes    int64    `json:"ram_total_bytes"`
	StorageTotalBytes int64   `json:"storage_total_bytes"`
	DiskModel        string   `json:"disk_model"`
	DiskType         string   `json:"disk_type"`
	WiFiSSID         string   `json:"wifi_ssid"`
	WiFiSignalDBM    int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps int      `json:"network_speed_mbps"`
}

type MetricsData struct {
	CPUPercent       float64 `json:"cpu_percent"`
	RAMPercent       float64 `json:"ram_percent"`
	RAMUsedBytes     int64   `json:"ram_used_bytes"`
	RAMTotalBytes    int64   `json:"ram_total_bytes"`
	StoragePercent   float64 `json:"storage_percent"`
	StorageUsedBytes int64   `json:"storage_used_bytes"`
	StorageTotalBytes int64  `json:"storage_total_bytes"`
	UptimeSeconds    int64   `json:"uptime_seconds"`
	NetworkStatus    string  `json:"network_status"`
	NetworkLatencyMs float64 `json:"network_latency_ms"`
	Timestamp        string  `json:"timestamp"`
}

type LocationData struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	Timestamp      string  `json:"timestamp"`
}

type NetworkInfoData struct {
	WiFiSSID        string   `json:"wifi_ssid"`
	WiFiSignalDBM   int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps int     `json:"network_speed_mbps"`
	IPAddresses     []string `json:"ip_addresses"`
}

type HeartbeatRequest struct {
	AgentID     string           `json:"agent_id"`
	APIKey      string           `json:"api_key"`
	Metrics     *MetricsData     `json:"metrics,omitempty"`
	Location    *LocationData    `json:"location,omitempty"`
	NetworkInfo *NetworkInfoData `json:"network_info,omitempty"`
}

func Register(server string, req *RegistrationRequest) error {
	return postJSON(server+"/api/agent/register", req)
}

func SendHeartbeat(server string, req *HeartbeatRequest) error {
	return postJSON(server+"/api/agent/heartbeat", req)
}

func postJSON(url string, body interface{}) error {
	data, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}
	resp, err := http.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("http error: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("server returned %d", resp.StatusCode)
	}
	return nil
}