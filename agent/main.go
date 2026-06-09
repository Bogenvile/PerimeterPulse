package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"agent/collector"
)

var agentID string

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

	// Register → get agent_id
	register(serverURL, host, apiKey)

	// Heartbeat loop
	ticker := time.NewTicker(time.Duration(*interval) * time.Second)
	defer ticker.Stop()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	sendHeartbeat(serverURL, apiKey)

	for {
		select {
		case <-ticker.C:
			sendHeartbeat(serverURL, apiKey)
		case sig := <-sigCh:
			log.Printf("Received signal %v, shutting down", sig)
			return
		}
	}
}

func register(serverURL, hostname, apiKey string) {
	info := collector.CollectInfo(apiKey)
	info.Hostname = hostname

	body, err := json.Marshal(info)
	if err != nil {
		log.Printf("Failed to marshal registration: %v", err)
		return
	}

	resp, err := http.Post(serverURL+"/api/agent/register", "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("Registration failed: %v", err)
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == 200 {
		var result struct {
			Ok      bool   `json:"ok"`
			AgentID string `json:"agent_id"`
		}
		if err := json.Unmarshal(respBody, &result); err == nil && result.AgentID != "" {
			agentID = result.AgentID
			log.Printf("Registered successfully, agent_id: %s", agentID)
			return
		}
		// Fallback: compute locally same way as server
		macs := info.MACAddresses
		fingerprint := hostname + strings.Join(macs, ",")
		agentID = simpleHash(fingerprint)
		log.Printf("Registered (local id), agent_id: %s", agentID)
	} else {
		log.Printf("Registration returned status %d: %s", resp.StatusCode, string(respBody))
		// Still compute local ID for heartbeat fallback
		macs := info.MACAddresses
		fingerprint := hostname + strings.Join(macs, ",")
		agentID = simpleHash(fingerprint)
		log.Printf("Using local agent_id: %s", agentID)
	}
}

func sendHeartbeat(serverURL, apiKey string) {
	if agentID == "" {
		log.Println("Cannot send heartbeat: no agent_id")
		return
	}

	metrics := collector.CollectMetrics()
	network := collector.CollectNetwork()
	location := collector.CollectLocation()

	payload := map[string]interface{}{
		"agent_id":     agentID,
		"api_key":      apiKey,
		"metrics":      metrics,
		"network_info": network,
		"location":     location,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal heartbeat: %v", err)
		return
	}

	resp, err := http.Post(serverURL+"/api/agent/heartbeat", "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("Heartbeat failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 200 {
		log.Println("Heartbeat sent successfully")
	} else {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("Heartbeat returned status %d: %s", resp.StatusCode, string(respBody))
	}
}

// Must match server's simpleHash EXACTLY
func simpleHash(input string) string {
	var hash int32 = 0
	for i := 0; i < len(input); i++ {
		hash = (hash << 5) - hash + int32(input[i])
	}
	if hash < 0 {
		hash = -hash
	}
	return fmt.Sprintf("agent-%08x", uint32(hash))
}
