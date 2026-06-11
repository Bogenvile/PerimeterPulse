package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type Client struct {
	ServerURL string
	APIKey    string
	AgentID   string
}

func NewClient(serverURL, apiKey string) *Client {
	return &Client{
		ServerURL: serverURL,
		APIKey:    apiKey,
	}
}

type RegisterPayload struct {
	Hostname         string   `json:"hostname"`
	OS               string   `json:"os"`
	OSVersion        string   `json:"os_version"`
	AgentVersion     string   `json:"agent_version"`
	APIKey           string   `json:"api_key"`
	MacAddresses     []string `json:"mac_addresses"`
	CPUModel         string   `json:"cpu_model"`
	CPUCores         int      `json:"cpu_cores"`
	RAMTotalBytes    uint64   `json:"ram_total_bytes"`
	StorageTotalBytes uint64  `json:"storage_total_bytes"`
	DiskModel        string   `json:"disk_model"`
	DiskType         string   `json:"disk_type"`
	WiFiSSID         string   `json:"wifi_ssid"`
	WiFiSignalDBM    int      `json:"wifi_signal_dbm"`
}

func (c *Client) Register(agentID string, hw interface{}) error {
	// Type assertion atau mapping manual tergantung struktur hw
	// Untuk simplifikasi, kita asumsikan hw adalah struct yang bisa di-marshal
	payload, _ := json.Marshal(hw)
	
	// Kita perlu enrich payload dengan APIKey dan Hostname jika belum ada
	// Tapi untuk sekarang, kita kirim raw payload hw yang harusnya sudah lengkap
	// dari collector.GetHardwareInfo() yang sudah di-enrich
	
	url := fmt.Sprintf("%s/api/agent/register", c.ServerURL)
	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("register failed: %s", string(body))
	}
	return nil
}

type HeartbeatPayload struct {
	AgentID     string      `json:"agent_id"`
	APIKey      string      `json:"api_key"`
	Metrics     interface{} `json:"metrics"`
	Location    interface{} `json:"location"`
	NetworkInfo interface{} `json:"network_info"`
}

type NetworkInfo struct {
	WiFiSSID         string   `json:"wifi_ssid"`
	WiFiSignalDBM    int      `json:"wifi_signal_dbm"`
	WiFiIP           string   `json:"wifi_ip"`
	IPAddresses      []string `json:"ip_addresses"`
	NetworkSpeedMbps int      `json:"network_speed_mbps"`
}

func (c *Client) SendHeartbeat(payload HeartbeatPayload) error {
	payload.AgentID = c.AgentID
	payload.APIKey = c.APIKey
	
	data, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/api/agent/heartbeat", c.ServerURL)
	
	resp, err := http.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("heartbeat failed with status: %d", resp.StatusCode)
	}
	return nil
}