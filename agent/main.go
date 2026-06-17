package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"perimeterpulse-agent/client"
	"perimeterpulse-agent/collector"
)

const version = "1.0.0"

func main() {
	serverURL := flag.String("server", "", "PerimeterPulse server URL (required)")
	apiKey := flag.String("apikey", "", "API key for agent authentication (required)")
	hostnameOverride := flag.String("hostname", "", "Override auto-detected hostname")
	interval := flag.Int("interval", 60, "Heartbeat interval in seconds")

	flag.Parse()

	if *serverURL == "" || *apiKey == "" {
		fmt.Println("Usage: pulse-agent --server <url> --apikey <key> [--hostname <name>] [--interval <seconds>]")
		os.Exit(1)
	}

	log.Printf("PerimeterPulse Agent v%s starting...\n", version)

	// Collect system info
	sysInfo := collector.CollectSystemInfo()
	if *hostnameOverride != "" {
		sysInfo.Hostname = *hostnameOverride
	}

	osInfo := collector.GetOSInfo()
	agentID := collector.GenerateAgentID(sysInfo.Hostname, sysInfo.MACAddresses)

	log.Printf("Agent ID: %s | Hostname: %s | OS: %s %s\n",
		agentID, sysInfo.Hostname, osInfo.OS, osInfo.OSVersion)

	apiClient := client.NewClient(*serverURL, *apiKey, agentID)

	log.Println("Registering agent with server...")
	if err := apiClient.Register(sysInfo, osInfo, version); err != nil {
		log.Printf("Warning: Registration failed: %v (will retry on first heartbeat)\n", err)
	}

	intervalDuration := time.Duration(*interval) * time.Second
	log.Printf("Heartbeat interval: %s. Agent running.\n", intervalDuration)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(intervalDuration)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			metrics := collector.CollectMetrics()
			network := collector.CollectNetworkInfo()
			location := collector.CollectLocation()

			if err := apiClient.SendHeartbeat(metrics, network, location); err != nil {
				log.Printf("Heartbeat failed: %v\n", err)
			} else {
				log.Println("Heartbeat sent successfully")
			}

		case <-sigCh:
			log.Println("Shutting down...")
			return
		}
	}
}