package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/perimeterpulse/agent/collector"
)

// Client handles HTTPS communication with the PerimeterPulse server.
type Client struct {
	serverURL string
	apiKey    string
	client    *http.Client
}

// HeartbeatPayload is the JSON body sent to /api/agent/heartbeat.
type HeartbeatPayload struct {
	AgentID     string                `json:"agent_id"`
	APIKey      string                `json:"api_key"`
	Metrics     *collector.Metrics    `json:"metrics,omitempty"`
	Location    *LocationData         `json:"location,omitempty"`
	NetworkInfo *collector.NetworkInfo `json:"network_info,omitempty"`
}

// LocationData wraps location info for the heartbeat payload.
type LocationData struct {
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	AccuracyMeters float64 `json:"accuracy_meters"`
	Source         string  `json:"source"`
	Timestamp      string  `json:"timestamp"`
}

// NewClient creates a new PerimeterPulse API client.
func NewClient(serverURL, apiKey string) *Client {
	return &Client{
		serverURL: serverURL,
		apiKey:    apiKey,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Register sends the initial registration payload to /api/agent/register.
func (c *Client) Register(info collector.SystemInfo) (string, error) {
	payload := struct {
		collector.SystemInfo
		APIKey string `json:"api_key"`
	}{
		SystemInfo: info,
		APIKey:     c.apiKey,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("register: marshal: %w", err)
	}

	resp, err := c.client.Post(
		c.serverURL+"/api/agent/register",
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return "", fmt.Errorf("register: request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("register: server returned %d", resp.StatusCode)
	}

	var result struct {
		OK      bool   `json:"ok"`
		AgentID string `json:"agent_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("register: decode: %w", err)
	}

	if result.AgentID == "" {
		return "", fmt.Errorf("register: empty agent_id in response")
	}

	return result.AgentID, nil
}

// SendHeartbeat sends metrics, location, and network info to the server.
func (c *Client) SendHeartbeat(payload HeartbeatPayload) error {
	payload.APIKey = c.apiKey

	if payload.Location != nil && payload.Location.Timestamp == "" {
		payload.Location.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}
	if payload.Metrics != nil && payload.Metrics.Timestamp == "" {
		payload.Metrics.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("heartbeat: marshal: %w", err)
	}

	resp, err := c.client.Post(
		c.serverURL+"/api/agent/heartbeat",
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("heartbeat: request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("heartbeat: server returned %d", resp.StatusCode)
	}

	log.Printf("Heartbeat sent successfully (status: %d)", resp.StatusCode)
	return nil
}