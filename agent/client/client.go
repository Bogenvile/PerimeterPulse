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
	serverURL string
	apiKey    string
	agentID   string
	hostname  string
	http      *http.Client
}

type RegisterPayload struct {
	Hostname          string   `json:"hostname"`
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
	WifiSSID          string   `json:"wifi_ssid"`
	WifiSignalDBm     int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps  int      `json:"network_speed_mbps"`
}

type CommandPayload struct {
	Action   string `json:"action"`
	Output   string `json:"output,omitempty"`
	Error    string `json:"error,omitempty"`
	ExitCode int    `json:"exit_code,omitempty"`
}

func New(serverURL, apiKey, agentID, hostname string) *Client {
	return &Client{
		serverURL: serverURL,
		apiKey:    apiKey,
		agentID:   agentID,
		hostname:  hostname,
		http:      &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) post(path string, body interface{}) (*http.Response, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	url := c.serverURL + path
	req, err := http.NewRequest("POST", url, bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	return c.http.Do(req)
}

func (c *Client) Register(payload RegisterPayload) error {
	payloadMap := map[string]interface{}{
		"agent_id":      c.agentID,
		"api_key":       c.apiKey,
		"hostname":      payload.Hostname,
		"os":            payload.OS,
		"os_version":    payload.OSVersion,
		"agent_version": payload.AgentVersion,
		"mac_addresses": payload.MACAddresses,
		"ip_addresses":  payload.IPAddresses,
		"cpu_model":     payload.CPUModel,
		"cpu_cores":     payload.CPUCores,
		"ram_total_bytes":   payload.RAMTotalBytes,
		"storage_total_bytes": payload.StorageTotalBytes,
		"disk_model":    payload.DiskModel,
		"disk_type":     payload.DiskType,
		"wifi_ssid":     payload.WifiSSID,
		"wifi_signal_dbm": payload.WifiSignalDBm,
		"network_speed_mbps": payload.NetworkSpeedMbps,
	}

	resp, err := c.post("/api/agent/register", payloadMap)
	if err != nil {
		return fmt.Errorf("register request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("register failed (%d): %s", resp.StatusCode, string(bodyBytes))
	}
	return nil
}

func (c *Client) SendHeartbeat(metrics, location, network interface{}) error {
	payload := map[string]interface{}{
		"agent_id":     c.agentID,
		"api_key":      c.apiKey,
		"hostname":     c.hostname,
		"metrics":      metrics,
		"location":     location,
		"network_info": network,
	}

	resp, err := c.post("/api/agent/heartbeat", payload)
	if err != nil {
		return fmt.Errorf("heartbeat request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("heartbeat failed (%d): %s", resp.StatusCode, string(bodyBytes))
	}
	return nil
}

func (c *Client) FetchPendingCommands() ([]interface{}, error) {
	url := fmt.Sprintf("%s/api/agent/commands?agent_id=%s&api_key=%s", c.serverURL, c.agentID, c.apiKey)
	resp, err := c.http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("fetch commands: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("fetch commands failed (%d)", resp.StatusCode)
	}

	var result struct {
		Commands []interface{} `json:"commands"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode commands: %w", err)
	}
	return result.Commands, nil
}

func (c *Client) SendCommandResponse(cmdID int, payload CommandPayload) error {
	payloadMap := map[string]interface{}{
		"agent_id":  c.agentID,
		"api_key":   c.apiKey,
		"action":    payload.Action,
		"output":    payload.Output,
		"error":     payload.Error,
		"exit_code": payload.ExitCode,
	}

	url := fmt.Sprintf("%s/api/agent/commands/%d", c.serverURL, cmdID)
	data, _ := json.Marshal(payloadMap)
	req, err := http.NewRequest("POST", url, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (c *Client) CheckForUpdate(osName string) (version string, downloadURL string, err error) {
	url := fmt.Sprintf("%s/api/agent/update?agent_id=%s&api_key=%s&os=%s", c.serverURL, c.agentID, c.apiKey, osName)
	resp, err := c.http.Get(url)
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