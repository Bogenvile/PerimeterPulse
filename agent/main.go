package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"perimeterpulse-agent/buffer"
	"perimeterpulse-agent/client"
	"perimeterpulse-agent/collector"
)

var (
	serverURL = flag.String("server", "", "PerimeterPulse server URL (e.g. https://your-server.com)")
	apiKey    = flag.String("apikey", "", "API key for agent authentication")
	hostname  = flag.String("hostname", "", "Override auto-detected hostname")
	interval  = flag.Int("interval", 60, "Heartbeat interval in seconds")
	version   = "1.0.0"
)

func main() {
	flag.Parse()

	if *serverURL == "" || *apiKey == "" {
		log.Fatal("Both --server and --apikey flags are required")
	}

	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Printf("PerimeterPulse Agent v%s starting...", version)

	sysInfo := collector.CollectSystemInfo()
	if *hostname != "" {
		sysInfo.Hostname = *hostname
	}
	osInfo := collector.GetOSInfo()
	agentID := collector.GenerateAgentID(sysInfo)

	log.Printf("Agent ID: %s | Hostname: %s | OS: %s %s", agentID, sysInfo.Hostname, osInfo.OS, osInfo.OSVersion)

	apiClient := client.NewClient(*serverURL, *apiKey, agentID)

	log.Println("Registering agent with server...")
	err := apiClient.Register(sysInfo, osInfo, version)
	if err != nil {
		log.Printf("Warning: Registration failed: %v (will retry on first heartbeat)", err)
	}

	heartbeatBuffer := buffer.NewBuffer(1000)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	intervalDuration := time.Duration(*interval) * time.Second
	ticker := time.NewTicker(intervalDuration)
	defer ticker.Stop()

	log.Printf("Heartbeat interval: %ds. Agent running.", *interval)

	log.Println("Flushing buffered heartbeats...")
	flushBuffer(heartbeatBuffer, apiClient)

	for {
		select {
		case <-ticker.C:
			metrics := collector.CollectMetrics()
			networkInfo := collector.CollectNetworkInfo()
			loc, locErr := collector.GetLocation()

			payload := client.HeartbeatPayload{
				Metrics:     metrics,
				NetworkInfo: networkInfo,
			}

			if locErr == nil {
				payload.Location = &loc
			} else {
				log.Printf("Location unavailable: %v", locErr)
			}

			log.Printf("Sending heartbeat: CPU=%.1f%% RAM=%.1f%% Storage=%.1f%% Network=%s",
				metrics.CPUPercent, metrics.RAMPercent, metrics.StoragePercent, metrics.NetworkStatus)

			err := apiClient.SendHeartbeat(payload)
			if err != nil {
				log.Printf("Heartbeat failed: %v (buffering)", err)
				heartbeatBuffer.Add(payload)
			} else {
				if heartbeatBuffer.Size() > 0 {
					log.Printf("Flushing %d buffered heartbeats...", heartbeatBuffer.Size())
					flushBuffer(heartbeatBuffer, apiClient)
				}
			}

		case sig := <-sigCh:
			log.Printf("Received signal %v, shutting down...", sig)
			fmt.Printf("Buffered %d heartbeats. Exiting.\n", heartbeatBuffer.Size())
			heartbeatBuffer.SaveToDisk("pulse-buffer.jsonl")
			return
		}
	}
}

func flushBuffer(buf *buffer.Buffer, apiClient *client.Client) {
	entries := buf.Flush()
	if len(entries) == 0 {
		return
	}

	for _, entry := range entries {
		if hp, ok := entry.(client.HeartbeatPayload); ok {
			err := apiClient.SendHeartbeat(hp)
			if err != nil {
				log.Printf("Buffer flush heartbeat failed: %v", err)
				buf.Add(hp)
				return
			}
		}
	}
}