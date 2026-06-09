package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"agent/collector"
	"agent/client"
)

func main() {
	server := flag.String("server", "", "Server URL (e.g. https://example.com)")
	apikey := flag.String("apikey", "", "API key for authentication")
	hostname := flag.String("hostname", "", "Override hostname (optional)")
	interval := flag.Int("interval", 5, "Heartbeat interval in seconds")
	flag.Parse()

	// API key: flag > env
	apiKey := *apikey
	if apiKey == "" {
		apiKey = os.Getenv("APIKEY")
	}
	if apiKey == "" {
		log.Fatal("API key is required. Set via --apikey or APIKEY env var")
	}

	// Server URL: flag > env
	serverURL := *server
	if serverURL == "" {
		serverURL = os.Getenv("SERVER_URL")
	}
	if serverURL == "" {
		log.Fatal("Server URL is required. Set via --server or SERVER_URL env var")
	}

	// Hostname: flag > auto-detect
	host := *hostname
	if host == "" {
		host, _ = os.Hostname()
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

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Send first heartbeat immediately
	sendHeartbeat(c)

	for {
		select {
		case <-ticker.C:
			sendHeartbeat(c)
		case sig := <-sigCh:
			log.Printf("Received signal %v, shutting down", sig)
			return
		}
	}
}

func sendHeartbeat(c *client.Client) {
	metrics := collector.CollectMetrics()
	location := collector.CollectLocation()
	network := collector.CollectNetwork()

	if err := c.Heartbeat(metrics, location, network); err != nil {
		log.Printf("Heartbeat failed: %v", err)
	} else {
		log.Println("Heartbeat sent successfully")
	}
}
