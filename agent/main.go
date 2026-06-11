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
	interval  = flag.Int("interval", 3, "Heartbeat interval in seconds")
)

func main() {
	flag.Parse()

	if *serverURL == "" || *apiKey == "" {
		log.Fatal("--server and --apikey are required")
	}
	*serverURL = strings.TrimRight(*serverURL, "/")

	agentID := loadAgentID()
	info := collector.CollectInfo(*apiKey, *hostname)

	resp, err := client.RegisterAgent(*serverURL, info, agentID)
	if err != nil {
		log.Fatalf("registration failed: %v", err)
	}

	if resp.AgentID != "" {
		agentID = resp.AgentID
		if err := saveAgentID(agentID); err != nil {
			log.Printf("warning: could not save agent ID: %v", err)
		}
	}
	fmt.Printf("Registered as agent %s (hostname: %s)\n", agentID, info.Hostname)

	sendHeartbeat(agentID, *apiKey, *serverURL)

	ticker := time.NewTicker(time.Duration(*interval) * time.Second)
	defer ticker.Stop()

	fmt.Printf("Sending heartbeat every %ds...\n", *interval)

	for range ticker.C {
		sendHeartbeat(agentID, *apiKey, *serverURL)
	}
}

func sendHeartbeat(agentID, apiKey, serverURL string) {
	metrics := collector.CollectMetrics()
	location := collector.CollectLocation()
	network := collector.CollectNetwork()

	hb := client.HeartbeatPayload{
		AgentID:     agentID,
		APIKey:      apiKey,
		Metrics:     metrics,
		Location:    location,
		NetworkInfo: network,
	}

	if err := client.SendHeartbeat(serverURL, hb); err != nil {
		log.Printf("heartbeat error: %v", err)
	} else {
		log.Printf("heartbeat sent (CPU: %.1f%%, RAM: %.1f%%, Disk: %.1f%%)",
			metrics.CPUPercent, metrics.RAMPercent, metrics.StoragePercent)
	}
}

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