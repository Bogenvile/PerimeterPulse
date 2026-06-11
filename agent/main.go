package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"perimeterpulse/agent/client"
	"perimeterpulse/agent/collector"
)

func main() {
	log.SetFlags(log.LstdFlags)

	serverURL := flag.String("server", "http://localhost:3000", "Server URL")
	apiKey := flag.String("apikey", "", "API Key for authentication")
	hostname := flag.String("hostname", "", "Hostname override")
	interval := flag.Int("interval", 3, "Heartbeat interval in seconds")
	flag.Parse()

	if *apiKey == "" {
		log.Fatal("API Key is required (--apikey)")
	}

	if *hostname == "" {
		h, _ := os.Hostname()
		*hostname = h
	}

	log.Printf("Starting PerimeterPulse Agent v1.2.0")
	log.Printf("Connecting to: %s", *serverURL)
	log.Printf("Using hostname: %s", *hostname)

	// Initialize client
	c := client.NewClient(*serverURL, *apiKey)

	// Register agent with server
	hw := collector.CollectInfo(*apiKey)
	if err := c.Register(hw); err != nil {
		log.Fatalf("Registration failed: %v", err)
	}
	log.Printf("Registration successful! Agent ID: %s", c.AgentID)

	// Graceful shutdown
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(time.Duration(*interval) * time.Second)
	defer ticker.Stop()

	// Send first heartbeat immediately
	runHeartbeat(c)

	for {
		select {
		case <-sig:
			log.Println("Shutting down...")
			return
		case <-ticker.C:
			runHeartbeat(c)
		}
	}
}

// runHeartbeat collects metrics, location, network info and sends heartbeat
func runHeartbeat(c *client.Client) {
	metrics := collector.CollectMetrics()
	location := collector.CollectLocation()
	network := collector.CollectNetwork()

	payload := client.HeartbeatPayload{
		AgentID:     c.AgentID,
		APIKey:      c.APIKey,
		Metrics:     metrics,
		Location:    location,
		NetworkInfo: network,
	}

	if err := c.SendHeartbeat(payload); err != nil {
		log.Printf("Heartbeat error: %v", err)
	}
}