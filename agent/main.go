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

var (
	serverURL  = flag.String("server", "http://localhost:8080", "Server URL")
	apiKey     = flag.String("apikey", "", "API Key for authentication")
	hostname   = flag.String("hostname", "", "Override hostname")
	interval   = flag.Int("interval", 60, "Heartbeat interval in seconds")
)

func main() {
	flag.Parse()

	if *apiKey == "" {
		log.Fatal("API key is required. Use --apikey flag.")
	}

	httpClient := client.NewHTTPClient(*serverURL)
	agentID := ""

	// Graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// Register agent
	log.Println("Registering agent with server...")
	regPayload := collector.CollectInfo(*apiKey)
	if *hostname != "" {
		regPayload.Hostname = *hostname
	}
	agentID = regPayload.Hostname // will be updated after registration if needed

	if err := httpClient.Register(regPayload); err != nil {
		log.Printf("Registration warning: %v (will retry on next heartbeat)", err)
	}
	log.Println("Agent registered successfully")

	// Start command polling goroutine
	go pollCommands(httpClient, agentID, *apiKey)

	// Main heartbeat loop
	ticker := time.NewTicker(time.Duration(*interval) * time.Second)
	defer ticker.Stop()

	log.Printf("Agent started. Heartbeat interval: %ds", *interval)

	for {
		select {
		case <-ticker.C:
			go runHeartbeat(httpClient, agentID, *apiKey)
		case <-stop:
			log.Println("Shutting down agent...")
			return
		}
	}
}

func runHeartbeat(client *client.HTTPClient, agentID, key string) {
	metrics := collector.CollectMetrics()
	network := collector.CollectNetwork()
	location := collector.CollectLocation()

	payload := map[string]any{
		"agent_id":    agentID,
		"api_key":     key,
		"metrics":     metrics,
		"network_info": network,
		"location":    location,
	}

	if err := client.Heartbeat(payload); err != nil {
		log.Printf("Heartbeat error: %v", err)
		return
	}
	log.Println("Heartbeat sent successfully")
}

func pollCommands(client *client.HTTPClient, agentID, apiKey string) {
	ticker := time.NewTicker(10 * time.Second) // Poll every 10 seconds
	defer ticker.Stop()

	log.Println("Command polling started (interval: 10s)")

	for range ticker.C {
		cmds, err := client.FetchPendingCommands(agentID, apiKey)
		if err != nil {
			log.Printf("Failed to fetch commands: %v", err)
			continue
		}

		for _, cmd := range cmds {
			go executeAndReport(client, agentID, apiKey, cmd)
		}
	}
}

func executeAndReport(client *client.HTTPClient, agentID, apiKey string, cmd client.PendingCommand) {
	log.Printf("Executing command %d: %s", cmd.ID, cmd.Command)

	// Notify server we're starting
	startPayload := client.CommandStatusPayload{
		AgentID: agentID,
		APIKey:  apiKey,
		Action:  "start",
	}
	if err := client.ReportCommandStatus(cmd.ID, agentID, apiKey, startPayload); err != nil {
		log.Printf("Failed to report start for command %d: %v", cmd.ID, err)
	}

	// Execute the command
	result := commands.Execute(cmd.ID, cmd.Command)

	// Report completion
	completePayload := client.CommandStatusPayload{
		AgentID:  agentID,
		APIKey:   apiKey,
		Action:   "complete",
		Output:   result.Output,
		Error:    result.Error,
		ExitCode: result.ExitCode,
	}

	if err := client.ReportCommandStatus(cmd.ID, agentID, apiKey, completePayload); err != nil {
		log.Printf("Failed to report completion for command %d: %v", cmd.ID, err)
		return
	}

	log.Printf("Command %d completed (exit code: %d, duration: %s)", cmd.ID, result.ExitCode, result.ExecTime)
}