package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// HTTPClient - Client untuk komunikasi dengan server
type HTTPClient struct {
	BaseURL    string
	HTTPClient *http.Client
}

// PendingCommand - Command yang menunggu eksekusi
type PendingCommand struct {
	ID        int    `json:"id"`
	Command   string `json:"command"`
	CreatedAt string `json:"created_at"`
}

// CommandStatusPayload - Payload untuk update status command
type CommandStatusPayload struct {
	AgentID  string `json:"agent_id"`
	APIKey   string `json:"api_key"`
	Action   string `json:"action"`
	Output   string `json:"output,omitempty"`
	Error    string `json:"error,omitempty"`
	ExitCode *int   `json:"exit_code,omitempty"`
}

// CommandResult - Hasil eksekusi command
type CommandResult struct {
	CommandID int
	Output    string
	Error     string
	ExitCode  int
	ExecTime  string
}

// NewHTTPClient membuat client baru
func NewHTTPClient(baseURL string) *HTTPClient {
	return &HTTPClient{
		BaseURL:    strings.TrimRight(baseURL, "/"),
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Register mendaftarkan agent ke server
func (c *HTTPClient) Register(payload any) error {
	url := fmt.Sprintf("%s/api/agent/register", c.BaseURL)
	body, _ := json.Marshal(payload)
	
	resp, err := c.HTTPClient.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("register failed: %s", string(respBody))
	}
	return nil
}

// Heartbeat mengirim heartbeat ke server
func (c *HTTPClient) Heartbeat(payload map[string]any) error {
	url := fmt.Sprintf("%s/api/agent/heartbeat", c.BaseURL)
	body, _ := json.Marshal(payload)

	resp, err := c.HTTPClient.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("heartbeat failed: %s", string(respBody))
	}
	return nil
}

// FetchPendingCommands mengambil command yang pending
func (c *HTTPClient) FetchPendingCommands(agentID, apiKey string) ([]PendingCommand, error) {
	url := fmt.Sprintf("%s/api/agent/commands?agent_id=%s&api_key=%s", c.BaseURL, agentID, apiKey)
	
	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch commands failed: %d", resp.StatusCode)
	}

	var result struct {
		Commands []PendingCommand `json:"commands"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Commands, nil
}

// ReportCommandStatus melaporkan status command ke server
func (c *HTTPClient) ReportCommandStatus(commandID int, agentID, apiKey string, payload CommandStatusPayload) error {
	url := fmt.Sprintf("%s/api/agent/commands/%d", c.BaseURL, commandID)
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("report command status failed: %s", string(respBody))
	}
	return nil
}

// CheckForUpdate memeriksa update baru
func (c *HTTPClient) CheckForUpdate(agentID, apiKey, os, arch string) (string, string, error) {
	url := fmt.Sprintf("%s/api/agent/update?agent_id=%s&api_key=%s&os=%s&arch=%s",
		c.BaseURL, agentID, apiKey, os, arch)

	resp, err := c.HTTPClient.Get(url)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("check update failed: %d", resp.StatusCode)
	}

	var result struct {
		Version    string `json:"version"`
		DownloadURL string `json:"download_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", err
	}
	return result.Version, result.DownloadURL, nil
}

// DownloadAndReplace mendownload dan mengganti binary
func (c *HTTPClient) DownloadAndReplace(downloadURL string) error {
	resp, err := c.HTTPClient.Get(downloadURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed: %d", resp.StatusCode)
	}

	// Create temp file
	tempFile, err := os.CreateTemp("", "agent-update-*")
	if err != nil {
		return err
	}
	defer tempFile.Close()

	// Download
	if _, err := io.Copy(tempFile, resp.Body); err != nil {
		os.Remove(tempFile.Name())
		return err
	}

	// Get current executable path
	execPath, err := os.Executable()
	if err != nil {
		return err
	}

	// Backup current binary
	backupPath := execPath + ".bak"
	if err := os.Rename(execPath, backupPath); err != nil {
		return fmt.Errorf("backup failed: %v", err)
	}

	// Replace with new binary
	if err := os.Rename(tempFile.Name(), execPath); err != nil {
		// Restore backup
		os.Rename(backupPath, execPath)
		return fmt.Errorf("replace failed: %v", err)
	}

	// Make executable (Unix only)
	if runtime.GOOS != "windows" {
		os.Chmod(execPath, 0755)
	}

	// Remove backup
	os.Remove(backupPath)

	log.Printf("Successfully updated agent to new version")
	return nil
}