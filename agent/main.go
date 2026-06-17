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

	sysInfo := collector.CollectSystemInfo()
	if *hostnameOverride != "" {
		sysInfo.Hostname = *hostnameOverride
	}

	osName, osVersion := collector.GetOSInfo()

	agentID := collector.GenerateAgentID(sysInfo.Hostname, sysInfo.MacAddresses)

	log.Printf("Agent ID: %s | Hostname: %s | OS: %s %s\n",
		agentID, sysInfo.Hostname, osName, osVersion)

	apiClient := client.NewClient(*serverURL, *apiKey)

	intervalDuration := time.Duration(*interval) * time.Second
	log.Printf("Heartbeat interval: %s. Agent running. (Registration will happen on first heartbeat)\n", intervalDuration)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(intervalDuration)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			metrics := collector.CollectMetrics(agentID)
			network := collector.CollectNetworkInfo()
			location := collector.CollectLocation()

			if err := apiClient.SendHeartbeat(agentID, metrics, network, location); err != nil {
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