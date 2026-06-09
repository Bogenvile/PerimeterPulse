package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/perimeterpulse/agent/client"
	"github.com/perimeterpulse/agent/collector"
)

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

	c := client.New(*server)

	// Registrasi
	registerBody := map[string]interface{}{
		"hostname": *hostname,
		"api_key":  *apiKey,
	}
	log.Printf("Registering agent: %s", *hostname)
	resp, err := c.Register(registerBody)
	if err != nil {
		log.Fatalf("Registration failed: %v", err)
	}

	agentID, ok := resp["agent_id"].(string)
	if !ok || agentID == "" {
		log.Fatal("Server returned empty agent_id")
	}
	log.Printf("Registered as agent: %s", agentID)

	// State untuk heartbeat
	type agentState struct {
		AgentID string
		APIKey  string
	}
	state := agentState{AgentID: agentID, APIKey: *apiKey}

	// Kirim heartbeat pertama langsung
	sendHeartbeat(c, &state)

	// Ticker setiap 60 detik
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	for {
		select {
		case <-ticker.C:
			sendHeartbeat(c, &state)
		case <-sig:
			log.Println("Shutting down...")
			return
		}
	}
}

func sendHeartbeat(c *client.Client, state *struct{ AgentID, APIKey string }) {
	metrics := collector.CollectMetrics()

	hb := map[string]interface{}{
		"agent_id": state.AgentID,
		"api_key":  state.APIKey,
		"metrics": map[string]interface{}{
			"cpu_percent":        metrics.CPUPercent,
			"ram_percent":        metrics.RAMPercent,
			"ram_used_bytes":     metrics.RAMUsedBytes,
			"ram_total_bytes":    metrics.RAMTotalBytes,
			"storage_percent":    metrics.StoragePercent,
			"storage_used_bytes": metrics.StorageUsedBytes,
			"storage_total_bytes": metrics.StorageTotalBytes,
			"uptime_seconds":     metrics.UptimeSeconds,
			"network_status":     metrics.NetworkStatus,
			"network_latency_ms": metrics.NetworkLatencyMs,
			"timestamp":          time.Now().UTC().Format(time.RFC3339),
		},
	}

	if _, err := c.SendHeartbeat(hb); err != nil {
		log.Printf("Heartbeat failed: %v", err)
	} else {
		log.Printf("Heartbeat sent at %s", time.Now().Format(time.RFC3339))
	}
}