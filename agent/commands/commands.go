package commands

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// Command represents a remote command from the server
type Command struct {
	ID        int    `json:"id"`
	Command   string `json:"command"`
	CreatedAt string `json:"created_at"`
}

// FetchPendingCommands retrieves pending commands from the server
func FetchPendingCommands(serverURL, agentID, apiKey string) ([]Command, error) {
	url := fmt.Sprintf("%s/api/agent/commands?agent_id=%s&api_key=%s", serverURL, agentID, apiKey)
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch commands: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("fetch commands returned %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Commands []Command `json:"commands"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode commands response: %w", err)
	}

	return result.Commands, nil
}

// UpdateCommandStatus sends command execution result back to server
func UpdateCommandStatus(serverURL, agentID, apiKey string, commandID int, action, output, errStr string, exitCode int) error {
	payload := map[string]interface{}{
		"agent_id":  agentID,
		"api_key":   apiKey,
		"action":    action,
		"output":    output,
		"error":     errStr,
		"exit_code": exitCode,
	}

	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("%s/api/agent/commands/%d", serverURL, commandID)

	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update command status: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("update command status returned %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// Execute runs a shell command and returns output, error, exit code
func Execute(command string) (string, string, int) {
	var cmd *exec.Cmd

	if runtime.GOOS == "windows" {
		cmd = exec.Command("cmd", "/C", command)
	} else {
		cmd = exec.Command("sh", "-c", command)
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	exitCode := 0
	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			exitCode = exitError.ExitCode()
		} else {
			exitCode = -1
		}
	}

	output := strings.TrimSpace(stdout.String())
	errOutput := strings.TrimSpace(stderr.String())

	return output, errOutput, exitCode
}

// ProcessCommands fetches all pending commands, executes them, and reports results
func ProcessCommands(serverURL, agentID, apiKey string) int {
	cmds, err := FetchPendingCommands(serverURL, agentID, apiKey)
	if err != nil {
		fmt.Printf("[commands] Failed to fetch: %v\n", err)
		return 0
	}

	if len(cmds) == 0 {
		return 0
	}

	fmt.Printf("[commands] Found %d pending command(s)\n", len(cmds))
	executed := 0

	for _, cmd := range cmds {
		// Mark as running
		if err := UpdateCommandStatus(serverURL, agentID, apiKey, cmd.ID, "start", "", "", 0); err != nil {
			fmt.Printf("[commands] Failed to mark #%d as running: %v\n", cmd.ID, err)
			continue
		}

		fmt.Printf("[commands] Executing #%d: %s\n", cmd.ID, cmd.Command)
		start := time.Now()

		output, errStr, exitCode := Execute(cmd.Command)

		elapsed := time.Since(start)
		fmt.Printf("[commands] #%d finished in %v (exit=%d)\n", cmd.ID, elapsed.Round(time.Millisecond), exitCode)

		// Report result
		action := "complete"
		if exitCode != 0 {
			action = "fail"
		}

		if err := UpdateCommandStatus(serverURL, agentID, apiKey, cmd.ID, action, output, errStr, exitCode); err != nil {
			fmt.Printf("[commands] Failed to report #%d: %v\n", cmd.ID, err)
		} else {
			fmt.Printf("[commands] #%d reported successfully\n", cmd.ID)
		}
		executed++
	}

	return executed
}