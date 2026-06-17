heartbeat setiap 60 detik">
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

func main() {
	serverURL := flag.String("server", "http://localhost:3000", "PerimeterPulse server URL")
	apiKey := flag.String("apikey", "", "Agent API key")
	flag.Parse()

	if *apiKey == "" {
		log.Fatal("--apikey is required")
	}

	sysInfo := collector.CollectSystemInfo()
	osName, osVer := collector.GetOSInfo()
	_ = osName
	_ = osVer

	agentID := collector.GenerateAgentID(sysInfo.Hostname, sysInfo.MacAddresses)
	if agentID == "" {
		agentID = fmt.Sprintf("agent-%x", time.Now().UnixMilli())
	}

	log.Printf("[main] Agent ID: %s | Hostname: %s | OS: %s %s",
		agentID, sysInfo.Hostname, osName, osVer)

	apiClient := client.NewClient(*serverURL, *apiKey)
	offlineBuf, err := buffer.NewFileBuffer("pulse-buffer.jsonl")
	if err != nil {
		log.Printf("[main] Buffer warn: %v", err)
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)

	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		metrics := collector.CollectMetrics(sysInfo.DiskType)
		netInfo := collector.CollectNetworkInfo()
		location := collector.CollectLocation()

		log.Printf("[main] Sending heartbeat for %s", agentID)

		err := apiClient.SendHeartbeat(agentID, metrics, netInfo, location)
		if err != nil {
			log.Printf("[main] Heartbeat error: %v", err)
			if offlineBuf != nil {
				_ = offlineBuf.Append(map[string]interface{}{
					"agent_id": agentID,
					"time":     time.Now().UTC().Format(time.RFC3339),
					"error":    err.Error(),
				})
			}
		} else {
			log.Printf("[main] Heartbeat OK")
			if offlineBuf != nil {
				entries, _ := offlineBuf.ReadAll()
				for _, e := range entries {
					log.Printf("[main] Flushing buffered: %s", string(e))
				}
				_ = offlineBuf.Clear()
			}
		}

		select {
		case <-sigCh:
			log.Println("[main] Shutting down...")
			return
		case <-ticker.C:
			continue
		}
	}
}