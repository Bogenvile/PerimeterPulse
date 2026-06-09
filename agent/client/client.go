package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	ServerURL string
	APIKey    string
	httpClient *http.Client
}

func NewClient(serverURL, apiKey string) *Client {
	return &Client{
		ServerURL: serverURL,
		APIKey:    apiKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// RegisterPayload untuk agent registration
type RegisterPayload struct {
	Hostname          string   `json:"hostname"`
	OS                string   `json:"os"`
	OSVersion         string   `json:"os_version"`
	AgentVersion      string   `json:"agent_version"`
	APIKey            string   `json:"api_key"`
	MacAddresses      []string `json:"mac_addresses"`
	CPUModel          string   `json:"cpu_model"`
	CPUCores          int      `json:"cpu_cores"`
	RAMTotalBytes     uint64   `json:"ram_total_bytes"`
	StorageTotalBytes uint64   `json:"storage_total_bytes"`
}

type RegisterResponse struct {
	OK      bool   `json:"ok"`
	AgentID string `json:"agent_id"`
}

// HeartbeatMetrics untuk metrics data
type HeartbeatMetrics struct {
	CPUPercent       float64 `json:"cpu_percent"`
	RAMPercent       float64 `json:"ram_percent"`
	RAMUsedBytes     uint64  `json:"ram_used_bytes"`
	RAMTotalBytes    uint64  `json:"ram_total_bytes"`
	StoragePercent   float64 `json:"storage_percent"`
	StorageUsedBytes uint64  `json:"storage_used_bytes"`
	StorageTotalBytes uint64 `json:"storage_total_bytes"`
	UptimeSeconds    uint64  `json:"uptime_seconds"`
	NetworkStatus    string  `json:"network_status"`
	NetworkLatencyMs float64 `json:"network_latency_ms"`
	DiskHealthStatus string  `json:"disk_health_status"`
	DiskTemperatureC int     `json:"disk_temperature_c"`
	Timestamp        string  `json:"timestamp"`
}

// HeartbeatNetworkInfo untuk network data
type HeartbeatNetworkInfo struct {
	WifiSSID         string   `json:"wifi_ssid"`
	WifiSignalDBM    int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps float64  `json:"network_speed_mbps"`
	IPAddresses      []string `json:"ip_addresses"`
}

// HeartbeatLocation untuk location data
type HeartbeatLocation struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	AccuracyM float64 `json:"accuracy_meters"`
	Source    string  `json:"source"`
	Timestamp string  `json:"timestamp"`
}

// HeartbeatPayload untuk agent heartbeat
type HeartbeatPayload struct {
	AgentID     string                 `json:"agent_id"`
	APIKey      string                 `json:"api_key"`
	Metrics     *HeartbeatMetrics      `json:"metrics,omitempty"`
	NetworkInfo *HeartbeatNetworkInfo  `json:"network_info,omitempty"`
	Location    *HeartbeatLocation     `json:"location,omitempty"`
}

// Register sends initial registration to server
func (c *Client) Register(payload RegisterPayload) (string, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	resp, err := c.post("/api/agent/register", data)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("register failed: %d %s", resp.StatusCode, string(body))
	}

	var result RegisterResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	return result.AgentID, nil
}

// Heartbeat sends a heartbeat payload to server
func (c *Client) Heartbeat(payload HeartbeatPayload) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := c.post("/api/agent/heartbeat", data)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("heartbeat failed: %d %s", resp.StatusCode, string(body))
	}

	return nil
}

// SendRaw sends raw JSON payload (for buffer replay)
func (c *Client) SendRaw(data []byte) error {
	resp, err := c.post("/api/agent/heartbeat", data)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("send raw failed: %d %s", resp.StatusCode, string(body))
	}

	return nil
}

// post helper
func (c *Client) post(path string, data []byte) (*http.Response, error) {
	url := c.ServerURL + path
	req, err := http.NewRequest("POST", url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	return c.httpClient.Do(req)
}