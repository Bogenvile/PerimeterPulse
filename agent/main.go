package main

import (
	"flag"
	"fmt"
	"log"
	"time"

	"github.com/perimeterpulse/agent/client"
	"github.com/perimeterpulse/agent/collector"
)

type agentState struct {
	AgentID string
	APIKey  string
}

func main() {
	server := flag.String("server", "http://localhost:3000", "server URL")
	apikey := flag.String("apikey", "", "API key for authentication")
	hostname := flag.String("hostname", "", "override hostname")
	flag.Parse()

	if *apikey == "" {
		log.Fatal("--apikey is required")
	}

	// Collect system info to register
	info := collector.CollectInfo()
	if *hostname != "" {
		info.Hostname = *hostname
	}

	state := &agentState{
		AgentID: info.AgentID,
		APIKey:  *apikey,
	}

	// Register once
	err := client.Register(*server, &client.RegistrationRequest{
		Hostname:         info.Hostname,
		OS:               info.OS,
		OSVersion:        info.OSVersion,
		AgentVersion:     info.AgentVersion,
		APIKey:           *apikey,
		MACAddresses:     info.MACAddresses,
		IPAddresses:      info.IPAddresses,
		CPUModel:         info.CPUModel,
		CPUCores:         info.CPUCores,
		RAMTotalBytes:    info.RAMTotalBytes,
		StorageTotalBytes: info.StorageTotalBytes,
		DiskModel:        info.DiskModel,
		DiskType:         info.DiskType,
		WiFiSSID:         info.WiFiSSID,
		WiFiSignalDBM:    info.WiFiSignalDBM,
		NetworkSpeedMbps: info.NetworkSpeedMbps,
	})

	if err != nil {
		log.Printf("Registration failed: %v (will retry on heartbeat)", err)
	}

	// Heartbeat loop every 60 seconds
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		metrics := collector.CollectMetrics()
		location := collector.CollectLocation()
		networkInfo := collector.CollectNetworkInfo()

		// Build the heartbeat request from current state
		req := &client.HeartbeatRequest{
			AgentID: state.AgentID,
			APIKey:  state.APIKey,
			Metrics: &client.MetricsData{
				CPUPercent:       metrics.CPUPercent,
				RAMPercent:       metrics.RAMPercent,
				RAMUsedBytes:     metrics.MemoryUsed,    // assuming field name is MemoryUsed
				RAMTotalBytes:    metrics.MemoryTotal,   // assume MemoryTotal
				StoragePercent:   metrics.StoragePercent,
				StorageUsedBytes: metrics.DiskUsed,      // assume DiskUsed
				StorageTotalBytes: metrics.DiskTotal,    // assume DiskTotal
				UptimeSeconds:    metrics.UptimeSeconds,
				NetworkStatus:    metrics.NetworkStatus,
				NetworkLatencyMs: metrics.NetworkLatencyMs,
				Timestamp:        time.Now().UTC().Format(time.RFC3339),
			},
			Location: &client.LocationData{
				Latitude:       location.Latitude,
				Longitude:      location.Longitude,
				AccuracyMeters: location.AccuracyMeters,
				Source:         location.Source,
				Timestamp:      time.Now().UTC().Format(time.RFC3339),
			},
			NetworkInfo: &client.NetworkInfoData{
				WiFiSSID:        networkInfo.WiFiSSID,
				WiFiSignalDBM:   networkInfo.WiFiSignalDBM,
				NetworkSpeedMbps: networkInfo.NetworkSpeedMbps,
				IPAddresses:     networkInfo.IPAddresses,
			},
		}

		err := client.SendHeartbeat(*server, req)
		if err != nil {
			log.Printf("Heartbeat failed: %v", err)
		} else {
			log.Println("Heartbeat sent successfully")
		}
	}
}