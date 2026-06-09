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

	// Simpan state
	state := &agentState{
		AgentID: agentID,
		APIKey:  *apiKey,
	}

	// Kirim heartbeat pertama
	sendHeartbeat(c, state)

	// Loop setiap 60 detik
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	for {
		select {
		case <-ticker.C:
			sendHeartbeat(c, state)
		case <-sig:
			log.Println("Shutting down...")
			return
		}
	}
}

type agentState struct {
	AgentID string
	APIKey  string
}

func sendHeartbeat(c *client.Client, state *agentState) {
	metrics := collector.CollectMetrics()

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