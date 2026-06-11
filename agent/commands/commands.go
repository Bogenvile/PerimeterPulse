package commands

import (
	"bytes"
	"context"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// CommandResult berisi hasil dari eksekusi perintah.
type CommandResult struct {
	CommandID int
	Output    string
	Error     string
	ExitCode  int
	ExecTime  time.Duration
}

// Execute menjalankan perintah yang diberikan dan mengembalikan hasilnya.
// Timeout default adalah 5 menit.
func Execute(commandID int, cmdStr string) CommandResult {
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	result := CommandResult{CommandID: commandID, ExitCode: -1}

	var shell string
	var args []string

	if runtime.GOOS == "windows" {
		shell = "cmd"
		args = []string{"/C", cmdStr}
	} else {
		shell = "sh"
		args = []string{"-c", cmdStr}
	}

	cmd := exec.CommandContext(ctx, shell, args...)
	cmd.Env = cleanEnv()

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	result.ExecTime = time.Since(start)
	result.Output = strings.TrimSpace(stdout.String())
	result.Error = strings.TrimSpace(stderr.String())

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			result.ExitCode = exitErr.ExitCode()
		} else if ctx.Err() == context.DeadlineExceeded {
			result.Error = "Command timed out (5m limit)"
			result.ExitCode = -124
		} else {
			result.Error = err.Error()
		}
	} else {
		result.ExitCode = 0
	}

	return result
}

// cleanEnv membersihkan environment variabel dari PATH yang berbahaya.
func cleanEnv() []string {
	env := os.Environ()
	for i, e := range env {
		if strings.HasPrefix(e, "PATH=") || strings.HasPrefix(e, "Path=") {
			env = append(env[:i], env[i+1:]...)
			break
		}
	}
	return env
}