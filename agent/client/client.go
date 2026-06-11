package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"perimeterpulse/agent/collector"
)

// RegisterResponse holds the server's reply to a registration request.
type RegisterResponse struct {
	OK      bool   `json:"ok"`
	AgentID string `json:"agent_id"`
}

// HeartbeatPayload is sent every heartbeat.
type HeartbeatPayload struct {
	AgentID     string               `json:"agent_id"`
	APIKey      string               `json:"api_key"`
	Metrics     collector.MetricsData `json:"metrics"`
	Location    collector.LocationData `json:"location"`
	NetworkInfo collector.NetworkInfoData `json:"network_info"`
}

// RegisterAgent sends the registration payload to the server.
// agentID is an optional previously assigned ID; if non-empty it will be
// included in the request so the server can reuse the existing asset record.
func RegisterAgent(serverURL string, info collector.RegistrationInfo, agentID string) (*RegisterResponse, error) {
	payload := struct {
		collector.RegistrationInfo
		AgentID string `json:"agent_id,omitempty"`
	}{
		RegistrationInfo: info,
		AgentID:          agentID,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", serverURL+"/api/agent/register", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("post: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("server returned %s", resp.Status)
	}

	var regResp RegisterResponse
	if err := json.NewDecoder(resp.Body).Decode(&regResp); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}

	return &regResp, nil
}

// SendHeartbeat posts a heartbeat payload to the server.
func SendHeartbeat(serverURL string, hb HeartbeatPayload) error {
	body, err := json.Marshal(hb)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", serverURL+"/api/agent/heartbeat", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("post: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("server returned %s", resp.Status)
	}
	return nil
}