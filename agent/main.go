package main

import (
	"flag"
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

const version = "1.0.0"

func main() {
	serverURL := flag.String("server", "http://localhost:3000", "PerimeterPulse server URL")
	apiKey := flag.String("apikey", "", "API key for agent authentication")
	hostnameFlag := flag.String("hostname", "", "Override auto-detected hostname")
	intervalSec := flag.Int("interval", 60, "Heartbeat interval in seconds")
	flag.Parse()

	if *apiKey == "" {
		log.Fatal("❌ --apikey is required")
	}

	// Determine hostname
	hostname := *hostnameFlag
	if hostname == "" {
		h, err := os.Hostname()
		if err == nil && h != "" {
			hostname = h
		} else {
			hostname = "unknown"
		}
	}

	// Get hardware info
	osInfo := collector.GetOSInfo()
	hw := collector.CollectHardware()

	// Generate agent ID
	agentID := collector.GenerateAgentID(hostname, hw.MACAddresses)

	log.Printf("🖥️  PerimeterPulse Agent v%s", version)
	log.Printf("   Hostname: %s", hostname)
	log.Printf("   OS: %s %s", osInfo.OS, osInfo.OSVersion)
	log.Printf("   Agent ID: %s", agentID)

	// Create API client
	apiClient := client.New(*serverURL, *apiKey, agentID, hostname)

	// Register with server
	log.Println("📡 Registering with server...")
	err := apiClient.Register(client.RegisterPayload{
		Hostname:          hostname,
		OS:                osInfo.OS,
		OSVersion:         osInfo.OSVersion,
		AgentVersion:      version,
		MACAddresses:      hw.MACAddresses,
		IPAddresses:       []string{},
		CPUModel:          hw.CPUModel,
		CPUCores:          hw.CPUCores,
		RAMTotalBytes:     hw.RAMTotalBytes,
		StorageTotalBytes: hw.StorageTotalBytes,
		DiskModel:         hw.DiskModel,
		DiskType:          hw.DiskType,
		WifiSSID:          "",
		WifiSignalDBm:     0,
		NetworkSpeedMbps:  0,
	})
	if err != nil {
		log.Printf("⚠️  Registration failed: %v (will retry on first heartbeat)", err)
	} else {
		log.Println("✅ Registered successfully")
	}

	// Initialize buffer and command executor
	offlineBuffer := buffer.NewBuffer()
	cmdExecutor := commands.NewExecutor()

	// Heartbeat function
	sendHeartbeat := func() {
		metrics := collector.CollectMetrics()
		networkInfo := collector.CollectNetworkInfo()
		location := collector.CollectLocation()

		// Add network diagnostics
		diag := collector.RunNetworkDiag(networkInfo.DefaultGateway)
		metrics.NetworkStatus = "up"
		if !diag.InternetReachable {
			metrics.NetworkStatus = "degraded"
		}
		metrics.GatewayReachable = diag.GatewayReachable
		metrics.DNSWorking = diag.DNSWorking
		metrics.InternetReachable = diag.InternetReachable
		metrics.DefaultGateway = diag.DefaultGateway

		// Collect error logs
		metrics.ErrorLogs = collector.GetErrorLogs()
		metrics.ErrorCount = len(metrics.ErrorLogs)

		err := apiClient.SendHeartbeat(metrics, location, networkInfo)
		if err != nil {
			log.Printf("⚠️  Heartbeat failed: %v", err)
			offlineBuffer.Store(metrics, location, networkInfo)
		} else {
			log.Println("💓 Heartbeat sent")
			// Flush buffered heartbeats
			offlineBuffer.Flush(func(m, l, n interface{}) error {
				return apiClient.SendHeartbeat(m, l, n)
			})
		}
	}

	// Check for remote commands
	checkCommands := func() {
		cmds, err := apiClient.FetchPendingCommands()
		if err != nil {
			return // silently ignore
		}
		for _, cmdRaw := range cmds {
			cmd, ok := cmdRaw.(map[string]interface{})
			if !ok {
				continue
			}
			cmdID, ok := cmd["id"].(float64)
			if !ok {
				continue
			}
			commandStr, ok := cmd["command"].(string)
			if !ok {
				continue
			}

			// Mark as running
			apiClient.SendCommandResponse(int(cmdID), client.CommandPayload{Action: "start"})

			// Execute
			output, err, exitCode := cmdExecutor.Execute(commandStr)
			action := "complete"
			var errStr string
			if err != nil {
				action = "fail"
				errStr = err.Error()
			}

			apiClient.SendCommandResponse(int(cmdID), client.CommandPayload{
				Action:   action,
				Output:   output,
				Error:    errStr,
				ExitCode: exitCode,
			})
		}
	}

	// Send initial heartbeat
	sendHeartbeat()

	// Listen for OS signals for graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(time.Duration(*intervalSec) * time.Second)
	defer ticker.Stop()

	log.Println("✅ Agent running. Press Ctrl+C to stop.")

	for {
		select {
		case <-ticker.C:
			checkCommands()
			sendHeartbeat()
		case sig := <-sigCh:
			log.Printf("🛑 Received %v, shutting down.", sig)
			return
		}
	}
}