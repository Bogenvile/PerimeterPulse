package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"perimeterpulse-agent/collector"
)

// Client handles communication with the PerimeterPulse server
type Client struct {
	serverURL string
	apiKey    string
	agentID   string
	http      *http.Client
}

// HeartbeatPayload contains data sent in a heartbeat
type HeartbeatPayload struct {
	Metrics     collector.MetricsData   `json:"metrics"`
	NetworkInfo collector.NetworkInfo   `json:"network_info"`
	Location    *collector.LocationData `json:"location,omitempty"`
}

// NewClient creates a new API client
func NewClient(serverURL, apiKey, agentID string) *Client {
	return &Client{
		serverURL: serverURL,
		apiKey:    apiKey,
		agentID:   agentID,
		http: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// Register sends registration data to the server
func (c *Client) Register(info collector.SystemInfo, osInfo collector.OSInfo, version string) error {
	payload := collector.RegistrationPayload{
		Hostname:          info.Hostname,
		OS:                osInfo.OS,
		OSVersion:         osInfo.OSVersion,
		AgentVersion:      version,
		MACAddresses:      info.MACAddresses,
		IPAddresses:       info.IPAddresses,
		CPUModel:          info.CPUModel,
		CPUCores:          info.CPUCores,
		RAMTotalBytes:     info.RAMTotalBytes,
		StorageTotalBytes: info.StorageTotalBytes,
		DiskModel:         info.DiskModel,
		DiskType:          info.DiskType,
		WiFiSSID:          info.WiFiSSID,
		WiFiSignalDBM:     info.WiFiSignalDBM,
		NetworkSpeedMbps:  info.NetworkSpeedMbps,
	}
	return c.post("/api/agent/register", payload)
}

// SendHeartbeat sends a heartbeat to the server
func (c *Client) SendHeartbeat(payload HeartbeatPayload) error {
	return c.post("/api/agent/heartbeat", payload)
}

func (c *Client) post(path string, payload interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	url := c.serverURL + path
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("server returned %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}