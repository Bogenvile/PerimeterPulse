package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type Client struct {
	ServerURL string
	APIKey    string
	AgentID   string
}

// NewClient now requires agentID
func NewClient(serverURL, apiKey, agentID string) *Client {
	return &Client{
		ServerURL: serverURL,
		APIKey:    apiKey,
		AgentID:   agentID,
	}
}

type HeartbeatPayload struct {
	AgentID     string      `json:"agent_id"`
	APIKey      string      `json:"api_key"`
	Metrics     interface{} `json:"metrics"`
	Location    interface{} `json:"location"`
	NetworkInfo interface{} `json:"network_info"`
}

type NetworkInfo struct {
	WiFiSSID         string   `json:"wifi_ssid"`
	WiFiSignalDBM    int      `json:"wifi_signal_dbm"`
	WiFiIP           string   `json:"wifi_ip"`
	IPAddresses      []string `json:"ip_addresses"`
	NetworkSpeedMbps int      `json:"network_speed_mbps"`
}

func (c *Client) Register(agentID string, hw interface{}) error {
	payloadData, err := json.Marshal(hw)
	if err != nil {
		return fmt.Errorf("failed to marshal hardware info: %w", err)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(payloadData, &payload); err != nil {
		return fmt.Errorf("failed to unmarshal hardware info: %w", err)
	}

	payload["api_key"] = c.APIKey
	
	finalPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal final payload: %w", err)
	}

	url := fmt.Sprintf("%s/api/agent/register", c.ServerURL)
	req, err := http.NewRequest("POST", url, bytes.NewReader(finalPayload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("register failed: %s", string(body))
	}
	return nil
}

func (c *Client) SendHeartbeat(payload HeartbeatPayload) error {
	// CRITICAL FIX: Ensure AgentID and APIKey are set from the client struct
	if payload.AgentID == "" {
		payload.AgentID = c.AgentID
	}
	if payload.APIKey == "" {
		payload.APIKey = c.APIKey
	}
	
	data, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/api/agent/heartbeat", c.ServerURL)
	
	resp, err := http.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("heartbeat failed with status %d: %s", resp.StatusCode, string(body))
	}
	return nil
}