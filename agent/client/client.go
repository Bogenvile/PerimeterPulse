package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// HeartbeatPayload represents the complete heartbeat data
type HeartbeatPayload struct {
	AgentID     string          `json:"agent_id"`
	APIKey      string          `json:"api_key"`
	Metrics     MetricsData     `json:"metrics"`
	Location    *LocationData   `json:"location,omitempty"`
	NetworkInfo NetworkInfoData `json:"network_info"`
}

// MetricsData contains system metrics
type MetricsData struct {
	CPUPercent         float64 `json:"cpu_percent"`
	RAMPercent         float64 `json:"ram_percent"`
	RAMUsedBytes       uint64  `json:"ram_used_bytes"`
	RAMTotalBytes      uint64  `json:"ram_total_bytes"`
	StoragePercent     float64 `json:"storage_percent"`
	StorageUsedBytes   uint64  `json:"storage_used_bytes"`
	StorageTotalBytes  uint64  `json:"storage_total_bytes"`
	UptimeSeconds      int     `json:"uptime_seconds"`
	NetworkStatus      string  `json:"network_status"`
	NetworkLatencyMs   float64 `json:"network_latency_ms"`
	PingLatencyMs      float64 `json:"ping_latency_ms"`
	ErrorCount         int     `json:"error_count"`
	GatewayReachable   *bool   `json:"gateway_reachable,omitempty"`
	DNSWorking         *bool   `json:"dns_working,omitempty"`
	InternetReachable  *bool   `json:"internet_reachable,omitempty"`
	DefaultGateway     string  `json:"default_gateway,omitempty"`
	DiskHealthStatus   string  `json:"disk_health_status"`
	DiskTemperatureC   float64 `json:"disk_temperature_c"`
	Timestamp          string  `json:"timestamp"`
}

// LocationData represents GPS/WiFi location (hanya dikirim jika valid)
type LocationData struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	City           string  `json:"city,omitempty"`
	Country        string  `json:"country,omitempty"`
	Timestamp      string  `json:"timestamp"`
}

// NetworkInfoData contains network information
type NetworkInfoData struct {
	WiFiSSID         string   `json:"wifi_ssid"`
	WiFiSignalDBM    int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps float64  `json:"network_speed_mbps"`
	IPAddresses      []string `json:"ip_addresses"`
	WiFiIP           string   `json:"wifi_ip,omitempty"`
	GatewayIP        string   `json:"gateway_ip,omitempty"`
}

// HeartbeatResponse represents the server response
type HeartbeatResponse struct {
	OK              bool   `json:"ok"`
	ServerTime      string `json:"server_time"`
	UpdateAvailable bool   `json:"update_available,omitempty"`
	UpdateVersion   string `json:"update_version,omitempty"`
	UpdateURL       string `json:"update_url,omitempty"`
}

// RegisterPayload represents the registration data
type RegisterPayload struct {
	AgentID           string   `json:"agent_id"`
	Hostname          string   `json:"hostname"`
	APIKey            string   `json:"api_key"`
	OS                string   `json:"os"`
	OSVersion         string   `json:"os_version"`
	AgentVersion      string   `json:"agent_version"`
	MACAddresses      []string `json:"mac_addresses"`
	IPAddresses       []string `json:"ip_addresses"`
	CPUModel          string   `json:"cpu_model"`
	CPUCores          int      `json:"cpu_cores"`
	RAMTotalBytes     uint64   `json:"ram_total_bytes"`
	StorageTotalBytes uint64   `json:"storage_total_bytes"`
	DiskModel         string   `json:"disk_model"`
	DiskType          string   `json:"disk_type"`
}

// Client handles HTTP communication with server
type Client struct {
	serverURL  string
	apiKey     string
	version    string
	httpClient *http.Client
}

// NewClient creates a new API client
func NewClient(serverURL, apiKey, version string) *Client {
	return &Client{
		serverURL: serverURL,
		apiKey:    apiKey,
		version:   version,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// Register sends registration payload to server
func (c *Client) Register(agentID, hostname string) error {
	// Implementation register...
	// Untuk sekarang return nil karena register sudah di-handle di main.go
	return nil
}

// Heartbeat sends heartbeat data to server
func (c *Client) Heartbeat(payload *HeartbeatPayload) (*HeartbeatResponse, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	resp, err := c.httpClient.Post(
		c.serverURL+"/api/agent/heartbeat",
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("server returned %d: %s", resp.StatusCode, string(respBody))
	}

	var heartbeatResp HeartbeatResponse
	if err := json.NewDecoder(resp.Body).Decode(&heartbeatResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &heartbeatResp, nil
}

// DownloadAndApplyUpdate downloads and applies agent update
func (c *Client) DownloadAndApplyUpdate(version, url string) {
	// Implementation auto-update...
	// Akan diimplementasikan terpisah
	fmt.Printf("Update to %s would be downloaded from %s\n", version, url)
}