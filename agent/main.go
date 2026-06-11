package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"perimeterpulse/agent/client"
	"perimeterpulse/agent/collector"
)

const Version = "1.2.0"

func main() {
	// Configuration flags
	serverURL := flag.String("server", "http://localhost:8080", "Server URL")
	apiKey := flag.String("apikey", "", "API Key for authentication")
	hostnameOverride := flag.String("hostname", "", "Override hostname")
	interval := flag.Int("interval", 60, "Heartbeat interval in seconds")
	flag.Parse()

	if *apiKey == "" {
		log.Fatal("API Key is required. Use --apikey flag.")
	}

	log.Printf("Starting PerimeterPulse Agent v%s", Version)
	log.Printf("Connecting to: %s", *serverURL)

	// Initialize Client
	c := client.NewHTTPClient(*serverURL)

	// Collect System Info
	info := collector.CollectInfo(*apiKey)
	if *hostnameOverride != "" {
		info.Hostname = *hostnameOverride
	}

	// Compute Agent ID locally to match server logic
	agentID := computeAgentID(info.Hostname, info.MACAddresses)
	log.Printf("Agent ID: %s", agentID)

	// Register Agent
	if err := c.Register(info); err != nil {
		log.Printf("Registration warning: %v", err)
	} else {
		log.Printf("Registration successful")
	}

	// Main Loop
	ticker := time.NewTicker(time.Duration(*interval) * time.Second)
	defer ticker.Stop()

	// Run immediately once
	runHeartbeat(c, agentID, *apiKey)

	for range ticker.C {
		runHeartbeat(c, agentID, *apiKey)
	}
}

func runHeartbeat(c *client.HTTPClient, agentID, apiKey string) {
	// 1. Check for updates (async-ish, or just check quickly)
	// We do this inside the loop but maybe with a longer cooldown in real app. 
	// For now, just check.
	checkUpdate(c, agentID, apiKey)

	// 2. Collect Metrics & Location
	metrics := collector.CollectMetrics()
	location := collector.CollectLocation()
	network := collector.CollectNetwork()

	// 3. Send Heartbeat
	heartbeatPayload := map[string]interface{}{
		"agent_id":     agentID,
		"api_key":      apiKey,
		"metrics":      metrics,
		"location":     location,
		"network_info": network,
	}

	if err := c.Heartbeat(heartbeatPayload); err != nil {
		log.Printf("Heartbeat error: %v", err)
	}

	// 4. Process Commands
	processCommands(c, agentID, apiKey)
}

func checkUpdate(c *client.HTTPClient, agentID, apiKey string) {
	// Check for update
	// client.go CheckForUpdate(agentID, apiKey, os string)
	osType := runtime.GOOS
	newVersion, downloadUrl, err := c.CheckForUpdate(agentID, apiKey, osType)
	if err != nil {
		return // Silent fail for update check
	}
	if newVersion != "" {
		log.Printf("Update available: v%s", newVersion)
		if downloadUrl != "" {
			log.Printf("Downloading update from: %s", downloadUrl)
			if err := c.DownloadAndReplace(downloadUrl); err != nil {
				log.Printf("Update failed: %v", err)
			} else {
				log.Printf("Update successful. Restarting agent...")
				// Restart logic:
				cmd := exec.Command(os.Args[0], os.Args[1:]...)
				cmd.Stdin = os.Stdin
				cmd.Stdout = os.Stdout
				cmd.Stderr = os.Stderr
				cmd.Start()
				os.Exit(0)
			}
		}
	}
}

func processCommands(c *client.HTTPClient, agentID, apiKey string) {
	commands, err := c.FetchPendingCommands(agentID, apiKey)
	if err != nil {
		return
	}

	for _, cmdInfo := range commands {
		log.Printf("Executing command: %s", cmdInfo.Command)
		
		// Mark as running
		statusPayload := client.CommandStatusPayload{
			AgentID: agentID,
			APIKey:  apiKey,
			Action:  "start",
		}
		c.ReportCommandStatus(cmdInfo.ID, agentID, apiKey, statusPayload)

		// Execute
		var cmd *exec.Cmd
		if runtime.GOOS == "windows" {
			cmd = exec.Command("cmd", "/C", cmdInfo.Command)
		} else {
			cmd = exec.Command("sh", "-c", cmdInfo.Command)
		}
		
		output, err := cmd.CombinedOutput()
		
		// Prepare result payload
		exitCode := 0
		errorMsg := ""
		if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				exitCode = exitErr.ExitCode()
			} else {
				exitCode = 1
			}
			errorMsg = err.Error()
		}

		// We need a pointer to exitCode
		exitCodePtr := &exitCode

		resultPayload := client.CommandStatusPayload{
			AgentID:  agentID,
			APIKey:   apiKey,
			Action:   "complete",
			Output:   string(output),
			Error:    errorMsg,
			ExitCode: exitCodePtr,
		}

		if err := c.ReportCommandStatus(cmdInfo.ID, agentID, apiKey, resultPayload); err != nil {
			log.Printf("Failed to report command status: %v", err)
		}
	}
}

// computeAgentID generates the same ID as the server (hostname + macs)
func computeAgentID(hostname string, macs []string) string {
	fingerprint := hostname + strings.Join(macs, ",")
	var hash int32 = 0
	for _, char := range fingerprint {
		hash = (hash << 5) - hash + int32(char)
	}
	if hash < 0 {
		hash = -hash
	}
	return fmt.Sprintf("agent-%08x", uint32(hash))
}