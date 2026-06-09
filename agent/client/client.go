package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"runtime"
	"time"

	"agent/collector"
)

type Client struct {
	serverURL string
	apiKey    string
	hostname  string
	agentID   string
	http      *http.Client
}

func New(serverURL, apiKey, hostname string) *Client {
	return &Client{
		serverURL: serverURL,
		apiKey:    apiKey,
		hostname:  hostname,
		http: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (c *Client) Register() error {
	info := collector.CollectInfo(c.apiKey)

	body, err := json.Marshal(info)
	if err != nil {
		return fmt.Errorf("marshal register payload: %w", err)
	}

	resp, err := c.http.Post(c.serverURL+"/api/agent/register", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("register request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("register failed (status %d): %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		OK      bool   `json:"ok"`
		AgentID string `json:"agent_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("Register decode warning: %v", err)
	}

	if result.AgentID != "" {
		c.agentID = result.AgentID
	} else {
		c.agentID = c.hostname + "-" + runtime.GOOS
	}

	log.Printf("Registered, agent_id: %s", c.agentID)
	return nil
}

func (c *Client) Heartbeat(metrics *collector.Metrics, location *collector.Location, network *collector.NetworkInfo) error {
	if c.agentID == "" {
		return fmt.Errorf("not registered yet")
	}

	payload := struct {
		AgentID     string                `json:"agent_id"`
		APIKey      string                `json:"api_key"`
		Metrics     *collector.Metrics    `json:"metrics,omitempty"`
		Location    *collector.Location   `json:"location,omitempty"`
		NetworkInfo *collector.NetworkInfo `json:"network_info,omitempty"`
	}{
		AgentID:     c.agentID,
		APIKey:      c.apiKey,
		Metrics:     metrics,
		Location:    location,
		NetworkInfo: network,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal heartbeat: %w", err)
	}

	resp, err := c.http.Post(c.serverURL+"/api/agent/heartbeat", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("heartbeat request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("heartbeat failed (status %d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}
