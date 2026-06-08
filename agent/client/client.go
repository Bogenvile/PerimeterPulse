package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/perimeterpulse/agent/collector"
)

// Client handles HTTPS communication with the PerimeterPulse server.
type Client struct {
	serverURL string
	apiKey    string
	http      *http.Client
}

// HeartbeatPayload is the JSON body sent to POST /api/agent/heartbeat
type HeartbeatPayload struct {
	AgentID     string                    `json:"agent_id"`
	APIKey      string                    `json:"api_key"`
	Metrics     collector.Metrics         `json:"metrics"`
	Location    collector.Location        `json:"location"`
	NetworkInfo collector.NetworkInfo     `json:"network_info"`
}

// New creates a new API client.
func New(serverURL, apiKey string) *Client {
	return &Client{
		serverURL: serverURL,
		apiKey:    apiKey,
		http: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// APIKey returns the client's API key.
func (c *Client) APIKey() string {
	return c.apiKey
}

// Register sends the agent registration payload.
func (c *Client) Register(payload collector.RegistrationInfo) (string, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("register marshal: %w", err)
	}

	resp, err := c.http.Post(
		c.serverURL+"/api/agent/register",
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return "", fmt.Errorf("register request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("register failed: status=%d body=%s", resp.StatusCode, string(respBody))
	}

	var result struct {
		OK      bool   `json:"ok"`
		AgentID string `json:"agent_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("register decode: %w", err)
	}

	return result.AgentID, nil
}

// SendHeartbeat sends a metrics + location + network heartbeat to the server.
func (c *Client) SendHeartbeat(payload HeartbeatPayload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("heartbeat marshal: %w", err)
	}

	resp, err := c.http.Post(
		c.serverURL+"/api/agent/heartbeat",
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("heartbeat request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("heartbeat failed: status=%d body=%s", resp.StatusCode, string(respBody))
	}

	return nil
}
