package main

import (
	"encoding/json"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"perimeterpulse-agent/client"
	"perimeterpulse-agent/collector"
	"perimeterpulse-agent/commands"
)

var (
	serverURL = flag.String("server", "http://localhost:3000", "PerimeterPulse server URL")
	apiKey    = flag.String("apikey", "", "API key for authentication")
	hostname  = flag.String("hostname", "", "Override hostname")
	interval  = flag.Int("interval", 3, "Heartbeat interval in seconds")
	version   = "1.0.0"
	agentID   string
	startTime time.Time
)

func init() {
	startTime = time.Now()
}

func main() {
	flag.Parse()

	if *apiKey == "" {
		log.Fatal("API key is required. Use --apikey flag")
	}

	// Set hostname
	agentHostname := *hostname
	if agentHostname == "" {
		var err error
		agentHostname, err = os.Hostname()
		if err != nil {
			log.Fatalf("Failed to get hostname: %v", err)
		}
	}

	// Load or generate agent ID
	agentID = collector.GetOrCreateAgentID(agentHostname)

	log.Printf("🖥️  PerimeterPulse Agent v%s", version)
	log.Printf("   Agent ID : %s", agentID)
	log.Printf("   Hostname : %s", agentHostname)
	log.Printf("   Server   : %s", *serverURL)
	log.Printf("   Interval : %d seconds", *interval)
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	// Initialize API client
	apiClient := client.NewClient(*serverURL, *apiKey, version)

	// Register agent
	if err := apiClient.Register(agentID, agentHostname); err != nil {
		log.Printf("⚠️  Registration warning: %v", err)
	}

	// Start command polling in background
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			commands.ProcessCommands(*serverURL, agentID, *apiKey)
		}
	}()

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Main heartbeat loop
	ticker := time.NewTicker(time.Duration(*interval) * time.Second)
	defer ticker.Stop()

	// Send first heartbeat immediately
	sendHeartbeat(apiClient, agentHostname)

	for {
		select {
		case <-ticker.C:
			sendHeartbeat(apiClient, agentHostname)
		case sig := <-sigChan:
			log.Printf("🛑 Received signal %v, shutting down...", sig)
			return
		}
	}
}

func sendHeartbeat(apiClient *client.Client, hostname string) {
	// Collect hardware metrics
	cpuPercent, err := collector.GetCPUPercent()
	if err != nil {
		log.Printf("⚠️  Failed to get CPU: %v", err)
		cpuPercent = 0
	}

	ramPercent, ramUsed, ramTotal, err := collector.GetRAMInfo()
	if err != nil {
		log.Printf("⚠️  Failed to get RAM: %v", err)
		ramPercent, ramUsed, ramTotal = 0, 0, 0
	}

	storagePercent, storageUsed, storageTotal, err := collector.GetStorageInfo()
	if err != nil {
		log.Printf("⚠️  Failed to get Storage: %v", err)
		storagePercent, storageUsed, storageTotal = 0, 0, 0
	}

	uptimeSeconds, err := collector.GetSystemUptime()
	if err != nil {
		uptimeSeconds = 0
	}

	// Collect network info
	networkInfo := collector.CollectNetworkInfo()

	// Collect location - HANYA jika valid
	var location *collector.LocationData
	loc := collector.GetLocation()
	if loc.Latitude != 0 || loc.Longitude != 0 {
		location = &loc
		log.Printf("📍 Location: %.4f, %.4f (source: %s, accuracy: %.0fm)",
			loc.Latitude, loc.Longitude, loc.Source, loc.AccuracyMeters)
	} else {
		log.Printf("📍 Location: not available")
	}

	// Collect disk health (SMART)
	diskHealth, diskTemp := collector.GetDiskHealth()

	// Collect network diagnostics
	diag := collector.RunNetworkDiagnostics()

	// Build heartbeat payload
	payload := client.HeartbeatPayload{
		AgentID: agentID,
		APIKey:  *apiKey,
		Metrics: client.MetricsData{
			CPUPercent:        cpuPercent,
			RAMPercent:        ramPercent,
			RAMUsedBytes:      ramUsed,
			RAMTotalBytes:     ramTotal,
			StoragePercent:    storagePercent,
			StorageUsedBytes:  storageUsed,
			StorageTotalBytes: storageTotal,
			UptimeSeconds:     int(uptimeSeconds),
			NetworkStatus:     diag.Status,
			NetworkLatencyMs:  diag.LatencyMs,
			PingLatencyMs:     diag.PingLatencyMs,
			ErrorCount:        0,
			// Network Diagnostics
			GatewayReachable:   diag.GatewayReachable,
			DNSWorking:         diag.DNSWorking,
			InternetReachable:  diag.InternetReachable,
			DefaultGateway:     diag.DefaultGateway,
			DiskHealthStatus:   diskHealth,
			DiskTemperatureC:   diskTemp,
			Timestamp:          time.Now().UTC().Format(time.RFC3339),
		},
		NetworkInfo: client.NetworkInfoData{
			WiFiSSID:         networkInfo.WiFiSSID,
			WiFiSignalDBM:    networkInfo.WiFiSignalDBM,
			NetworkSpeedMbps: networkInfo.NetworkSpeedMbps,
			IPAddresses:      networkInfo.IPAddresses,
			WiFiIP:           networkInfo.WiFiIP,
			GatewayIP:        networkInfo.GatewayIP,
		},
	}

	// Hanya sertakan location jika valid
	if location != nil {
		payload.Location = &client.LocationData{
			Latitude:       location.Latitude,
			Longitude:      location.Longitude,
			AccuracyMeters: location.AccuracyMeters,
			Source:         location.Source,
			City:           location.City,
			Country:        location.Country,
			Timestamp:      location.Timestamp,
		}
	} else {
		// Jangan kirim lokasi sama sekali jika tidak valid
		payload.Location = nil
	}

	// Send heartbeat
	_, err = apiClient.Heartbeat(&payload)
	if err != nil {
		log.Printf("❌ Heartbeat failed: %v", err)
		return
	}

	log.Printf("✅ Heartbeat sent (CPU: %.1f%%, RAM: %.1f%%, Disk: %s, Net: %s)",
		cpuPercent, ramPercent, diskHealth, diag.Status)
}

// Export fungsi untuk digunakan oleh collector
func GetVersion() string {
	return version
}

func GetStartTime() time.Time {
	return startTime
}

// Helper untuk JSON unmarshaling (digunakan di collector)
func jsonUnmarshal(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}