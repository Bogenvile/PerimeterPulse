package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"
)

const (
	registerPath  = "/api/agent/register"
	heartbeatPath = "/api/agent/heartbeat"
	commandsPath  = "/api/agent/commands"
	updatePath    = "/api/agent/update"
)

// HTTPClient adalah client yang digunakan untuk berkomunikasi dengan server.
type HTTPClient struct {
	BaseURL  string
	HTTP     *http.Client
}

// NewHTTPClient membuat HTTPClient baru dengan timeout default.
func NewHTTPClient(baseURL string) *HTTPClient {
	return &HTTPClient{
		BaseURL: baseURL,
		HTTP: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				TLSHandshakeTimeout:   10 * time.Second,
				ResponseHeaderTimeout: 10 * time.Second,
			},
		},
	}
}

func (c *HTTPClient) do(method, path string, body any, out any) error {
	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request: %w", err)
		}
		reqBody = bytes.NewReader(data)
	}

	req, err := http.NewRequest(method, c.BaseURL+path, reqBody)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("server error %d: %s", resp.StatusCode, string(respBody))
	}

	if out != nil {
		if err := json.Unmarshal(respBody, out); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}
	}
	return nil
}

// Register mengirim payload registrasi ke server.
func (c *HTTPClient) Register(payload any) error {
	return c.do(http.MethodPost, registerPath, payload, nil)
}

// Heartbeat mengirim payload heartbeat ke server.
func (c *HTTPClient) Heartbeat(payload any) error {
	return c.do(http.MethodPost, heartbeatPath, payload, nil)
}

// PendingCommand mewakili perintah yang menunggu eksekusi.
type PendingCommand struct {
	ID        int    `json:"id"`
	Command   string `json:"command"`
	CreatedAt string `json:"created_at"`
}

// CommandsResponse adalah respons dari server untuk daftar perintah pending.
type CommandsResponse struct {
	Commands []PendingCommand `json:"commands"`
}

// FetchPendingCommands mengambil daftar perintah yang menunggu eksekusi.
func (c *HTTPClient) FetchPendingCommands(agentID, apiKey string) ([]PendingCommand, error) {
	path := fmt.Sprintf("%s?agent_id=%s&api_key=%s", commandsPath, agentID, apiKey)
	var resp CommandsResponse
	if err := c.do(http.MethodGet, path, nil, &resp); err != nil {
		return nil, err
	}
	return resp.Commands, nil
}

// CommandStatusPayload adalah payload untuk memperbarui status perintah.
type CommandStatusPayload struct {
	AgentID  string `json:"agent_id"`
	APIKey   string `json:"api_key"`
	Action   string `json:"action"`
	Output   string `json:"output,omitempty"`
	Error    string `json:"error,omitempty"`
	ExitCode int    `json:"exit_code,omitempty"`
}

// ReportCommandStatus mengirim hasil eksekusi perintah ke server.
func (c *HTTPClient) ReportCommandStatus(commandID int, agentID, apiKey string, status CommandStatusPayload) error {
	path := fmt.Sprintf("%s/%d?agent_id=%s&api_key=%s", commandsPath, commandID, agentID, apiKey)
	return c.do(http.MethodPost, path, status, nil)
}

// UpdateResponse adalah respons dari server saat cek update.
type UpdateResponse struct {
	Version     string `json:"version"`
	DownloadURL string `json:"download_url"`
}

// CheckForUpdate memeriksa apakah ada versi baru dari server.
func (c *HTTPClient) CheckForUpdate(agentID, apiKey, goos, goarch string) (string, string, error) {
	path := fmt.Sprintf("%s?agent_id=%s&api_key=%s&os=%s&arch=%s", updatePath, agentID, apiKey, goos, goarch)
	var resp UpdateResponse
	if err := c.do(http.MethodGet, path, nil, &resp); err != nil {
		return "", "", err
	}
	return resp.Version, resp.DownloadURL, nil
}

// DownloadAndReplace mengunduh biner baru dan menggantikan file saat ini.
func (c *HTTPClient) DownloadAndReplace(downloadURL string) error {
	resp, err := c.HTTP.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("download update: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("update download failed with status %d", resp.StatusCode)
	}

	executable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("get executable path: %w", err)
	}

	tmpFile := executable + ".new"
	out, err := os.Create(tmpFile)
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}

	if _, err := io.Copy(out, resp.Body); err != nil {
		out.Close()
		os.Remove(tmpFile)
		return fmt.Errorf("write update: %w", err)
	}
	out.Close()

	if err := os.Chmod(tmpFile, 0755); err != nil {
		os.Remove(tmpFile)
		return fmt.Errorf("chmod update: %w", err)
	}

	if runtime.GOOS == "windows" {
		oldFile := executable + ".old"
		os.Remove(oldFile)
		if err := os.Rename(executable, oldFile); err != nil {
			os.Remove(tmpFile)
			return fmt.Errorf("rename old binary: %w", err)
		}
	}

	if err := os.Rename(tmpFile, executable); err != nil {
		if runtime.GOOS == "windows" {
			os.Rename(executable+".old", executable)
		}
		os.Remove(tmpFile)
		return fmt.Errorf("replace binary: %w", err)
	}

	return nil
}

// RestartSelf memulai ulang agent dengan argumen yang sama.
func (c *HTTPClient) RestartSelf() {
	executable, err := os.Executable()
	if err != nil {
		log.Fatalf("Cannot determine executable path: %v", err)
	}
	cmd := exec.Command(executable, os.Args[1:]...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		log.Fatalf("Failed to restart: %v", err)
	}
	os.Exit(0)
}