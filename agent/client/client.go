package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	BaseURL string
	APIKey  string
	HTTP    *http.Client
}

func NewClient(baseURL, apiKey string) *Client {
	baseURL = strings.TrimSuffix(baseURL, "/")
	return &Client{
		BaseURL: baseURL,
		APIKey:  apiKey,
		HTTP:    &http.Client{Timeout: 15 * time.Second},
	}
}

// ──── Register ────

type RegisterPayload struct {
	Hostname         string   `json:"hostname"`
	OS               string   `json:"os"`
	OSVersion        string   `json:"os_version,omitempty"`
	AgentVersion     string   `json:"agent_version"`
	MacAddresses     []string `json:"mac_addresses,omitempty"`
	IPAddresses      []string `json:"ip_addresses,omitempty"`
	CPUModel         string   `json:"cpu_model,omitempty"`
	CPUCores         int      `json:"cpu_cores,omitempty"`
	RAMTotalBytes    uint64   `json:"ram_total_bytes,omitempty"`
	StorageTotalBytes uint64  `json:"storage_total_bytes,omitempty"`
	DiskModel        string   `json:"disk_model,omitempty"`
	DiskType         string   `json:"disk_type,omitempty"`
	WifiSSID         string   `json:"wifi_ssid,omitempty"`
	WifiSignalDBM    int      `json:"wifi_signal_dbm,omitempty"`
	NetworkSpeedMbps float64  `json:"network_speed_mbps,omitempty"`
}

func (c *Client) Register(payload RegisterPayload) (string, error) {
	body := map[string]interface{}{
		"hostname":      payload.Hostname,
		"os":            payload.OS,
		"os_version":    payload.OSVersion,
		"agent_version": payload.AgentVersion,
		"api_key":       c.APIKey,
	}

	if len(payload.MacAddresses) > 0 {
		body["mac_addresses"] = payload.MacAddresses
	}
	if len(payload.IPAddresses) > 0 {
		body["ip_addresses"] = payload.IPAddresses
	}
	if payload.CPUModel != "" {
		body["cpu_model"] = payload.CPUModel
	}
	if payload.CPUCores > 0 {
		body["cpu_cores"] = payload.CPUCores
	}
	if payload.RAMTotalBytes > 0 {
		body["ram_total_bytes"] = payload.RAMTotalBytes
	}
	if payload.StorageTotalBytes > 0 {
		body["storage_total_bytes"] = payload.StorageTotalBytes
	}
	if payload.DiskModel != "" {
		body["disk_model"] = payload.DiskModel
	}
	if payload.DiskType != "" {
		body["disk_type"] = payload.DiskType
	}
	if payload.WifiSSID != "" {
		body["wifi_ssid"] = payload.WifiSSID
	}
	// Always send wifi_signal_dbm, even if 0 (server handles this)
	body["wifi_signal_dbm"] = payload.WifiSignalDBM
	if payload.NetworkSpeedMbps > 0 {
		body["network_speed_mbps"] = payload.NetworkSpeedMbps
	}

	resp, err := c.post("/api/agent/register", body)
	if err != nil {
		return "", err
	}

	var result struct {
		AgentID string `json:"agent_id"`
		OK      bool   `json:"ok"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		return "", fmt.Errorf("parse response: %w", err)
	}
	return result.AgentID, nil
}

// ──── Heartbeat ────

type HeartbeatMetrics struct {
	CPUPercent        float64 `json:"cpu_percent"`
	RAMPercent        float64 `json:"ram_percent"`
	RAMUsedBytes      uint64  `json:"ram_used_bytes"`
	RAMTotalBytes     uint64  `json:"ram_total_bytes"`
	StoragePercent    float64 `json:"storage_percent"`
	StorageUsedBytes  uint64  `json:"storage_used_bytes"`
	StorageTotalBytes uint64  `json:"storage_total_bytes"`
	UptimeSeconds     uint64  `json:"uptime_seconds"`
	NetworkStatus     string  `json:"network_status"`
	NetworkLatencyMs  float64 `json:"network_latency_ms"`
	DiskHealthStatus  string  `json:"disk_health_status,omitempty"`
	DiskTemperatureC  int     `json:"disk_temperature_c,omitempty"`
	Timestamp         string  `json:"timestamp"`
}

type HeartbeatLocation struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Accuracy  float64 `json:"accuracy_meters"`
	Source    string  `json:"source"`
	Timestamp string  `json:"timestamp"`
}

type HeartbeatNetworkInfo struct {
	WifiSSID         string   `json:"wifi_ssid"`
	WifiSignalDBM    int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps float64  `json:"network_speed_mbps"`
	IPAddresses      []string `json:"ip_addresses"`
}

type HeartbeatPayload struct {
	AgentID     string                `json:"agent_id"`
	Metrics     *HeartbeatMetrics     `json:"metrics,omitempty"`
	Location    *HeartbeatLocation    `json:"location,omitempty"`
	NetworkInfo *HeartbeatNetworkInfo `json:"network_info,omitempty"`
}

func (c *Client) SendHeartbeat(payload HeartbeatPayload) error {
	body := map[string]interface{}{
		"agent_id": payload.AgentID,
		"api_key":  c.APIKey,
	}

	if payload.Metrics != nil {
		body["metrics"] = payload.Metrics
	}
	if payload.Location != nil {
		body["location"] = payload.Location
	}
	if payload.NetworkInfo != nil {
		body["network_info"] = payload.NetworkInfo
	}

	_, err := c.post("/api/agent/heartbeat", body)
	if err != nil {
		return err
	}

	return nil
}

// ──── Helpers ────

func (c *Client) post(path string, data interface{}) ([]byte, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	url := c.BaseURL + path
	resp, err := c.HTTP.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("server error %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}