package commands

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"time"
)

// PendingCommand represents a command from the server queue.
type PendingCommand struct {
	ID        int    `json:"id"`
	Command   string `json:"command"`
	CreatedAt string `json:"created_at"`
}

// CommandResult is sent back to the server after execution.
type CommandResult struct {
	AgentID  string `json:"agent_id"`
	APIKey   string `json:"api_key"`
	Action   string `json:"action"` // "start", "complete", "fail", "timeout"
	Output   string `json:"output,omitempty"`
	Error    string `json:"error,omitempty"`
	ExitCode *int   `json:"exit_code,omitempty"`
}

// commandsResponse wraps the server response.
type commandsResponse struct {
	Commands []PendingCommand `json:"commands"`
}

// PollAndExecute checks for pending commands, executes them, and reports results.
// Call this from your main heartbeat loop after sending metrics.
//
// Integration example in main.go:
//
//	// After heartbeat success:
//	go commands.PollAndExecute(httpClient, serverURL, agentID, apiKey)
func PollAndExecute(client *http.Client, serverURL, agentID, apiKey string) {
	cmds, err := FetchPending(client, serverURL, agentID, apiKey)
	if err != nil {
		fmt.Printf("[commands] Failed to fetch pending commands: %v\n", err)
		return
	}

	if len(cmds) == 0 {
		return
	}

	fmt.Printf("[commands] Found %d pending command(s)\n", len(cmds))

	for _, cmd := range cmds {
		executeAndReport(client, serverURL, agentID, apiKey, cmd)
	}
}

// FetchPending retrieves pending commands from the server.
func FetchPending(client *http.Client, serverURL, agentID, apiKey string) ([]PendingCommand, error) {
	u, err := url.Parse(serverURL)
	if err != nil {
		return nil, err
	}
	u.Path = "/api/agent/commands"
	q := u.Query()
	q.Set("agent_id", agentID)
	q.Set("api_key", apiKey)
	u.RawQuery = q.Encode()

	resp, err := client.Get(u.String())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("server returned %d", resp.StatusCode)
	}

	var result commandsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Commands, nil
}

// executeAndReport runs a single command and sends the result back.
func executeAndReport(client *http.Client, serverURL, agentID, apiKey string, cmd PendingCommand) {
	fmt.Printf("[commands] Executing: %s\n", cmd.Command)

	// Mark as running
	_ = report(client, serverURL, CommandResult{
		AgentID: agentID,
		APIKey:  apiKey,
		Action:  "start",
	}, cmd.ID)

	// Determine shell
	shell, shellFlag := getShell()

	// Execute with timeout
	timeout := 120 * time.Second
	ctx, cancel := contextWithTimeout(timeout)
	defer cancel()

	execCmd := exec.CommandContext(ctx, shell, shellFlag, cmd.Command)
	output, err := execCmd.CombinedOutput()

	if ctx.Err() == contextDeadline() {
		fmt.Printf("[commands] Command timed out: %s\n", cmd.Command)
		_ = report(client, serverURL, CommandResult{
			AgentID: agentID,
			APIKey:  apiKey,
			Action:  "timeout",
		}, cmd.ID)
		return
	}

	if err != nil {
		exitCode := -1
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		}
		fmt.Printf("[commands] Command failed (exit %d): %s\n", exitCode, cmd.Command)
		_ = report(client, serverURL, CommandResult{
			AgentID:  agentID,
			APIKey:   apiKey,
			Action:   "fail",
			Output:   string(output),
			Error:    err.Error(),
			ExitCode: &exitCode,
		}, cmd.ID)
		return
	}

	fmt.Printf("[commands] Command completed (exit 0): %s\n", cmd.Command)
	exitCode := 0
	_ = report(client, serverURL, CommandResult{
		AgentID:  agentID,
		APIKey:   apiKey,
		Action:   "complete",
		Output:   string(output),
		ExitCode: &exitCode,
	}, cmd.ID)
}

// report sends a status update to the server.
func report(client *http.Client, serverURL string, result CommandResult, commandID int) error {
	u := fmt.Sprintf("%s/api/agent/commands/%d", serverURL, commandID)

	body, err := json.Marshal(result)
	if err != nil {
		return err
	}

	resp, err := client.Post(u, "application/json", bytesReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// getShell returns the appropriate shell and flag for the current OS.
func getShell() (string, string) {
	switch runtime.GOOS {
	case "windows":
		return "cmd", "/C"
	default:
		// Try bash first, fall back to sh
		if _, err := exec.LookPath("bash"); err == nil {
			return "bash", "-c"
		}
		return "sh", "-c"
	}
}

// Minimal interfaces to avoid importing "context" and "bytes" if not needed.
// These are inline implementations to keep the package dependency-free.

type deadlineContext struct {
	timer    *time.Timer
	deadline time.Time
	done     chan struct{}
}

func (c *deadlineContext) Deadline() (time.Time, bool) { return c.deadline, true }
func (c *deadlineContext) Done() <-chan struct{}       { return c.done }
func (c *deadlineContext) Err() error {
	select {
	case <-c.done:
		return contextDeadline()
	default:
		return nil
	}
}
func (c *deadlineContext) Value(key interface{}) interface{} { return nil }

func contextWithTimeout(d time.Duration) (*deadlineContext, func()) {
	ctx := &deadlineContext{
		deadline: time.Now().Add(d),
		done:     make(chan struct{}),
	}
	timer := time.AfterFunc(d, func() { close(ctx.done) })
	return ctx, func() {
		timer.Stop()
		select {
		case <-ctx.done:
		default:
			close(ctx.done)
		}
	}
}

func contextDeadline() error { return fmt.Errorf("context deadline exceeded") }

func bytesReader(b []byte) *bytesWrapper { return &bytesWrapper{b: b} }

type bytesWrapper struct {
	b   []byte
	pos int
}

func (r *bytesWrapper) Read(p []byte) (int, error) {
	if r.pos >= len(r.b) {
		return 0, fmt.Errorf("EOF")
	}
	n := copy(p, r.b[r.pos:])
	r.pos += n
	return n, nil
}