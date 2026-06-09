package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"perimeterpulse/agent/collector"
)

type Client struct {
	serverURL string
	apiKey    string
	agentID   string
	http      *http.Client
}

func New(serverURL, apiKey string) *Client {
	return &Client{
		serverURL: serverURL,
		apiKey:    apiKey,
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) Register(info *collector.Info) error {
	payload := map[string]interface{}{
		"hostname":          info.Hostname,
		"os":                info.OS,
		"os_version":        info.OSVersion,
		"agent_version":     info.AgentVersion,
		"api_key":           info.APIKey,
		"mac_addresses":     info.MACAddresses,
		"ip_addresses":      info.IPAddresses,
		"cpu_model":         info.CPUModel,
		"cpu_cores":         info.CPUCores,
		"ram_total_bytes":   info.RAMTotalBytes,
		"storage_total_bytes": info.StorageTotalBytes,
		"disk_model":        info.DiskModel,
		"disk_type":         info.DiskType,
		"wifi_ssid":         info.WiFiSSID,
		"wifi_signal_dbm":   info.WiFiSignalDBM,
		"network_speed_mbps": info.NetworkSpeedMbps,
	}

	body, _ := json.Marshal(payload)
	resp, err := c.http.Post(c.serverURL+"/api/agent/register", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("register request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("register failed with status %d", resp.StatusCode)
	}

	var result struct {
		Ok      bool   `json:"ok"`
		AgentID string `json:"agent_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("register decode failed: %w", err)
	}

	if !result.Ok {
		return fmt.Errorf("register returned not ok")
	}

	c.agentID = result.AgentID
	return nil
}

func (c *Client) SendHeartbeat(metrics *collector.Metrics, loc *collector.Location, netInfo *collector.NetworkInfo) error {
	if c.agentID == "" {
		return fmt.Errorf("agent not registered")
	}

	payload := map[string]interface{}{
		"agent_id": c.agentID,
		"api_key":  c.apiKey,
		"metrics": map[string]interface{}{
			"cpu_percent":        metrics.CPUPercent,
			"ram_percent":        metrics.RAMPercent,
			"ram_used_bytes":     metrics.MemoryUsed,
			"ram_total_bytes":    metrics.MemoryTotal,
			"storage_percent":    metrics.StoragePercent,
			"storage_used_bytes": metrics.DiskUsed,
			"storage_total_bytes": metrics.DiskTotal,
			"uptime_seconds":     metrics.UptimeSeconds,
			"network_status":     metrics.NetworkStatus,
			"network_latency_ms": metrics.NetworkLatencyMs,
			"gateway_reachable":  metrics.GatewayReachable,
			"dns_working":        metrics.DNSWorking,
			"internet_reachable": metrics.InternetReachable,
			"default_gateway":    metrics.DefaultGateway,
			"disk_health_status": metrics.DiskHealthStatus,
			"disk_temperature_c": metrics.DiskTemperatureC,
			"timestamp":          time.Now().UTC().Format(time.RFC3339),
		},
	}

	if loc != nil {
		payload["location"] = map[string]interface{}{
			"latitude":       loc.Latitude,
			"longitude":      loc.Longitude,
			"accuracy_meters": loc.AccuracyMeters,
			"source":         loc.Source,
			"timestamp":      time.Now().UTC().Format(time.RFC3339),
		}
	}

	if netInfo != nil {
		payload["network_info"] = map[string]interface{}{
			"wifi_ssid":        netInfo.WiFiSSID,
			"wifi_signal_dbm":  netInfo.WiFiSignalDBM,
			"network_speed_mbps": netInfo.NetworkSpeedMbps,
			"ip_addresses":     netInfo.IPAddresses,
		}
	}

	body, _ := json.Marshal(payload)
	resp, err := c.http.Post(c.serverURL+"/api/agent/heartbeat", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("heartbeat request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("heartbeat failed with status %d", resp.StatusCode)
	}

	return nil
}