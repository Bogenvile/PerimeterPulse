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
	"perimeterpulse/agent/commands"
)

func main() {
	log.SetFlags(log.LstdFlags)

	serverURL := flag.String("server", "https://monitoring-perimeterpulse.wzrjtn.easypanel.host", "Server URL")
	apiKey := flag.String("apikey", "ppulse-sk-a1b2c3d4e5f6g7h8", "API Key")
	hostname := flag.String("hostname", "", "Hostname override")
	interval := flag.Int("interval", 3, "Heartbeat interval (seconds)")
	flag.Parse()

	if *apiKey == "" {
		log.Fatal("API Key is required (--apikey)")
	}

	if *hostname == "" {
		h, _ := os.Hostname()
		*hostname = h
	}

	log.Printf("🟢 PerimeterPulse Agent v1.2.0")
	log.Printf("    Server  : %s", *serverURL)
	log.Printf("    Hostname: %s", *hostname)
	log.Println("----------------------------------------")

	c := client.NewClient(*serverURL, *apiKey)

	// 1. Register
	info := collector.CollectInfo(*apiKey)
	if err := c.Register(info); err != nil {
		log.Fatalf("❌ Registration failed: %v", err)
	}
	log.Printf("✅ Registered successfully! Agent ID: %s", c.AgentID)

	// Graceful shutdown
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(time.Duration(*interval) * time.Second)
	defer ticker.Stop()

	// Langsung kirim heartbeat pertama & cek commands
	runHeartbeat(c)
	checkAndExecuteCommands(c)

	for {
		select {
		case <-sig:
			log.Println("🛑 Shutting down...")
			return
		case <-ticker.C:
			runHeartbeat(c)
			checkAndExecuteCommands(c)
		}
	}
}

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
		log.Printf("⚠️  Heartbeat error: %v", err)
	}
}

func checkAndExecuteCommands(c *client.Client) {
	commands.ProcessCommands(c.ServerURL, c.AgentID, c.APIKey)
}