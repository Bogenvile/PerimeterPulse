package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"perimeterpulse/agent/collector"
	"perimeterpulse/agent/client"
	"perimeterpulse/agent/buffer"
)

func main() {
	server := flag.String("server", "", "Server URL (e.g. https://example.com)")
	apikey := flag.String("apikey", "", "API key for authentication")
	hostname := flag.String("hostname", "", "Override hostname (optional)")
	flag.Parse()

	// Priority: flag > env
	apiKey := *apikey
	if apiKey == "" {
		apiKey = os.Getenv("API_KEY")
	}
	if apiKey == "" {
		log.Fatal("API_KEY environment variable or --apikey flag required")
	}

	serverURL := *server
	if serverURL == "" {
		serverURL = os.Getenv("SERVER_URL")
	}
	if serverURL == "" {
		log.Fatal("SERVER_URL environment variable or --server flag required")
	}

	// Initialize client
	c := client.New(serverURL, apiKey)

	// Collect initial info
	info := collector.CollectInfo(apiKey)

	if *hostname != "" {
		info.Hostname = *hostname
	}

	// Register on startup
	log.Println("Registering agent...")
	err := c.Register(info)
	if err != nil {
		log.Printf("Register failed (will retry): %v", err)
	} else {
		log.Println("Registered successfully")
	}

	// Load offline buffer
	buf := buffer.New("pulse-buffer.jsonl")
	buf.Flush(c.SendHeartbeat)

	log.Println("Agent started. Sending heartbeat every 60 seconds.")

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			metrics := collector.CollectMetrics()
			loc := collector.CollectLocation()
			netInfo := collector.CollectNetwork()

			err := c.SendHeartbeat(metrics, loc, netInfo)
			if err != nil {
				log.Printf("Heartbeat failed: %v, buffering...", err)
				buf.Save(metrics, loc, netInfo)
			} else {
				log.Println("Heartbeat sent")
			}

		case <-sigChan:
			log.Println("Shutting down...")
			// Send final heartbeat
			metrics := collector.CollectMetrics()
			loc := collector.CollectLocation()
			netInfo := collector.CollectNetwork()
			_ = c.SendHeartbeat(metrics, loc, netInfo)
			return
		}
	}
}