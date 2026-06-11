package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"perimeterpulse/agent/client"
	"perimeterpulse/agent/collector"
)

var (
	serverURL = flag.String("server", "", "PerimeterPulse server URL (e.g. https://dashboard.example.com)")
	apiKey    = flag.String("apikey", "", "API key for authentication")
	hostname  = flag.String("hostname", "", "Override auto-detected hostname")
	interval  = flag.Int("interval", 60, "Heartbeat interval in seconds")
)

func main() {
	flag.Parse()

	if *serverURL == "" || *apiKey == "" {
		log.Fatal("--server and --apikey are required")
	}
	*serverURL = strings.TrimRight(*serverURL, "/")

	// Load persistent agent ID (empty on first run)
	agentID := loadAgentID()

	// Collect registration info, with optional hostname override
	info := collector.CollectInfo(*apiKey, *hostname)

	// Register with server (pass stored agent_id if known)
	resp, err := client.RegisterAgent(*serverURL, info, agentID)
	if err != nil {
		log.Fatalf("registration failed: %v", err)
	}

	// Save the server-assigned agent_id for future restarts
	if resp.AgentID != "" {
		agentID = resp.AgentID
		if err := saveAgentID(agentID); err != nil {
			log.Printf("warning: could not save agent ID: %v", err)
		}
	}
	fmt.Printf("Registered as agent %s (hostname: %s)\n", agentID, info.Hostname)

	// Heartbeat loop
	ticker := time.NewTicker(time.Duration(*interval) * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		metrics := collector.CollectMetrics()
		location := collector.CollectLocation()
		network := collector.CollectNetwork()

		hb := client.HeartbeatPayload{
			AgentID:     agentID,
			APIKey:      *apiKey,
			Metrics:     metrics,
			Location:    location,
			NetworkInfo: network,
		}

		if err := client.SendHeartbeat(*serverURL, hb); err != nil {
			log.Printf("heartbeat error: %v", err)
		}
	}
}

// ---------- agent ID persistence ----------

func idFilePath() string {
	exe, err := os.Executable()
	if err != nil {
		return "pulse-agent.id"
	}
	return filepath.Join(filepath.Dir(exe), "pulse-agent.id")
}

func loadAgentID() string {
	data, err := os.ReadFile(idFilePath())
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

func saveAgentID(id string) error {
	return os.WriteFile(idFilePath(), []byte(id), 0644)
}