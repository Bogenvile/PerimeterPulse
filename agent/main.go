// PerimeterPulse Agent
// Cross-platform health & location monitor for Windows and Linux (Lubuntu).
// Compiles to a single static binary: go build -ldflags="-s -w" -o pulse-agent .
//
// Usage:
//
//	pulse-agent --server https://your-server.com --apikey sk-xxxx --hostname MY-PC
//
// The agent registers itself with the server on startup and then sends
// metrics + location every 60 seconds. If the network is unavailable,
// data is buffered to a local file and flushed when connectivity returns.

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

var (
	serverURL  string
	apiKey     string
	hostname   string
	osName     string
	osVersion  string
	agentVer   = "1.0.0"
	batchFile  = "pulse_buffer.json"
)

func main() {
	flag.StringVar(&serverURL, "server", "https://localhost:8080", "PerimeterPulse server URL")
	flag.StringVar(&apiKey, "apikey", "", "API key for authentication")
	flag.StringVar(&hostname, "hostname", "", "Hostname override (default: OS hostname)")
	flag.StringVar(&osName, "os", "", "OS name override (default: runtime.GOOS)")
	flag.StringVar(&osVersion, "os-version", "", "OS version override")
	flag.Parse()

	if apiKey == "" {
		log.Fatal("--apikey is required")
	}

	// Determine hostname
	if hostname == "" {
		h, err := os.Hostname()
		if err != nil {
			log.Fatalf("Failed to get hostname: %v", err)
		}
		hostname = h
	}

	log.Printf("PerimeterPulse Agent v%s starting on %s", agentVer, hostname)
	log.Printf("Server: %s", serverURL)

	// Create HTTP client
	cli := client.New(serverURL, apiKey)

	// Create offline buffer
	buf := buffer.New(batchFile)

	// Attempt registration
	regPayload := collector.BuildRegistration(hostname, osName, osVersion, agentVer)
	agentID, err := cli.Register(regPayload)
	if err != nil {
		log.Printf("Registration failed (will retry in heartbeat): %v", err)
		// Try to load an existing agent_id from buffer
		agentID = buf.LoadAgentID()
	} else {
		log.Printf("Registered as agent %s", agentID)
		buf.SaveAgentID(agentID)
	}

	// Signal handling for graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Flush buffered data on startup
	flushBuffered(cli, buf)

	// Main collection loop — every 60 seconds
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	// Run first collection immediately
	collectAndSend(cli, buf, agentID, hostname)

	for {
		select {
		case <-ticker.C:
			collectAndSend(cli, buf, agentID, hostname)
		case sig := <-sigCh:
			log.Printf("Received %v, shutting down...", sig)
			// Flush any remaining buffered data
			flushBuffered(cli, buf)
			return
		}
	}
}

func collectAndSend(cli *client.Client, buf *buffer.Buffer, agentID, hostname string) {
	// Collect metrics
	metrics := collector.CollectMetrics()

	// Collect location (OS API first, then GeoIP fallback)
	loc := collector.CollectLocation()

	payload := client.HeartbeatPayload{
		AgentID:  agentID,
		APIKey:   cli.APIKey(),
		Metrics:  metrics,
		Location: loc,
	}

	err := cli.SendHeartbeat(payload)
	if err != nil {
		log.Printf("Heartbeat failed: %v (buffering)", err)
		buf.Append(payload)
		return
	}

	log.Printf("Heartbeat sent: CPU=%.1f%% RAM=%.1f%% Storage=%.1f%% Loc=(%.4f,%.4f)",
		metrics.CPUPercent,
		metrics.RAMPercent,
		metrics.StoragePercent,
		loc.Latitude,
		loc.Longitude,
	)
}

func flushBuffered(cli *client.Client, buf *buffer.Buffer) {
	items := buf.Flush()
	if len(items) == 0 {
		return
	}

	log.Printf("Flushing %d buffered payloads...", len(items))
	success := 0
	for _, item := range items {
		var payload client.HeartbeatPayload
		if err := json.Unmarshal(item, &payload); err != nil {
			continue
		}
		payload.APIKey = cli.APIKey()
		if err := cli.SendHeartbeat(payload); err != nil {
			// Re-buffer failed items
			buf.AppendRaw(item)
		} else {
			success++
		}
	}
	log.Printf("Flushed %d/%d payloads successfully", success, len(items))
}
