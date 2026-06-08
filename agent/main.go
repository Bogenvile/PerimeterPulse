// PerimeterPulse Agent v2
// Cross-platform health & location monitor for Windows and Linux (Lubuntu).
//
// Extended collection includes:
//   - WiFi SSID & signal strength
//   - IP addresses & network interface speed
//   - SMART disk health & temperature
//   - CPU core count
//
// Compiles to a single static binary:
//
//	go build -ldflags="-s -w" -o pulse-agent .
//
// Usage:
//
//	pulse-agent --server https://your-server.com --apikey ppulse-sk-xxxx --hostname MY-PC

package main

import (
	"encoding/json"
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

var (
	serverURL string
	apiKey    string
	hostname  string
	osName    string
	osVersion string
	agentVer  = "2.0.0"
	batchFile = "pulse_buffer.json"
)

func main() {
	flag.StringVar(&serverURL, "server", "https://localhost:8080", "PerimeterPulse server URL")
	flag.StringVar(&apiKey, "apikey", "", "API key for authentication")
	flag.StringVar(&hostname, "hostname", "", "Hostname override")
	flag.StringVar(&osName, "os", "", "OS name override")
	flag.StringVar(&osVersion, "os-version", "", "OS version override")
	flag.Parse()

	if apiKey == "" {
		log.Fatal("--apikey is required")
	}

	if hostname == "" {
		h, err := os.Hostname()
		if err != nil {
			log.Fatalf("Failed to get hostname: %v", err)
		}
		hostname = h
	}

	log.Printf("PerimeterPulse Agent v%s starting on %s", agentVer, hostname)
	log.Printf("Server: %s", serverURL)

	cli := client.New(serverURL, apiKey)
	buf := buffer.New(batchFile)

	// Register with extended info
	regPayload := collector.BuildRegistration(hostname, osName, osVersion, agentVer)
	agentID, err := cli.Register(regPayload)
	if err != nil {
		log.Printf("Registration failed (will retry in heartbeat): %v", err)
		agentID = buf.LoadAgentID()
	} else {
		log.Printf("Registered as agent %s", agentID)
		buf.SaveAgentID(agentID)
	}

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Flush buffered data on startup
	flushBuffered(cli, buf)

	// Run first collection immediately
	collectAndSend(cli, buf, agentID)

	// Main loop — every 60 seconds
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			collectAndSend(cli, buf, agentID)
		case sig := <-sigCh:
			log.Printf("Received %v, shutting down...", sig)
			flushBuffered(cli, buf)
			return
		}
	}
}

func collectAndSend(cli *client.Client, buf *buffer.Buffer, agentID string) {
	metrics := collector.CollectMetrics()
	loc := collector.CollectLocation()
	netInfo := collector.CollectNetworkInfo()

	payload := client.HeartbeatPayload{
		AgentID:     agentID,
		APIKey:      cli.APIKey(),
		Metrics:     metrics,
		Location:    loc,
		NetworkInfo: netInfo,
	}

	err := cli.SendHeartbeat(payload)
	if err != nil {
		log.Printf("Heartbeat failed: %v (buffering %d bytes)", err, len(batchFile))
		buf.Append(payload)
		return
	}

	log.Printf("Heartbeat OK: CPU=%.1f%% RAM=%.1f%% Disk=%s/%s WiFi=%s Loc=(%.4f,%.4f)",
		metrics.CPUPercent,
		metrics.RAMPercent,
		metrics.DiskHealthStatus,
		netInfo.WifiSSID,
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
			buf.AppendRaw(item)
		} else {
			success++
		}
	}
	log.Printf("Flushed %d/%d payloads", success, len(items))
}
