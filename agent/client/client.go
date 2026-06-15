package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// HeartbeatPayload is the JSON body sent to POST /api/agent/heartbeat
type HeartbeatPayload struct {
	AgentID     string      `json:"agent_id"`
	APIKey      string      `json:"api_key"`
	Hostname    string      `json:"hostname"`
	Metrics     interface{} `json:"metrics,omitempty"`
	Location    interface{} `json:"location,omitempty"`
	NetworkInfo interface{} `json:"network_info,omitempty"`
}

// RegisterPayload is the JSON body sent to POST /api/agent/register
type RegisterPayload struct {
	Hostname          string   `json:"hostname"`
	OS                string   `json:"os"`
	OSVersion         string   `json:"os_version"`
	AgentVersion      string   `json:"agent_version"`
	APIKey            string   `json:"api_key"`
	MACAddresses      []string `json:"mac_addresses"`
	IPAddresses       []string `json:"ip_addresses,omitempty"`
	AgentID           string   `json:"agent_id,omitempty"`
	CPUModel          string   `json:"cpu_model"`
	CPUCores          int      `json:"cpu_cores,omitempty"`
	RAMTotalBytes     int64    `json:"ram_total_bytes"`
	StorageTotalBytes int64    `json:"storage_total_bytes"`
	DiskModel         string   `json:"disk_model,omitempty"`
	DiskType          string   `json:"disk_type,omitempty"`
	WifiSSID          string   `json:"wifi_ssid,omitempty"`
	WifiSignalDBm     int      `json:"wifi_signal_dbm,omitempty"`
	NetworkSpeedMbps  int      `json:"network_speed_mbps,omitempty"`
}

// CommandPayload is the JSON body for command action responses
type CommandPayload struct {
	AgentID  string `json:"agent_id"`
	APIKey   string `json:"api_key"`
	Action   string `json:"action"`
	Output   string `json:"output,omitempty"`
	Error    string `json:"error,omitempty"`
	ExitCode int    `json:"exit_code,omitempty"`
}

// Client communicates with the PerimeterPulse server API.
type Client struct {
	ServerURL string
	APIKey    string
	AgentID   string
	Hostname  string
	client    *http.Client
}

// New creates a new API client.
func New(serverURL, apiKey, agentID, hostname string) *Client {
	return &Client{
		ServerURL: serverURL,
		APIKey:    apiKey,
		AgentID:   agentID,
		Hostname:  hostname,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SendHeartbeat sends a heartbeat to the server.
func (c *Client) SendHeartbeat(metrics, location, networkInfo interface{}) error {
	payload := HeartbeatPayload{
		AgentID:     c.AgentID,
		APIKey:      c.APIKey,
		Hostname:    c.Hostname,
		Metrics:     metrics,
		Location:    location,
		NetworkInfo: networkInfo,
	}
	return c.post("/api/agent/heartbeat", payload)
}

// Register registers the agent with the server.
func (c *Client) Register(reg RegisterPayload) error {
	reg.APIKey = c.APIKey
	reg.AgentID = c.AgentID
	return c.post("/api/agent/register", reg)
}

// SendCommandResponse reports the result of a command execution.
func (c *Client) SendCommandResponse(commandID int, payload CommandPayload) error {
	payload.AgentID = c.AgentID
	payload.APIKey = c.APIKey
	return c.post(fmt.Sprintf("/api/agent/commands/%d", commandID), payload)
}

// FetchPendingCommands retrieves pending commands for this agent.
func (c *Client) FetchPendingCommands() ([]interface{}, error) {
	url := fmt.Sprintf("%s/api/agent/commands?agent_id=%s&api_key=%s", c.ServerURL, c.AgentID, c.APIKey)
	resp, err := c.client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("commands fetch failed (%d): %s", resp.StatusCode, string(body))
	}
	var result struct {
		Commands []interface{} `json:"commands"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Commands, nil
}

// CheckForUpdate checks if a newer agent version is available.
func (c *Client) CheckForUpdate(agentOS string) (version string, downloadURL string, err error) {
	url := fmt.Sprintf("%s/api/agent/update?agent_id=%s&api_key=%s&os=%s", c.ServerURL, c.AgentID, c.APIKey, agentOS)
	resp, err := c.client.Get(url)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	var result struct {
		Version     string `json:"version"`
		DownloadURL string `json:"download_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", err
	}
	return result.Version, result.DownloadURL, nil
}

func (c *Client) post(path string, body interface{}) error {
	jsonBytes, err := json.Marshal(body)
	if err != nil {
		return err
	}
	url := c.ServerURL + path
	resp, err := c.client.Post(url, "application/json", bytes.NewReader(jsonBytes))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error (%d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}