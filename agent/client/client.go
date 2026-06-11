package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	registerPath    = "/api/agent/register"
	heartbeatPath   = "/api/agent/heartbeat"
	commandsPath    = "/api/agent/commands"
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
	ID         int    `json:"id"`
	Command    string `json:"command"`
	CreatedAt  string `json:"created_at"`
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