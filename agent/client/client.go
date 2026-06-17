package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client communicates with the PerimeterPulse server.
type Client struct {
	serverURL string
	apiKey    string
	http      *http.Client
}

// NewClient creates a new API client.
func NewClient(serverURL, apiKey string) *Client {
	return &Client{
		serverURL: serverURL,
		apiKey:    apiKey,
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// HeartbeatPayload is the JSON body sent to /api/agent/heartbeat.
type HeartbeatPayload struct {
	AgentID     string        `json:"agent_id"`
	APIKey      string        `json:"api_key"`
	Hostname    string        `json:"hostname,omitempty"`
	Metrics     any           `json:"metrics"`
	Location    any           `json:"location"`
	NetworkInfo any           `json:"network_info"`
}

// SendHeartbeat sends metrics, network, and location data to the server.
func (c *Client) SendHeartbeat(agentID string, metrics, network, location any) error {
	payload := HeartbeatPayload{
		AgentID:     agentID,
		APIKey:      c.apiKey,
		Metrics:     metrics,
		NetworkInfo: network,
		Location:    location,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal heartbeat: %w", err)
	}

	resp, err := c.http.Post(
		c.serverURL+"/api/agent/heartbeat",
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("post heartbeat: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("heartbeat rejected (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}