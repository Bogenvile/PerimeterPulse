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
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"perimeterpulse/agent/client"
	"perimeterpulse/agent/collector"
)

var (
	serverURL = flag.String("server", "", "PerimeterPulse server URL")
	apiKey    = flag.String("apikey", "", "API key for authentication")
	hostname  = flag.String("hostname", "", "Override hostname")
	interval  = flag.Int("interval", 3, "Heartbeat interval in seconds")
)

// Command from server
type PendingCommand struct {
	ID        int    `json:"id"`
	Command   string `json:"command"`
	CreatedAt string `json:"created_at"`
}

type CommandsResponse struct {
	Commands []PendingCommand `json:"commands"`
}

func main() {
	flag.Parse()
	if *serverURL == "" || *apiKey == "" {
		log.Fatal("--server and --apikey are required")
	}
	*serverURL = strings.TrimRight(*serverURL, "/")

	agentID := loadAgentID()
	info := collector.CollectInfo(*apiKey, *hostname)

	resp, err := client.RegisterAgent(*serverURL, info, agentID)
	if err != nil {
		log.Fatalf("registration failed: %v", err)
	}
	if resp.AgentID != "" {
		agentID = resp.AgentID
		saveAgentID(agentID)
	}
	fmt.Printf("Registered as agent %s (hostname: %s)\n", agentID, info.Hostname)

	// First heartbeat & command fetch
	sendHeartbeat(agentID)
	processCommands(agentID)

	ticker := time.NewTicker(time.Duration(*interval) * time.Second)
	defer ticker.Stop()
	fmt.Printf("Sending heartbeat every %ds...\n", *interval)

	for range ticker.C {
		sendHeartbeat(agentID)
		processCommands(agentID)
	}
}

func sendHeartbeat(agentID string) {
	metrics := collector.CollectMetrics()
	location := collector.CollectLocation()
	network := collector.CollectNetwork()

	hb := client.HeartbeatPayload{
		AgentID:     agentID,
		APIKey:      *apiKey,
		Metrics:     metrics,
		Location:    location,
		NetworkInfo: network,
	}

	if err := client.SendHeartbeat(*serverURL, hb); err != nil {
		log.Printf("heartbeat error: %v", err)
	} else {
		log.Printf("heartbeat sent (CPU: %.1f%%, RAM: %.1f%%, Disk: %.1f%%)",
			metrics.CPUPercent, metrics.RAMPercent, metrics.StoragePercent)
	}
}

// -------- remote command execution --------

func processCommands(agentID string) {
	cmds, err := fetchCommands(agentID)
	if err != nil {
		log.Printf("fetch commands error: %v", err)
		return
	}
	if len(cmds) == 0 {
		return
	}
	log.Printf("got %d pending command(s)", len(cmds))

	for _, cmd := range cmds {
		// Mark as running
		markCommand(cmd.ID, agentID, "start", "", "", 0)

		// Execute
		start := time.Now()
		output, execErr := runShellCommand(cmd.Command)
		elapsed := time.Since(start)

		log.Printf("command #%d finished in %v", cmd.ID, elapsed)

		if execErr != nil {
			markCommand(cmd.ID, agentID, "fail", "", execErr.Error(), 1)
		} else {
			markCommand(cmd.ID, agentID, "complete", output, "", 0)
		}
	}
}

func fetchCommands(agentID string) ([]PendingCommand, error) {
	url := fmt.Sprintf("%s/api/agent/commands?agent_id=%s&api_key=%s",
		*serverURL, agentID, *apiKey)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("fetch commands failed %d: %s", resp.StatusCode, string(body))
	}
	var cr CommandsResponse
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil {
		return nil, err
	}
	return cr.Commands, nil
}

func markCommand(cmdID int, agentID, action, output, errStr string, exitCode int) {
	body := map[string]interface{}{
		"agent_id":  agentID,
		"api_key":   *apiKey,
		"action":    action,
		"output":    output,
		"error":     errStr,
		"exit_code": exitCode,
	}
	jsonBody, _ := json.Marshal(body)
	url := fmt.Sprintf("%s/api/agent/commands/%d", *serverURL, cmdID)
	http.Post(url, "application/json", bytes.NewReader(jsonBody))
}

func runShellCommand(cmdStr string) (string, error) {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("cmd", "/C", cmdStr)
	} else {
		cmd = exec.Command("sh", "-c", cmdStr)
	}
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// -------- agent ID persistence --------

func idFilePath() string {
	exe, err := os.Executable()
	if err != nil {
		return "pulse-agent.id"
	}
	return filepath.Join(filepath.Dir(exe), "pulse-agent.id")
}

func loadAgentID() string {
	data, err := os.ReadFile(idFilePath())
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

func saveAgentID(id string) error {
	return os.WriteFile(idFilePath(), []byte(id), 0644)
}