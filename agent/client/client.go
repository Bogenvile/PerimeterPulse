package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"perimeterpulse-agent/collector"
	"time"
)

type Client struct {
	ServerURL string
	APIKey    string
	HTTP      *http.Client
}

func NewClient(serverURL, apiKey string) *Client {
	return &Client{
		ServerURL: serverURL,
		APIKey:    apiKey,
		HTTP:      &http.Client{Timeout: 10 * time.Second},
	}
}

type HeartbeatPayload struct {
	AgentID  string                 `json:"agent_id"`
	APIKey   string                 `json:"api_key"`
	Metrics  collector.Metrics      `json:"metrics"`
	Network  collector.NetworkInfo  `json:"network_info"`
	Location collector.LocationData `json:"location"`
}

func (c *Client) SendHeartbeat(agentID string, metrics collector.Metrics, netInfo collector.NetworkInfo, location collector.LocationData) error {
	payload := HeartbeatPayload{
		AgentID:  agentID,
		APIKey:   c.APIKey,
		Metrics:  metrics,
		Network:  netInfo,
		Location: location,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequest("POST", c.ServerURL+"/api/agent/heartbeat", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("heartbeat request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp struct{ Message string }
		json.NewDecoder(resp.Body).Decode(&errResp)
		return fmt.Errorf("server error %d: %s", resp.StatusCode, errResp.Message)
	}
	return nil
}