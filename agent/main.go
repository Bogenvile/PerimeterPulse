package main

import (
	"encoding/json"
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

	client := client.New(*server)

	// Registrasi
	registerBody := map[string]interface{}{
		"hostname":  *hostname,
		"api_key":   *apiKey,
	}
	log.Printf("Registering agent: %s", *hostname)
	resp, err := client.Register(registerBody)
	if err != nil {
		log.Fatalf("Registration failed: %v", err)
	}

	agentID, ok := resp["agent_id"].(string)
	if !ok || agentID == "" {
		log.Fatal("Server returned empty agent_id")
	}
	log.Printf("Registered as agent: %s", agentID)

	// Simpan agentID & apiKey untuk heartbeat
	state := struct {
		AgentID string
		APIKey  string
	}{agentID, *apiKey}

	// Kirim heartbeat pertama setelah registrasi
	sendHeartbeat(client, &state)

	// Mulai loop heartbeat setiap 60 detik
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	for {
		select {
		case <-ticker.C:
			sendHeartbeat(client, &state)
		case <-sig:
			log.Println("Shutting down...")
			return
		}
	}
}

func sendHeartbeat(c *client.Client, state *struct{ AgentID, APIKey string }) {
	metrics := collector.CollectMetrics()
	if metrics == nil {
		log.Println("CollectMetrics returned nil, skipping heartbeat")
		return
	}

	hb := map[string]interface{}{
		"agent_id": state.AgentID,
		"api_key":  state.APIKey,
		"metrics":  metrics,
	}

	if _, err := c.SendHeartbeat(hb); err != nil {
		log.Printf("Heartbeat failed: %v", err)
	} else {
		log.Printf("Heartbeat sent at %s", time.Now().Format(time.RFC3339))
	}
}