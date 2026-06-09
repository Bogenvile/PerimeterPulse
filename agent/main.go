package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"perimeterpulse/agent/collector"
)

type HeartbeatPayload struct {
	AgentID string                 `json:"agent_id"`
	APIKey  string                 `json:"api_key"`
	Metrics *collector.Metrics    `json:"metrics,omitempty"`
	Network *collector.NetworkInfo `json:"network_info,omitempty"`
	Location *collector.Location  `json:"location,omitempty"`
}

type RegisterPayload struct {
	Hostname      string   `json:"hostname"`
	OS            string   `json:"os"`
	OSVersion     string   `json:"os_version"`
	AgentVersion  string   `json:"agent_version"`
	APIKey        string   `json:"api_key"`
	MACAddresses  []string `json:"mac_addresses"`
	IPAddresses   []string `json:"ip_addresses"`
	CPUModel      string   `json:"cpu_model"`
	CPUCores      int      `json:"cpu_cores"`
	RAMTotalBytes int64    `json:"ram_total_bytes"`
	StorageTotalBytes int64 `json:"storage_total_bytes"`
	DiskModel     string   `json:"disk_model"`
	DiskType      string   `json:"disk_type"`
	WiFiSSID      string   `json:"wifi_ssid"`
	WiFiSignalDBM int      `json:"wifi_signal_dbm"`
	NetworkSpeedMbps int   `json:"network_speed_mbps"`
}

func main() {
	serverURL := os.Getenv("SERVER_URL")
	if serverURL == "" {
		serverURL = "http://localhost:3000"
	}
	apiKey := os.Getenv("API_KEY")
	if apiKey == "" {
		log.Fatal("API_KEY environment variable required")
	}

	// Collect initial info
	info := collector.CollectInfo()
	info.APIKey = apiKey

	// Register
	registerPayload := RegisterPayload{
		Hostname:     info.Hostname,
		OS:           info.OS,
		OSVersion:    info.OSVersion,
		AgentVersion: info.AgentVersion,
		APIKey:       apiKey,
		MACAddresses: info.MACAddresses,
		IPAddresses:  info.IPAddresses,
		CPUModel:     info.CPUModel,
		CPUCores:     info.CPUCores,
		RAMTotalBytes: info.RAMTotalBytes,
		StorageTotalBytes: info.StorageTotalBytes,
		DiskModel:    info.DiskModel,
		DiskType:     info.DiskType,
		WiFiSSID:     info.WiFiSSID,
		WiFiSignalDBM: info.WiFiSignalDBM,
		NetworkSpeedMbps: info.NetworkSpeedMbps,
	}

	body, _ := json.Marshal(registerPayload)
	resp, err := http.Post(serverURL+"/api/agent/register", "application/json", bytes.NewReader(body))
	if err != nil {
		log.Fatalf("Registration failed: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		log.Fatalf("Registration returned status %d", resp.StatusCode)
	}
	log.Println("Registration successful")

	// Generate a stable agent ID (use hostname + os + macs etc.)
	agentID := info.Hostname + "-" + info.OS

	// Heartbeat loop
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		metrics := collector.CollectMetrics()
		network := collector.CollectNetworkInfo()
		location := collector.CollectLocation()

		payload := HeartbeatPayload{
			AgentID:  agentID,
			APIKey:   apiKey,
			Metrics:  metrics,
			Network:  network,
			Location: location,
		}

		data, _ := json.Marshal(payload)
		resp, err := http.Post(serverURL+"/api/agent/heartbeat", "application/json", bytes.NewReader(data))
		if err != nil {
			log.Printf("Heartbeat failed: %v", err)
		} else {
			resp.Body.Close()
			if resp.StatusCode != 200 {
				log.Printf("Heartbeat returned status %d", resp.StatusCode)
			} else {
				log.Println("Heartbeat sent")
			}
		}

		<-ticker.C
	}
}