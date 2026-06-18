package commands

import (
	"bytes"
	"os/exec"
	"strings"
	"time"
)

type ExecResult struct {
	Output   string `json:"output"`
	Error    string `json:"error"`
	ExitCode int    `json:"exit_code"`
}

func Execute(cmd string) ExecResult {
	timeout := 120 * time.Second

	// Parse command (simple split)
	parts := strings.Fields(cmd)
	if len(parts) == 0 {
		return ExecResult{Error: "empty command", ExitCode: 1}
	}

	name := parts[0]
	args := parts[1:]

	c := exec.Command(name, args...)
	c.WaitDelay = timeout

	var stdout, stderr bytes.Buffer
	c.Stdout = &stdout
	c.Stderr = &stderr

	err := c.Start()
	if err != nil {
		return ExecResult{Error: err.Error(), ExitCode: 1}
	}

	// Use a timer for timeout
	done := make(chan error, 1)
	go func() {
		done <- c.Wait()
	}()

	select {
	case <-time.After(timeout):
		c.Process.Kill()
		return ExecResult{
			Output:   stdout.String(),
			Error:    "command timed out after " + timeout.String(),
			ExitCode: 124,
		}
	case err := <-done:
		exitCode := 0
		if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				exitCode = exitErr.ExitCode()
			} else {
				exitCode = 1
			}
		}

		return ExecResult{
			Output:   stdout.String(),
			Error:    stderr.String(),
			ExitCode: exitCode,
		}
	}
}