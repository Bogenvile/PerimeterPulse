package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"perimeterpulse-agent/collector"
)

func (c *ApiClient) Register(payload collector.RegistrationPayload) error {
	body, err := json.Marshal(map[string]interface{}{
		"agent_id":            c.AgentID,
		"api_key":             c.ApiKey,
		"hostname":            payload.Hostname,
		"os":                  payload.OS,
		"os_version":          payload.OSVersion,
		"agent_version":       payload.AgentVersion,
		"mac_addresses":       payload.MACAddresses,
		"ip_addresses":        payload.IPAddresses,
		"cpu_model":           payload.CPUModel,
		"cpu_cores":           payload.CPUCores,
		"ram_total_bytes":     payload.RAMTotalBytes,
		"storage_total_bytes": payload.StorageTotalBytes,
		"disk_model":          payload.DiskModel,
		"disk_type":           payload.DiskType,
		"wifi_ssid":           payload.WiFiSSID,
		"wifi_signal_dbm":     payload.WiFiSignalDBM,
		"network_speed_mbps":  payload.NetworkSpeedMbps,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", c.Server+"/api/agent/register", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return fmt.Errorf("register returned %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}