package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	ServerURL string
	HTTP      *http.Client
}

func New(serverURL string) *Client {
	return &Client{
		ServerURL: serverURL,
		HTTP: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) Register(body map[string]interface{}) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/api/agent/register", c.ServerURL)
	resp, err := c.post(url, body)
	if err != nil {
		return nil, fmt.Errorf("register request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("register failed: %d %s", resp.StatusCode, string(b))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return result, nil
}

func (c *Client) SendHeartbeat(body map[string]interface{}) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/api/agent/heartbeat", c.ServerURL)
	resp, err := c.post(url, body)
	if err != nil {
		return nil, fmt.Errorf("heartbeat request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("heartbeat failed: %d %s", resp.StatusCode, string(b))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode heartbeat response: %w", err)
	}
	return result, nil
}

func (c *Client) SendRaw(path string, body map[string]interface{}) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s%s", c.ServerURL, path)
	resp, err := c.post(url, body)
	if err != nil {
		return nil, fmt.Errorf("send raw failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("send raw failed: %d %s", resp.StatusCode, string(b))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode raw response: %w", err)
	}
	return result, nil
}

func (c *Client) post(url string, body map[string]interface{}) (*http.Response, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal body: %w", err)
	}
	req, err := http.NewRequest("POST", url, bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	return c.HTTP.Do(req)
}