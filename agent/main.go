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

const agentVersion = "1.0.0"

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

// Update check response
type UpdateResponse struct {
	Version     string `json:"version"`
	DownloadURL string `json:"download_url"`
}

func main() {
	flag.Parse()
	if *serverURL == "" || *apiKey == "" {
		log.Fatal("--server and --apikey are required")
	}
	*serverURL = strings.TrimRight(*serverURL, "/")

	agentID := loadAgentID()
	info := collector.CollectInfo(*apiKey, *hostname)
	info.AgentVersion = agentVersion

	resp, err := client.RegisterAgent(*serverURL, info, agentID)
	if err != nil {
		log.Fatalf("registration failed: %v", err)
	}
	if resp.AgentID != "" {
		agentID = resp.AgentID
		saveAgentID(agentID)
	}
	fmt.Printf("Registered as agent %s (hostname: %s, v%s)\n", agentID, info.Hostname, agentVersion)

	// Check for updates on startup
	go checkAndUpdate(agentID)

	sendHeartbeat(agentID)
	processCommands(agentID)

	ticker := time.NewTicker(time.Duration(*interval) * time.Second)
	defer ticker.Stop()
	fmt.Printf("Sending heartbeat every %ds...\n", *interval)

	updateCheckCount := 0
	for range ticker.C {
		sendHeartbeat(agentID)
		processCommands(agentID)

		// Check for updates every 60 heartbeats (~3 minutes at 3s interval)
		updateCheckCount++
		if updateCheckCount >= 60 {
			updateCheckCount = 0
			go checkAndUpdate(agentID)
		}
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

// -------- auto-update --------

func checkAndUpdate(agentID string) {
	osName := "linux"
	if runtime.GOOS == "windows" {
		osName = "windows"
	}

	url := fmt.Sprintf("%s/api/agent/update?agent_id=%s&api_key=%s&os=%s",
		*serverURL, agentID, *apiKey, osName)

	resp, err := http.Get(url)
	if err != nil {
		log.Printf("update check error: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return
	}

	var update UpdateResponse
	if err := json.NewDecoder(resp.Body).Decode(&update); err != nil {
		log.Printf("update parse error: %v", err)
		return
	}

	if update.Version == "" || update.DownloadURL == "" {
		return // No updates available
	}

	// Compare versions
	if !isNewerVersion(update.Version, agentVersion) {
		return
	}

	log.Printf("NEW VERSION AVAILABLE: v%s → v%s", agentVersion, update.Version)
	log.Printf("Downloading from: %s", update.DownloadURL)

	if err := downloadAndApply(update.DownloadURL); err != nil {
		log.Printf("update failed: %v", err)
	}
}

func isNewerVersion(newVer, currentVer string) bool {
	newParts := parseVersion(newVer)
	curParts := parseVersion(currentVer)

	for i := 0; i < 3; i++ {
		if newParts[i] > curParts[i] {
			return true
		}
		if newParts[i] < curParts[i] {
			return false
		}
	}
	return false
}

func parseVersion(v string) [3]int {
	parts := [3]int{0, 0, 0}
	fmt.Sscanf(v, "%d.%d.%d", &parts[0], &parts[1], &parts[2])
	return parts
}

func downloadAndApply(downloadURL string) error {
	// Get current executable path
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("get exe path: %v", err)
	}

	// Determine new file extension
	ext := ""
	if runtime.GOOS == "windows" {
		ext = ".exe"
	}

	// Download to temp file
	tmpFile := exePath + ".new" + ext
	resp, err := http.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("download: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download returned %d", resp.StatusCode)
	}

	out, err := os.Create(tmpFile)
	if err != nil {
		return fmt.Errorf("create temp file: %v", err)
	}
	defer out.Close()

	written, err := io.Copy(out, resp.Body)
	if err != nil {
		os.Remove(tmpFile)
		return fmt.Errorf("write file: %v", err)
	}
	log.Printf("Downloaded %d bytes to %s", written, tmpFile)

	if runtime.GOOS == "windows" {
		// On Windows, create a batch script that:
		// 1. Waits for the agent to exit
		// 2. Replaces the old exe with the new one
		// 3. Restarts the agent
		batPath := exePath + ".update.bat"
		batContent := fmt.Sprintf(
			`@echo off
timeout /t 2 /nobreak > nul
move /Y "%s" "%s"
if %%ERRORLEVEL%% EQU 0 (
    echo Update complete, restarting...
    start "" "%s" --server %s --apikey %s --hostname %s --interval %d
) else (
    echo Update failed - could not replace file
    pause
)
del "%%~f0"
`,
			tmpFile, exePath, exePath, *serverURL, *apiKey, *hostname, *interval,
		)
		if err := os.WriteFile(batPath, []byte(batContent), 0644); err != nil {
			return fmt.Errorf("create batch: %v", err)
		}

		log.Printf("Starting update: %s", batPath)
		cmd := exec.Command("cmd", "/C", batPath)
		cmd.Start()

		// Exit so the batch can replace us
		os.Exit(0)
	} else {
		// Linux: rename over the running binary and restart
		os.Chmod(tmpFile, 0755)
		if err := os.Rename(tmpFile, exePath); err != nil {
			return fmt.Errorf("replace binary: %v", err)
		}
		log.Printf("Binary replaced, restarting...")
		cmd := exec.Command(exePath, os.Args[1:]...)
		cmd.Start()
		os.Exit(0)
	}

	return nil
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
		markCommand(cmd.ID, agentID, "start", "", "", 0)

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