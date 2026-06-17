package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type HeartbeatPayload struct {
	AgentID     string           `json:"agent_id"`
	ApiKey      string           `json:"api_key"`
	Hostname    string           `json:"hostname,omitempty"`
	Metrics     interface{}      `json:"metrics"`
	Location    interface{}      `json:"location"`
	NetworkInfo interface{}      `json:"network_info"`
}

type UpdateResponse struct {
	Version     string `json:"version"`
	DownloadURL string `json:"download_url"`
}

type CommandResponse struct {
	Commands []CommandItem `json:"commands"`
}

type CommandItem struct {
	ID        int    `json:"id"`
	Command   string `json:"command"`
	CreatedAt string `json:"created_at"`
}

type ApiClient struct {
	Server   string
	ApiKey   string
	AgentID  string
	Hostname string
	client   *http.Client
}

func New(server, apiKey, agentID, hostname string) *ApiClient {
	return &ApiClient{
		Server:   server,
		ApiKey:   apiKey,
		AgentID:  agentID,
		Hostname: hostname,
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (c *ApiClient) SendHeartbeat(metrics interface{}, location interface{}, networkInfo interface{}) error {
	payload := HeartbeatPayload{
		AgentID:     c.AgentID,
		ApiKey:      c.ApiKey,
		Hostname:    c.Hostname,
		Metrics:     metrics,
		Location:    location,
		NetworkInfo: networkInfo,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	// 🔍 Log the location part of the payload
	if locationMap, ok := location.(map[string]interface{}); ok {
		lat := locationMap["latitude"]
		lng := locationMap["longitude"]
		src := locationMap["source"]
		fmt.Printf("[client] Sending location: lat=%v lng=%v source=%v\n", lat, lng, src)
	} else {
		fmt.Printf("[client] Location object type: %T, value: %+v\n", location, location)
	}

	req, err := http.NewRequest("POST", c.Server+"/api/agent/heartbeat", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("heartbeat request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return fmt.Errorf("heartbeat returned %d: %s", resp.StatusCode, string(respBody))
	}

	fmt.Printf("[client] Heartbeat OK: %s\n", string(respBody))
	return nil
}

func (c *ApiClient) CheckUpdate(os string) (*UpdateResponse, error) {
	url := fmt.Sprintf("%s/api/agent/update?agent_id=%s&api_key=%s&os=%s",
		c.Server, c.AgentID, c.ApiKey, os)
	resp, err := c.client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("update check returned %d", resp.StatusCode)
	}
	var update UpdateResponse
	if err := json.NewDecoder(resp.Body).Decode(&update); err != nil {
		return nil, err
	}
	return &update, nil
}

func (c *ApiClient) FetchCommands() ([]CommandItem, error) {
	url := fmt.Sprintf("%s/api/agent/commands?agent_id=%s&api_key=%s",
		c.Server, c.AgentID, c.ApiKey)
	resp, err := c.client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("fetch commands returned %d", resp.StatusCode)
	}
	var cmdResp CommandResponse
	if err := json.NewDecoder(resp.Body).Decode(&cmdResp); err != nil {
		return nil, err
	}
	return cmdResp.Commands, nil
}

func (c *ApiClient) ReportCommandResult(commandID int, action, output, errorMsg string, exitCode int) error {
	payload := map[string]interface{}{
		"agent_id":  c.AgentID,
		"api_key":   c.ApiKey,
		"action":    action,
		"output":    output,
		"error":     errorMsg,
		"exit_code": exitCode,
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/api/agent/commands/%d", c.Server, commandID)
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("command result returned %d", resp.StatusCode)
	}
	return nil
}