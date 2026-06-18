package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"perimeterpulse-agent/commands"
)

type Client struct {
	serverURL string
	apiKey    string
	hostname  string
	http      *http.Client
}

func NewClient(serverURL, apiKey, hostname string) *Client {
	return &Client{
		serverURL: serverURL,
		apiKey:    apiKey,
		hostname:  hostname,
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type HeartbeatPayload struct {
	AgentID     string `json:"agent_id"`
	APIKey      string `json:"api_key"`
	Hostname    string `json:"hostname,omitempty"`
	Metrics     any    `json:"metrics"`
	Location    any    `json:"location"`
	NetworkInfo any    `json:"network_info"`
}

func (c *Client) SendHeartbeat(agentID string, metrics, network, location any) error {
	payload := HeartbeatPayload{
		AgentID:     agentID,
		APIKey:      c.apiKey,
		Hostname:    c.hostname,
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

type CommandInfo struct {
	ID        int    `json:"id"`
	Command   string `json:"command"`
	CreatedAt string `json:"created_at"`
}

type FetchCommandsResponse struct {
	Commands []CommandInfo `json:"commands"`
}

func (c *Client) FetchCommands(agentID string) ([]CommandInfo, error) {
	url := fmt.Sprintf("%s/api/agent/commands?agent_id=%s&api_key=%s",
		c.serverURL, agentID, c.apiKey)

	resp, err := c.http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("fetch commands: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("fetch commands rejected (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var result FetchCommandsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode commands: %w", err)
	}
	return result.Commands, nil
}

type commandReport struct {
	AgentID  string `json:"agent_id"`
	APIKey   string `json:"api_key"`
	Action   string `json:"action"`
	Output   string `json:"output,omitempty"`
	Error    string `json:"error,omitempty"`
	ExitCode int    `json:"exit_code,omitempty"`
}

func (c *Client) ReportCommandStart(agentID string, commandID int) error {
	return c.reportCommand(agentID, commandID, "start", nil)
}

func (c *Client) ReportCommandResult(agentID string, commandID int, result commands.ExecResult) error {
	action := "complete"
	if result.ExitCode != 0 {
		action = "fail"
	}
	return c.reportCommand(agentID, commandID, action, &result)
}

func (c *Client) reportCommand(agentID string, commandID int, action string, result *commands.ExecResult) error {
	report := commandReport{
		AgentID: agentID,
		APIKey:  c.apiKey,
		Action:  action,
	}
	if result != nil {
		report.Output = result.Output
		report.Error = result.Error
		report.ExitCode = result.ExitCode
	}

	body, err := json.Marshal(report)
	if err != nil {
		return fmt.Errorf("marshal command report: %w", err)
	}

	url := fmt.Sprintf("%s/api/agent/commands/%d", c.serverURL, commandID)
	resp, err := c.http.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("report command: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("command report rejected (HTTP %d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

type UpdateResponse struct {
	Version     string `json:"version"`
	DownloadURL string `json:"download_url"`
}

func (c *Client) CheckUpdate(agentID string, currentVersion string, currentOS string) (string, string, error) {
	url := fmt.Sprintf("%s/api/agent/update?agent_id=%s&api_key=%s&os=%s",
		c.serverURL, agentID, c.apiKey, currentOS)

	resp, err := c.http.Get(url)
	if err != nil {
		return "", "", fmt.Errorf("check update: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return "", "", fmt.Errorf("check update rejected (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var update UpdateResponse
	if err := json.NewDecoder(resp.Body).Decode(&update); err != nil {
		return "", "", fmt.Errorf("decode update: %w", err)
	}

	if update.Version == "" || update.DownloadURL == "" {
		return "", "", nil
	}

	if compareVersion(update.Version, currentVersion) <= 0 {
		return "", "", nil
	}

	return update.Version, update.DownloadURL, nil
}

func compareVersion(a, b string) int {
	partsA := splitVersion(a)
	partsB := splitVersion(b)
	for i := 0; i < 3; i++ {
		if partsA[i] > partsB[i] {
			return 1
		}
		if partsA[i] < partsB[i] {
			return -1
		}
	}
	return 0
}

func splitVersion(v string) [3]int {
	var parts [3]int
	n, _ := fmt.Sscanf(v, "%d.%d.%d", &parts[0], &parts[1], &parts[2])
	if n < 1 {
		parts[0] = 0
	}
	return parts
}

func (c *Client) DownloadUpdate(downloadURL string) (string, error) {
	resp, err := c.http.Get(downloadURL)
	if err != nil {
		return "", fmt.Errorf("download update: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("download update rejected (HTTP %d)", resp.StatusCode)
	}

	tmpFile, err := os.CreateTemp("", "pulse-agent-update-*")
	if err != nil {
		return "", fmt.Errorf("create temp file: %w", err)
	}
	defer tmpFile.Close()

	if _, err := io.Copy(tmpFile, resp.Body); err != nil {
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("write update: %w", err)
	}

	return tmpFile.Name(), nil
}