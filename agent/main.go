package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"agent/collector"
)

type HeartbeatPayload struct {
	AgentID     string                `json:"agent_id"`
	APIKey      string                `json:"api_key"`
	Metrics     *collector.Metrics    `json:"metrics,omitempty"`
	Location    *collector.Location   `json:"location,omitempty"`
	NetworkInfo *collector.NetworkInfo `json:"network_info,omitempty"`
}

var (
	serverURL string
	apiKey    string
	hostname  string
)

func main() {
	serverURL = getEnv("SERVER", "http://localhost:3000")
	apiKey = getEnv("APIKEY", "")
	hostname = getEnv("HOSTNAME", "")

	if apiKey == "" {
		log.Fatal("API key is required. Set via --apikey or APIKEY env var")
	}
	if hostname == "" {
		var err error
		hostname, err = os.Hostname()
		if err != nil {
			log.Fatalf("Failed to get hostname: %v", err)
		}
	}

	register()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	log.Printf("Agent started. Sending heartbeat every 5 seconds.")

	for {
		select {
		case <-ticker.C:
			sendHeartbeat()
		case <-sigCh:
			log.Println("Shutting down...")
			return
		}
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func register() {
	info := collector.CollectInfo(apiKey)
	url := fmt.Sprintf("%s/api/agent/register", serverURL)

	body, err := json.Marshal(info)
	if err != nil {
		log.Printf("Failed to marshal registration: %v", err)
		return
	}

	resp, err := http.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("Registration failed (will retry on heartbeat): %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		log.Println("Registered successfully")
	} else {
		log.Printf("Registration returned status %d", resp.StatusCode)
	}
}

func sendHeartbeat() {
	metrics := collector.CollectMetrics()
	network := collector.CollectNetwork()
	var loc *collector.Location
	if l, err := collector.GetLocation(); err == nil {
		loc = l
	}

	payload := HeartbeatPayload{
		AgentID:     hostname + "-" + getMACShort(),
		APIKey:      apiKey,
		Metrics:     metrics,
		Location:    loc,
		NetworkInfo: network,
	}

	url := fmt.Sprintf("%s/api/agent/heartbeat", serverURL)
	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal heartbeat: %v", err)
		return
	}

	resp, err := http.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("Heartbeat failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		log.Println("Heartbeat sent successfully")
	} else {
		log.Printf("Heartbeat returned status %d", resp.StatusCode)
	}
}

func getMACShort() string {
	netInfo := collector.CollectNetwork()
	if len(netInfo.IPAddresses) > 0 {
		return netInfo.IPAddresses[0]
	}
	return "default"
}