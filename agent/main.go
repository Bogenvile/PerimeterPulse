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
	agentID = regPayload.Hostname

	if err := httpClient.Register(regPayload); err != nil {
		log.Printf("Registration warning: %v (will retry on next heartbeat)", err)
	}
	log.Println("Agent registered successfully")

	// Start background goroutines
	go pollCommands(httpClient, agentID, *apiKey)
	go checkForUpdates(httpClient, agentID, *apiKey)

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

func runHeartbeat(c *client.HTTPClient, agentID, key string) {
	metrics := collector.CollectMetrics()
	network := collector.CollectNetwork()
	location := collector.CollectLocation()

	payload := map[string]any{
		"agent_id":     agentID,
		"api_key":      key,
		"metrics":      metrics,
		"network_info": network,
		"location":     location,
	}

	if err := c.Heartbeat(payload); err != nil {
		log.Printf("Heartbeat error: %v", err)
		return
	}
	log.Println("Heartbeat sent successfully")
}

func pollCommands(c *client.HTTPClient, agentID, apiKey string) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	log.Println("Command polling started (interval: 10s)")

	for range ticker.C {
		cmds, err := c.FetchPendingCommands(agentID, apiKey)
		if err != nil {
			log.Printf("Failed to fetch commands: %v", err)
			continue
		}

		for _, cmd := range cmds {
			go executeAndReport(c, agentID, apiKey, cmd)
		}
	}
}

func executeAndReport(c *client.HTTPClient, agentID, apiKey string, cmd client.PendingCommand) {
	log.Printf("Executing command %d: %s", cmd.ID, cmd.Command)

	startPayload := client.CommandStatusPayload{
		AgentID: agentID,
		APIKey:  apiKey,
		Action:  "start",
	}
	if err := c.ReportCommandStatus(cmd.ID, agentID, apiKey, startPayload); err != nil {
		log.Printf("Failed to report start for command %d: %v", cmd.ID, err)
	}

	result := commands.Execute(cmd.ID, cmd.Command)

	completePayload := client.CommandStatusPayload{
		AgentID:  agentID,
		APIKey:   apiKey,
		Action:   "complete",
		Output:   result.Output,
		Error:    result.Error,
		ExitCode: result.ExitCode,
	}

	if err := c.ReportCommandStatus(cmd.ID, agentID, apiKey, completePayload); err != nil {
		log.Printf("Failed to report completion for command %d: %v", cmd.ID, err)
		return
	}

	log.Printf("Command %d completed (exit code: %d, duration: %s)", cmd.ID, result.ExitCode, result.ExecTime)
}

func checkForUpdates(c *client.HTTPClient, agentID, apiKey string) {
	ticker := time.NewTicker(1 * time.Hour) // Check every hour
	defer ticker.Stop()

	log.Println("Auto-update check started (interval: 1h)")

	for range ticker.C {
		newVersion, downloadURL, err := c.CheckForUpdate(agentID, apiKey, runtime.GOOS, runtime.GOARCH)
		if err != nil {
			log.Printf("Update check error: %v", err)
			continue
		}
		if newVersion == "" {
			continue
		}

		log.Printf("New version available: %s. Downloading from %s...", newVersion, downloadURL)
		if err := c.DownloadAndReplace(downloadURL); err != nil {
			log.Printf("Auto-update failed: %v", err)
			continue
		}

		log.Println("Auto-update successful. Restarting agent...")
		restartSelf()
		return
	}
}

func restartSelf() {
	executable, err := os.Executable()
	if err != nil {
		log.Fatalf("Cannot determine executable path: %v", err)
	}
	cmd := exec.Command(executable, os.Args[1:]...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		log.Fatalf("Failed to restart: %v", err)
	}
	os.Exit(0)
}