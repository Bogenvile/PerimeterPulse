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

	"pulse-agent/buffer"
	"pulse-agent/client"
	"pulse-agent/collector"
	"pulse-agent/commands"
)

var (
	serverFlag   = flag.String("server", "", "PerimeterPulse server URL (required)")
	apiKeyFlag   = flag.String("apikey", "", "API key for agent auth (required)")
	hostnameFlag = flag.String("hostname", "", "Override auto-detected hostname")
	intervalFlag = flag.Int("interval", 60, "Heartbeat interval in seconds (min 10)")
)

func main() {
	flag.Parse()

	if *serverFlag == "" || *apiKeyFlag == "" {
		fmt.Fprintf(os.Stderr, "Usage: pulse-agent --server <URL> --apikey <KEY> [--hostname <NAME>] [--interval <SECONDS>]\n")
		os.Exit(1)
	}

	// Validate interval
	interval := *intervalFlag
	if interval < 10 {
		interval = 10
	}

	// Get hostname
	hostname := *hostnameFlag
	if hostname == "" {
		h, err := os.Hostname()
		if err != nil {
			log.Fatalf("Failed to get hostname: %v", err)
		}
		hostname = h
	}

	// Collect system info
	sysInfo := collector.CollectSystemInfo()
	sysInfo.Hostname = hostname

	// Generate stable agent ID
	agentID := collector.GenerateAgentID(sysInfo)

	// Get OS info
	osInfo := collector.GetOSInfo()

	log.Printf("🖥️  PerimeterPulse Agent v1.0.0")
	log.Printf("   Hostname: %s", hostname)
	log.Printf("   OS: %s %s", osInfo.OS, osInfo.OSVersion)
	log.Printf("   Agent ID: %s", agentID)

	// Create API client
	api := client.New(*serverFlag, *apiKeyFlag, agentID, hostname)

	// Register with server
	log.Printf("📡 Registering with server...")
	err := api.Register(collector.RegistrationPayload{
		Hostname:          hostname,
		OS:                osInfo.OS,
		OSVersion:         osInfo.OSVersion,
		AgentVersion:      "1.0.0",
		MACAddresses:      sysInfo.MACAddresses,
		IPAddresses:       sysInfo.IPAddresses,
		CPUModel:          sysInfo.CPUModel,
		CPUCores:          sysInfo.CPUCores,
		RAMTotalBytes:     sysInfo.RAMTotalBytes,
		StorageTotalBytes: sysInfo.StorageTotalBytes,
		DiskModel:         sysInfo.DiskModel,
		DiskType:          sysInfo.DiskType,
		WiFiSSID:          sysInfo.WiFiSSID,
		WiFiSignalDBM:     sysInfo.WiFiSignalDBM,
		NetworkSpeedMbps:  sysInfo.NetworkSpeedMbps,
	})
	if err != nil {
		log.Printf("⚠️  Registration warning: %v", err)
	} else {
		log.Printf("✅ Registered successfully")
	}

	// Start offline buffer
	buf := buffer.New(api)
	buf.Start()

	// Signal handling
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	log.Printf("✅ Agent running. Press Ctrl+C to stop.")

	// Main loop
	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()

	// Send first heartbeat immediately
	sendHeartbeat(api, hostname, buf)

	for {
		select {
		case <-ticker.C:
			sendHeartbeat(api, hostname, buf)
		case sig := <-sigChan:
			log.Printf("🛑 Received %v, shutting down...", sig)
			buf.Flush()
			os.Exit(0)
		}
	}
}

func sendHeartbeat(api *client.ApiClient, hostname string, buf *buffer.Buffer) {
	// Collect metrics
	metrics := collector.CollectMetrics()

	// Collect location
	location, locErr := collector.GetLocation()
	if locErr != nil {
		log.Printf("[location] ❌ GetLocation error: %v", locErr)
	} else {
		log.Printf("[location] 📍 Collected: lat=%.4f lng=%.4f source=%s city=%s country=%s",
			location.Latitude, location.Longitude, location.Source, location.City, location.Country)
	}

	// Collect network info
	networkInfo := collector.CollectNetworkInfo()

	// Fetch pending commands
	cmds, _ := api.FetchCommands()
	for _, cmd := range cmds {
		log.Printf("[commands] Executing #%d: %s", cmd.ID, cmd.Command)
		execResult := commands.Execute(cmd.Command)
		status := "completed"
		if execResult.Error != "" {
			status = "failed"
		}
		api.ReportCommandResult(cmd.ID, "complete", execResult.Output, execResult.Error, execResult.ExitCode)
		_ = status
	}

	// Send heartbeat
	err := api.SendHeartbeat(metrics, location, networkInfo)
	if err != nil {
		log.Printf("[heartbeat] ❌ Failed: %v", err)
		buf.Store(metrics, location, networkInfo)
		return
	}

	log.Printf("💓 Heartbeat sent")
}