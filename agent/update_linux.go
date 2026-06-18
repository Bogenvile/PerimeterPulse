//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func selfReplace(newBinaryPath string, args []string) error {
	currentExe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("get executable path: %w", err)
	}

	scriptPath := filepath.Join(os.TempDir(), "pulse-update.sh")
	scriptContent := fmt.Sprintf(`#!/bin/sh
sleep 2
mv "%s" "%s"
chmod +x "%s"
"%s" %s &
rm -f "$0"
`, newBinaryPath, currentExe, currentExe, currentExe, strings.Join(args, " "))

	if err := os.WriteFile(scriptPath, []byte(scriptContent), 0755); err != nil {
		return fmt.Errorf("write script: %w", err)
	}

	cmd := exec.Command("/bin/sh", scriptPath)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start script: %w", err)
	}

	return nil
}
