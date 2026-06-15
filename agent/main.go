package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"perimeterpulse/agent/buffer"
	"perimeterpulse/agent/client"
	"perimeterpulse/agent/collector"
	"perimeterpulse/agent/commands"
)

const (
	defaultServer   = "http://localhost:3000"
	defaultInterval = 60
	defaultAPIKey   = ""
	idFileName      = "pulse-agent.id"
)

func main() {
	serverURL := flag.String("server", defaultServer, "PerimeterPulse server URL")
	apiKey := flag.String("apikey", defaultAPIKey, "API key for authentication")
	hostnameFlag := flag.String("hostname", "", "Override hostname (default: OS hostname)")
	interval := flag.Int("interval", defaultInterval, "Heartbeat interval in seconds")
	flag.Parse()

	// ── Hostname ──
	hostname, err := os.Hostname()
	if err != nil {
		log.Fatalf("Failed to get hostname: %v", err)
	}
	if *hostnameFlag != "" {
		hostname = *hostnameFlag
	}
	log.Printf("🖥️  Hostname: %s", hostname)

	// ── Agent ID (PERSISTENT) ──
	agentID := loadOrCreateAgentID(hostname)
	log.Printf("🆔 Agent ID: %s", agentID)

	// ── API Client ──
	c := client.New(*serverURL, *apiKey, agentID, hostname)

	// ── OS Info ──
	osInfo := collector.GetOSInfo()
	log.Printf("💻 OS: %s %s", osInfo.OS, osInfo.OSVersion)

	// ── Initial Registration ──
	hw := collector.CollectHardware()
	netInfo := collector.CollectNetworkInfo()

	regPayload := client.RegisterPayload{
		Hostname:          hostname,
		OS:                osInfo.OS,
		OSVersion:         osInfo.OSVersion,
		AgentVersion:      "1.0.0",
		MACAddresses:      hw.MACAddresses,
		IPAddresses:       netInfo.IPAddresses,
		CPUModel:          hw.CPUModel,
		CPUCores:          hw.CPUCores,
		RAMTotalBytes:     hw.RAMTotalBytes,
		StorageTotalBytes: hw.StorageTotalBytes,
		DiskModel:         hw.DiskModel,
		DiskType:          hw.DiskType,
		WifiSSID:          netInfo.WifiSSID,
		WifiSignalDBm:     netInfo.WifiSignalDBm,
		NetworkSpeedMbps:  netInfo.NetworkSpeedMbps,
	}

	if err := c.Register(regPayload); err != nil {
		log.Printf("⚠️  Registration warning: %v", err)
	} else {
		log.Println("✅ Agent registered successfully")
	}

	// ── Offline Buffer ──
	offlineBuffer := buffer.NewBuffer()

	// ── Command Executor ──
	cmdExecutor := commands.NewExecutor()

	// ── Graceful Shutdown ──
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// ── Heartbeat Loop ──
	ticker := time.NewTicker(time.Duration(*interval) * time.Second)
	defer ticker.Stop()

	log.Printf("🔄 Heartbeat loop started (interval: %ds)", *interval)

	for {
		select {
		case <-ticker.C:
			// Collect metrics
			metrics := collector.CollectMetrics()
			loc := collector.CollectLocation()
			netInfo := collector.CollectNetworkInfo()

			// Add network diag info to metrics
			diag := collector.RunNetworkDiag(netInfo.DefaultGateway)
			metrics.GatewayReachable = diag.GatewayReachable
			metrics.DNSWorking = diag.DNSWorking
			metrics.InternetReachable = diag.InternetReachable
			metrics.DefaultGateway = diag.DefaultGateway
			metrics.ErrorLogs = collector.GetErrorLogs() // Collect Windows event log errors
			metrics.ErrorCount = len(metrics.ErrorLogs)

			// Send heartbeat
			if err := c.SendHeartbeat(metrics, loc, netInfo); err != nil {
				log.Printf("❌ Heartbeat failed: %v", err)
				// Buffer for offline
				offlineBuffer.Store(metrics, loc, netInfo)
			} else {
				log.Printf("💓 Heartbeat sent | CPU:%.1f%% RAM:%.1f%% Disk:%.1f%%",
					metrics.CPUPercent, metrics.RAMPercent, metrics.StoragePercent)
				// Flush offline buffer
				offlineBuffer.Flush(func(m, l, n interface{}) error {
					return c.SendHeartbeat(m, l, n)
				})
			}

			// Check for pending commands
			pending, err := c.FetchPendingCommands()
			if err != nil {
				log.Printf("⚠️  Command check failed: %v", err)
			} else if len(pending) > 0 {
				for _, cmdRaw := range pending {
					cmdMap, ok := cmdRaw.(map[string]interface{})
					if !ok {
						continue
					}
					cmdID := int(cmdMap["id"].(float64))
					cmdStr := cmdMap["command"].(string)

					log.Printf("📥 Executing command #%d: %s", cmdID, cmdStr)

					// Mark as running
					c.SendCommandResponse(cmdID, client.CommandPayload{
						Action: "start",
					})

					// Execute
					output, execErr, exitCode := cmdExecutor.Execute(cmdStr)

					// Send result
					action := "complete"
					errStr := ""
					if execErr != nil {
						action = "fail"
						errStr = execErr.Error()
					}

					c.SendCommandResponse(cmdID, client.CommandPayload{
						Action:   action,
						Output:   output,
						Error:    errStr,
						ExitCode: exitCode,
					})

					log.Printf("✅ Command #%d completed (exit: %d)", cmdID, exitCode)
				}
			}

			// Check for agent updates (every 10 heartbeats / 10 minutes)
			if time.Now().Minute()%10 == 0 {
				go func() {
					version, downloadURL, err := c.CheckForUpdate(osInfo.OS)
					if err != nil {
						log.Printf("⚠️  Update check failed: %v", err)
						return
					}
					if version != "" && version != "1.0.0" {
						log.Printf("🆕 New version available: %s", version)
						log.Printf("📥 Download URL: %s", downloadURL)
						// TODO: Auto-update mechanism
					}
				}()
			}

		case <-sigChan:
			log.Println("🛑 Shutting down agent...")
			ticker.Stop()
			return
		}
	}
}

// loadOrCreateAgentID loads a persistent agent ID from file, or creates a new one.
func loadOrCreateAgentID(hostname string) string {
	// Try to load from file
	data, err := os.ReadFile(idFileName)
	if err == nil {
		var saved struct {
			AgentID  string `json:"agent_id"`
			Hostname string `json:"hostname"`
		}
		if json.Unmarshal(data, &saved) == nil && saved.AgentID != "" {
			log.Printf("📂 Loaded existing agent ID from %s", idFileName)
			return saved.AgentID
		}
	}

	// Create new agent ID (based on hostname + MAC for uniqueness)
	hw := collector.CollectHardware()
	agentID := collector.GenerateAgentID(hostname, hw.MACAddresses)

	// Save to file
	saved := struct {
		AgentID  string `json:"agent_id"`
		Hostname string `json:"hostname"`
	}{
		AgentID:  agentID,
		Hostname: hostname,
	}

	if data, err := json.MarshalIndent(saved, "", "  "); err == nil {
		if err := os.WriteFile(idFileName, data, 0644); err != nil {
			log.Printf("⚠️  Failed to save agent ID: %v", err)
		} else {
			log.Printf("💾 Agent ID saved to %s", idFileName)
		}
	}

	return agentID
}