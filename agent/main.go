package main

import (
	"flag"
	"log"
	"time"

	"perimeterpulse/agent/client"
	"perimeterpulse/agent/collector"
)

func main() {
	server := flag.String("server", "http://localhost:3000", "Server URL")
	apiKey := flag.String("apikey", "", "API Key")
	hostname := flag.String("hostname", "", "Hostname override")
	interval := flag.Int("interval", 60, "Heartbeat interval in seconds")
	flag.Parse()

	if *apiKey == "" {
		log.Fatal("API Key is required (--apikey)")
	}

	agentID := collector.GetAgentID(*hostname)
	log.Printf("Starting PerimeterPulse Agent v1.2.0")
	log.Printf("Connecting to: %s", *server)
	log.Printf("Agent ID: %s", agentID)

	c := client.NewClient(*server, *apiKey)

	// Initial Registration
	hw := collector.GetHardwareInfo()
	if err := c.Register(agentID, hw); err != nil {
		log.Fatalf("Registration failed: %v", err)
	}
	log.Println("Registration successful")

	// Heartbeat Loop
	for {
		metrics := collector.GetMetrics()
		wifiSSID, wifiSignal, wifiIP := collector.GetWifiInfo()
		ips := collector.GetAllIPs()
		location := collector.GetLocation()

		payload := client.HeartbeatPayload{
			AgentID: agentID,
			APIKey:  *apiKey,
			Metrics: metrics,
			Location: location,
			NetworkInfo: client.NetworkInfo{
				WiFiSSID:         wifiSSID,
				WiFiSignalDBM:    wifiSignal,
				WiFiIP:           wifiIP,
				IPAddresses:      ips,
				NetworkSpeedMbps: 0,
			},
		}

		if err := c.SendHeartbeat(payload); err != nil {
			log.Printf("Heartbeat error: %v", err)
		}

		time.Sleep(time.Duration(*interval) * time.Second)
	}
}