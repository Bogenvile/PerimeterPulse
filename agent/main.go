package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"perimeterpulse/agent/client"
	"perimeterpulse/agent/collector"
	"perimeterpulse/agent/commands"
)

type Config struct {
	ServerURL string
	APIKey    string
	Hostname  string
	Interval  int
	Version   string
	OS        string
}

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
		h, err := os.Hostname()
		if err != nil {
			log.Fatalf("Failed to get hostname: %v", err)
		}
		*hostname = h
	}

	cfg := Config{
		ServerURL: *serverURL,
		APIKey:    *apiKey,
		Hostname:  *hostname,
		Interval:  *interval,
		Version:   "1.2.0",
		OS:        runtime.GOOS,
	}

	log.Printf("Starting PerimeterPulse Agent v%s", cfg.Version)
	log.Printf("Connecting to: %s", cfg.ServerURL)
	log.Printf("Using hostname override: %s", cfg.Hostname)

	// Register Agent
	agentID, err := client.Register(cfg)
	if err != nil {
		log.Fatalf("Registration failed: %v", err)
	}
	log.Printf("Registration successful! Agent ID: %s", agentID)

	// Handle shutdown
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(time.Duration(cfg.Interval) * time.Second)
	defer ticker.Stop()

	// Run once immediately
	runHeartbeat(agentID, cfg)
	runCommandCheck(agentID, cfg)

	for {
		select {
		case <-sig:
			log.Println("Shutting down...")
			return
		case <-ticker.C:
			runHeartbeat(agentID, cfg)
			runCommandCheck(agentID, cfg)
		}
	}
}

// runHeartbeat executes the heartbeat with panic recovery
func runHeartbeat(agentID string, cfg Config) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Heartbeat panic recovered: %v", r)
		}
	}()

	metrics, err := collector.CollectMetrics(agentID)
	if err != nil {
		log.Printf("Metrics collection warning: %v", err)
		// Don't return here, try to send what we have or an empty payload
		metrics = make(map[string]interface{}) // Fallback to empty map if collector crashes
		metrics["status"] = "error"
	}

	// Get location (best effort)
	location, locErr := collector.GetLocation()
	if locErr != nil {
		log.Printf("Location warning: %v", locErr)
	}

	network := collector.GetNetworkInfo()

	payload := client.HeartbeatPayload{
		AgentID:     agentID,
		APIKey:      cfg.APIKey,
		Metrics:     metrics,
		Location:    location,
		NetworkInfo: network,
	}

	if err := client.SendHeartbeat(cfg.ServerURL, payload); err != nil {
		log.Printf("Heartbeat error: %v", err)
	}
}

// runCommandCheck polls for commands and executes them with panic recovery
func runCommandCheck(agentID string, cfg Config) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Command check panic recovered: %v", r)
		}
	}()

	cmds, err := commands.FetchPendingCommands(cfg.ServerURL, agentID, cfg.APIKey)
	if err != nil {
		log.Printf("Command check error: %v", err)
		return
	}

	for _, cmd := range cmds {
		log.Printf("Executing command %d: %s", cmd.ID, cmd.Command)
		
		// Mark as running
		commands.UpdateCommandStatus(cfg.ServerURL, agentID, cfg.APIKey, cmd.ID, "start", "", "", nil)

		// Execute
		output, exitCode, execErr := commands.Execute(cmd.Command)

		status := "completed"
		if execErr != nil {
			status = "failed"
			log.Printf("Command %d failed: %v", cmd.ID, execErr)
		}

		// Report result
		if err := commands.UpdateCommandStatus(cfg.ServerURL, agentID, cfg.APIKey, cmd.ID, status, output, "", &exitCode); err != nil {
			log.Printf("Failed to report command result: %v", err)
		} else {
			log.Printf("Command %d completed with status %s", cmd.ID, status)
		}
	}
}