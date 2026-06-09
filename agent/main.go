package main

import (
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
	// Parse command-line flags
	serverURL := flag.String("server", "http://localhost:3000", "Server URL")
	apiKey := flag.String("apikey", "", "API Key")
	hostname := flag.String("hostname", "", "Custom hostname (optional)")
	bufferPath := flag.String("buffer", "./agent-buffer.jsonl", "Path to offline buffer file")
	interval := flag.Duration("interval", 60*time.Second, "Heartbeat interval")
	flag.Parse()

	if *apiKey == "" {
		log.Fatal("--apikey is required")
	}

	// Initialize HTTP client
	httpClient := client.NewClient(*serverURL, *apiKey)

	// Initialize offline buffer
	buf := buffer.NewBuffer(*bufferPath)

	// Collect initial system info (registration)
	sysInfo := collector.CollectSystemInfo()

	// Use custom hostname if provided, otherwise use system hostname
	if *hostname != "" {
		sysInfo.Hostname = *hostname
	}

	// Register with server
	registerPayload := client.RegisterPayload{
		Hostname:       sysInfo.Hostname,
		OS:             sysInfo.OS,
		OSVersion:      sysInfo.OSVersion,
		AgentVersion:   "1.0.0",
		APIKey:         *apiKey,
		MacAddresses:   sysInfo.MacAddresses,
		CPUModel:       sysInfo.CPUModel,
		CPUCores:       sysInfo.CPUCores,
		RAMTotalBytes:  sysInfo.RAMTotal,
		StorageTotalBytes: sysInfo.StorageTotal,
	}

	log.Printf("Registering agent: %s", sysInfo.Hostname)
	agentID, err := httpClient.Register(registerPayload)
	if err != nil {
		log.Printf("Registration failed: %v (will continue with retries)", err)
	} else {
		log.Printf("Registered as agent: %s", agentID)
	}

	// Replay buffered heartbeats if any
	if buf.HasPending() {
		log.Println("Replaying buffered heartbeats...")
		payloads := buf.Flush()
		for _, payload := range payloads {
			if err := httpClient.SendRaw(payload); err != nil {
				log.Printf("Failed to replay buffered heartbeat: %v", err)
				buf.Append(payload)
			}
		}
	}

	// Setup signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Main heartbeat loop
	ticker := time.NewTicker(*interval)
	defer ticker.Stop()

	for {
		select {
		case <-sigChan:
			log.Println("Shutting down...")
			return
		case <-ticker.C:
			sendHeartbeat(httpClient, buf, sysInfo)
		}
	}
}

func sendHeartbeat(httpClient *client.Client, buf *buffer.Buffer, sysInfo collector.SystemInfo) {
	// Collect current metrics
	metrics := collector.CollectMetrics()
	netInfo := collector.CollectNetworkInfo()
	loc := collector.CollectLocation()

	now := time.Now().UTC()

	// Build heartbeat payload
	heartbeat := client.HeartbeatPayload{
		AgentID: "", // Will be set by agent registration or read from config
		APIKey:  httpClient.APIKey,
		Metrics: &client.HeartbeatMetrics{
			CPUPercent:       metrics.CPUPercent,
			RAMPercent:       metrics.RAMPercent,
			RAMUsedBytes:     metrics.RAMUsed,
			RAMTotalBytes:    metrics.RAMTotal,
			StoragePercent:   metrics.StoragePercent,
			StorageUsedBytes: metrics.StorageUsed,
			StorageTotalBytes: metrics.StorageTotal,
			UptimeSeconds:    metrics.UptimeSeconds,
			NetworkStatus:    metrics.NetworkStatus,
			NetworkLatencyMs: metrics.NetworkLatencyMs,
			DiskHealthStatus: metrics.DiskHealthStatus,
			DiskTemperatureC: metrics.DiskTemperatureC,
			Timestamp:        now.Format(time.RFC3339),
		},
		NetworkInfo: &client.HeartbeatNetworkInfo{
			WifiSSID:        netInfo.WifiSSID,
			WifiSignalDBM:   netInfo.WifiSignalDBM,
			NetworkSpeedMbps: netInfo.NetworkSpeedMbps,
			IPAddresses:     netInfo.IPAddresses,
		},
		Location: &client.HeartbeatLocation{
			Latitude:     loc.Latitude,
			Longitude:    loc.Longitude,
			AccuracyM:    loc.AccuracyMeters,
			Source:       loc.Source,
			Timestamp:    now.Format(time.RFC3339),
		},
	}

	// Send heartbeat
	err := httpClient.Heartbeat(heartbeat)
	if err != nil {
		log.Printf("Heartbeat failed: %v (buffering for later)", err)
		// Buffer the heartbeat for retry
		buf.Append(heartbeat)
	} else {
		log.Printf("Heartbeat sent successfully for %s", sysInfo.Hostname)
	}
}