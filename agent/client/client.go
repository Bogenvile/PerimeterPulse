package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
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
	payload := collector.RegistrationPayload{
		Hostname:   c.hostname,
		Os:         collector.GetOS(),
		OsVersion:  collector.GetOSVersion(),
		AgentVersion: "1.0.0",
		MACAddresses: collector.GetMACAddresses(),
		IPAddresses:  collector.GetIPAddresses(),
		CPUModel:     collector.GetCPUModel(),
		CPUCores:     collector.GetCPUCores(),
		RAMTotalBytes: collector.GetRAMTotal(),
		StorageTotalBytes: collector.GetStorageTotal(),
		DiskModel:    collector.GetDiskModel(),
		DiskType:     collector.GetDiskType(),
		WiFiSSID:     collector.GetWiFiSSID(),
		WiFiSignalDBM: collector.GetWiFiSignalDBM(),
		NetworkSpeedMbps: collector.GetNetworkSpeed(),
		APIKey:       c.apiKey,
	}

	body, err := json.Marshal(payload)
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
		return fmt.Errorf("decode register response: %w", err)
	}

	c.agentID = result.AgentID
	log.Printf("Registered with agent_id: %s", c.agentID)
	return nil
}

func (c *Client) Heartbeat(metrics *collector.Metrics, location *collector.Location, network *collector.NetworkInfo) error {
	payload := collector.HeartbeatPayload{
		AgentID: c.agentID,
		APIKey:  c.apiKey,
		Metrics: metrics,
		Location: location,
		NetworkInfo: network,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal heartbeat payload: %w", err)
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