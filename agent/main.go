package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"agent/collector"
	"agent/client"
)

func main() {
	// Parse command line flags
	server := flag.String("server", "", "Server URL (required)")
	apikey := flag.String("apikey", "", "API key (required or set via APIKEY env var)")
	hostname := flag.String("hostname", "", "Hostname for this agent (optional, auto-detected if empty)")
	interval := flag.Int("interval", 60, "Heartbeat interval in seconds")
	flag.Parse()

	// Resolve API key: flag > env var
	apiKey := *apikey
	if apiKey == "" {
		apiKey = os.Getenv("APIKEY")
	}
	if apiKey == "" {
		log.Fatal("API key is required. Set via --apikey or APIKEY env var")
	}

	// Resolve server URL
	serverURL := *server
	if serverURL == "" {
		serverURL = os.Getenv("SERVER_URL")
	}
	if serverURL == "" {
		log.Fatal("Server URL is required. Set via --server or SERVER_URL env var")
	}

	// Resolve hostname
	host := *hostname
	if host == "" {
		var err error
		host, err = os.Hostname()
		if err != nil {
			log.Fatalf("Cannot determine hostname: %v", err)
		}
	}

	log.Printf("PerimeterPulse Agent starting")
	log.Printf("  Server:   %s", serverURL)
	log.Printf("  Hostname: %s", host)
	log.Printf("  Interval: %ds", *interval)

	// Create client
	c := client.New(serverURL, apiKey, host)

	// Initial registration
	if err := c.Register(); err != nil {
		log.Printf("Initial registration failed: %v (will retry on heartbeat)", err)
	}

	// Heartbeat loop
	ticker := time.NewTicker(time.Duration(*interval) * time.Second)
	defer ticker.Stop()

	// Handle graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Trigger first heartbeat immediately
	doHeartbeat(c)

	for {
		select {
		case <-ticker.C:
			doHeartbeat(c)
		case sig := <-sigCh:
			log.Printf("Received signal %v, shutting down", sig)
			return
		}
	}
}

func doHeartbeat(c *client.Client) {
	metrics := collector.CollectMetrics()
	location := collector.CollectLocation()
	network := collector.CollectNetwork()

	if err := c.Heartbeat(metrics, location, network); err != nil {
		log.Printf("Heartbeat error: %v", err)
	} else {
		log.Println("Heartbeat sent successfully")
	}
}