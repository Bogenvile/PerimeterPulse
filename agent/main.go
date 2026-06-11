package main

import (
	"flag"
	"log"
	"time"

	"perimeterpulse/agent/client"
	"perimeterpulse/agent/collector"
)

func main() {
	server := flag.String("server", "http://localhost:8080", "Server URL")
	apiKey := flag.String("apikey", "", "API Key")
	hostname := flag.String("hostname", "", "Hostname override")
	interval := flag.Int("interval", 60, "Heartbeat interval in seconds")
	flag.Parse()

	if *apiKey == "" {
		log.Fatal("API Key is required (--apikey)")
	}

	log.Printf("Starting PerimeterPulse Agent v1.2.0")
	log.Printf("Connecting to: %s", *server)

	// Inisialisasi client
	c := client.NewClient(*server, *apiKey)

	// Ambil info hardware dari sistem
	hw := collector.GetHardwareInfo()

	// Jika user memberi override hostname, kita coba pakai (tergantung implementasi collector)
	// Biasanya collector menggunakan os.Hostname(), flag ini berguna untuk logging atau identitas kustom
	if *hostname != "" {
		log.Printf("Using hostname override: %s", *hostname)
	}

	// 1. Register ke Server untuk mendapatkan AgentID otomatis
	if err := c.Register(hw); err != nil {
		log.Fatalf("Registration failed: %v", err)
	}
	log.Printf("Registration successful! Agent ID: %s", c.AgentID)

	// 2. Heartbeat Loop
	for {
		metrics := collector.GetMetrics()
		wifiSSID, wifiSignal, _ := collector.GetWifiInfo()
		location := collector.GetLocation()

		payload := client.HeartbeatPayload{
			Metrics:  metrics,
			Location: location,
			NetworkInfo: client.NetworkInfo{
				WiFiSSID:      wifiSSID,
				WiFiSignalDBM: wifiSignal,
				IPAddresses:   []string{},
			},
		}

		if err := c.SendHeartbeat(payload); err != nil {
			log.Printf("Heartbeat error: %v", err)
		}

		time.Sleep(time.Duration(*interval) * time.Second)
	}
}