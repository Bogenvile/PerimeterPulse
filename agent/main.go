package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/perimeterpulse/agent/buffer"
	"github.com/perimeterpulse/agent/client"
	"github.com/perimeterpulse/agent/collector"
)

type AgentState struct {
	AgentID string
	APIKey  string
}

func main() {
	server := flag.String("server", "http://localhost:3000", "Server URL")
	apiKey := flag.String("apikey", "", "API key for authentication")
	hostname := flag.String("hostname", "", "Override hostname (optional)")
	flag.Parse()

	if *apiKey == "" {
		log.Fatal("--apikey is required")
	}
	if *hostname == "" {
		var err error
		*hostname, err = os.Hostname()
		if err != nil {
			log.Fatalf("Cannot get hostname: %v", err)
		}
	}

	client := client.New(*server)
	buf := buffer.New("agent-buffer.jsonl")

	// Collect system info
	info, err := collector.Collect(*hostname)
	if err != nil {
		log.Fatalf("Collect system info: %v", err)
	}

	registerBody := map[string]interface{}{
		"hostname":         info.Hostname,
		"os":               info.OS,
		"os_version":       info.OSVersion,
		"agent_version":    info.AgentVersion,
		"mac_addresses":    info.MACAddresses,
		"ip_addresses":     info.IPAddresses,
		"cpu_model":        info.CPUModel,
		"cpu_cores":        info.CPUCores,
		"ram_total_bytes":  info.RAMTotalBytes,
		"storage_total_bytes": info.StorageTotalBytes,
		"disk_model":       info.DiskModel,
		"disk_type":        info.DiskType,
		"wifi_ssid":        info.WifiSSID,
		"wifi_signal_dbm":  info.WifiSignalDBM,
		"network_speed_mbps": info.NetworkSpeedMbps,
		"api_key":          *apiKey,
	}

	log.Printf("Registering agent: %s", info.Hostname)
	resp, err := client.Register(registerBody)
	if err != nil {
		log.Printf("Registration failed: %v (will retry later)", err)
	} else {
		agentID, _ := resp["agent_id"].(string)
		if agentID == "" {
			log.Fatal("Server returned empty agent_id")
		}
		log.Printf("Registered as agent: %s", agentID)
		state := &AgentState{AgentID: agentID, APIKey: *apiKey}

		// Replay buffered heartbeats if any
		replayBuffered(client, state)

		// Start heartbeat loop
		startHeartbeatLoop(client, state, buf)
	}

	// Graceful shutdown
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	log.Println("Shutting down...")
}

func replayBuffered(c *client.Client, state *AgentState) {
	buf := buffer.New("agent-buffer.jsonl")
	entries := buf.ReadAll()
	for _, entry := range entries {
		var hb map[string]interface{}
		if err := json.Unmarshal([]byte(entry), &hb); err != nil {
			log.Printf("Failed to unmarshal buffered heartbeat: %v", err)
			continue
		}
		// Inject agent_id and api_key if missing
		if _, ok := hb["agent_id"]; !ok {
			hb["agent_id"] = state.AgentID
		}
		if _, ok := hb["api_key"]; !ok {
			hb["api_key"] = state.APIKey
		}
		if _, err := c.SendHeartbeat(hb); err != nil {
			log.Printf("Failed to replay buffered heartbeat: %v", err)
		} else {
			log.Printf("Replayed buffered heartbeat")
		}
	}
	// Clear buffer after replay
	os.Remove("agent-buffer.jsonl")
}

func startHeartbeatLoop(c *client.Client, state *AgentState, buf *buffer.Buffer) {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	// Send initial heartbeat immediately
	sendHeartbeat(c, state, buf)

	for range ticker.C {
		sendHeartbeat(c, state, buf)
	}
}

func sendHeartbeat(c *client.Client, state *AgentState, buf *buffer.Buffer) {
	metrics, err := collector.CollectMetrics()
	if err != nil {
		log.Printf("Collect metrics failed: %v", err)
		return
	}

	hb := map[string]interface{}{
		"agent_id": state.AgentID,
		"api_key":  state.APIKey,
		"metrics":  metrics,
	}

	// Add location if available
	loc, err := collector.GetLocation()
	if err == nil && loc != nil {
		hb["location"] = loc
	}

	// Add network info
	netInfo := collector.GetNetworkInfo()
	if netInfo != nil {
		hb["network_info"] = netInfo
	}

	if _, err := c.SendHeartbeat(hb); err != nil {
		log.Printf("Heartbeat failed: %v (buffering for later)", err)
		// Buffer the heartbeat
		data, _ := json.Marshal(hb)
		buf.Append(string(data))
	} else {
		log.Printf("Heartbeat sent at %s", time.Now().Format(time.RFC3339))
	}
}