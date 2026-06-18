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
	"perimeterpulse-agent/commands"
)

const version = "1.1.0"

func main() {
	serverURL := flag.String("server", "", "PerimeterPulse server URL (required)")
	apiKey := flag.String("apikey", "", "API key for agent authentication (required)")
	hostnameOverride := flag.String("hostname", "", "Override auto-detected hostname")
	interval := flag.Int("interval", 3, "Heartbeat interval in seconds")

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

	apiClient := client.NewClient(*serverURL, *apiKey, sysInfo.Hostname)

	intervalDuration := time.Duration(*interval) * time.Second
	log.Printf("Heartbeat interval: %s. Agent running.\n", intervalDuration)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	commandDone := make(chan struct{}, 1)
	commandDone <- struct{}{}

	ticker := time.NewTicker(intervalDuration)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			metrics := collector.CollectMetrics(agentID)
			network := collector.CollectNetworkInfo()
			location := collector.CollectLocation()

			log.Printf("CPU: %s (%d cores) | RAM: %d/%d (%.1f%%) | Disk: %d/%d (%.1f%%) | DiskModel: %s Type: %s Health: %s",
				metrics.CPUModel, metrics.CPUCores,
				metrics.RAMUsedBytes, metrics.RAMTotalBytes, metrics.RAMPerecent,
				metrics.StorageUsedBytes, metrics.StorageTotalBytes, metrics.StoragePercent,
				metrics.DiskModel, metrics.DiskType, metrics.DiskHealthStatus)

			if err := apiClient.SendHeartbeat(agentID, metrics, network, location); err != nil {
				log.Printf("Heartbeat failed: %v\n", err)
			} else {
				log.Println("Heartbeat sent successfully")
			}

			select {
			case <-commandDone:
				go pollAndExecute(apiClient, agentID, commandDone)
			default:
			}

		case <-sigCh:
			log.Println("Shutting down...")
			return
		}
	}
}

func pollAndExecute(c *client.Client, agentID string, done chan<- struct{}) {
	defer func() { done <- struct{}{} }()

	cmds, err := c.FetchCommands(agentID)
	if err != nil {
		log.Printf("Command poll failed: %v", err)
		return
	}

	if len(cmds) == 0 {
		return
	}

	log.Printf("Fetched %d pending command(s)", len(cmds))

	for _, cmd := range cmds {
		log.Printf("Executing command #%d: %s", cmd.ID, cmd.Command)

		if err := c.ReportCommandStart(agentID, cmd.ID); err != nil {
			log.Printf("Failed to report start for #%d: %v", cmd.ID, err)
			continue
		}

		result := commands.Execute(cmd.Command)
		log.Printf("Command #%d done (exit=%d, output=%d bytes)", cmd.ID, result.ExitCode, len(result.Output))

		if err := c.ReportCommandResult(agentID, cmd.ID, result); err != nil {
			log.Printf("Failed to report result for #%d: %v", cmd.ID, err)
		}
	}
}
