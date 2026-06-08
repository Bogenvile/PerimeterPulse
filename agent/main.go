package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/perimeterpulse/agent/buffer"
	"github.com/perimeterpulse/agent/client"
	"github.com/perimeterpulse/agent/collector"
)

func main() {
	serverURL := flag.String("server", "http://localhost:3000", "PerimeterPulse server URL")
	apiKey := flag.String("apikey", "", "API key for the server")
	hostname := flag.String("hostname", "", "Override hostname (default: OS hostname)")
	flag.Parse()

	if *apiKey == "" {
		log.Fatal("--apikey is required")
	}
	if *serverURL == "" {
		log.Fatal("--server is required")
	}

	apiClient := client.NewClient(*serverURL, *apiKey)
	buf := buffer.NewBuffer(apiClient)

	// Determine hostname
	host := *hostname
	if host == "" {
		var err error
		host, err = os.Hostname()
		if err != nil {
			log.Fatalf("unable to get hostname: %v", err)
		}
	}

	// Collect system info for registration
	sysInfo := collector.CollectSystemInfo(host)

	// Register the agent (retries handled inside the client)
	agentID, err := apiClient.Register(sysInfo)
	if err != nil {
		log.Printf("WARNING: registration failed: %v", err)
		log.Println("Continuing without registration — heartbeat will retry later")
		agentID = "unknown"
	}
	log.Printf("Agent ID: %s", agentID)

	// Start flushing buffered data
	buf.Start(agentID)

	// Handle graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	log.Println("Agent started, sending heartbeat every 60s")
	log.Println("Press Ctrl+C to stop")

	// Immediate first heartbeat
	collectAndSend(agentID, apiClient)

	for {
		select {
		case <-ticker.C:
			collectAndSend(agentID, apiClient)
		case sig := <-sigCh:
			log.Printf("Received signal %v, shutting down", sig)
			buf.Stop()
			return
		}
	}
}

func collectAndSend(agentID string, apiClient *client.Client) {
	// Collect metrics
	metrics, err := collector.CollectMetrics()
	if err != nil {
		log.Printf("ERROR collecting metrics: %v", err)
		return
	}

	// Collect location
	loc, err := collector.CollectLocation()
	if err != nil {
		log.Printf("WARNING collecting location: %v", err)
		// location is optional — continue without it
	}

	// Collect network info
	netInfo, err := collector.CollectNetworkInfo()
	if err != nil {
		log.Printf("WARNING collecting network info: %v", err)
	}

	// Collect disk health (SMART)
	diskHealth, err := collector.CollectDiskHealth()
	if err != nil {
		log.Printf("WARNING collecting disk health: %v", err)
	}

	payload := client.HeartbeatPayload{
		AgentID: agentID,
		Metrics: &metrics,
		NetworkInfo: &netInfo,
	}

	if loc != nil {
		payload.Location = &client.LocationData{
			Latitude:       loc.Latitude,
			Longitude:      loc.Longitude,
			AccuracyMeters: loc.AccuracyMeters,
			Source:         loc.Source,
		}
	}

	if diskHealth != nil {
		payload.Metrics.DiskHealthStatus = &diskHealth.Status
		payload.Metrics.DiskTemperatureC = diskHealth.TemperatureCelsius
	}

	// Send heartbeat (buffered if offline)
	if err := apiClient.SendHeartbeat(payload); err != nil {
		log.Printf("ERROR sending heartbeat: %v", err)
	}
}