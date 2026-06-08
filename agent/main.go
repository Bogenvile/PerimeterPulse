package main

import (
	"flag"
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

	// Register the agent
	sysInfo := collector.CollectSystemInfo(host)
	agentID, err := apiClient.Register(sysInfo)
	if err != nil {
		log.Printf("WARNING: registration failed: %v", err)
		log.Println("Continuing without registration — heartbeat will retry later")
		agentID = "unknown"
	}
	log.Printf("Agent ID: %s", agentID)

	// Start flushing buffered data
	buf.Start(agentID)

	// Graceful shutdown
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
	// Collect metrics (always succeeds)
	metrics := collector.CollectMetrics()

	// Network diagnostics
	collector.RunNetworkDiag(&metrics)

	// Collect location (best-effort)
	loc, locErr := collector.CollectLocation()
	if locErr != nil {
		log.Printf("WARNING: location collection failed: %v", locErr)
	}

	// Collect network info (always succeeds)
	netInfo := collector.CollectNetworkInfo()

	// Collect disk health (best-effort)
	diskHealth := collector.CollectDiskHealth()

	// Build heartbeat payload
	payload := client.HeartbeatPayload{
		AgentID:     agentID,
		Metrics:     &metrics,
		NetworkInfo: &netInfo,
	}

	if locErr == nil {
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

	if err := apiClient.SendHeartbeat(payload); err != nil {
		log.Printf("ERROR: heartbeat failed: %v", err)
		_ = buffer.NewBuffer(apiClient) // won't re-save here; buffer already active
	}
}