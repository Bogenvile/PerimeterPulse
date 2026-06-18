//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

func selfReplace(newBinaryPath string, args []string) error {
	currentExe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("get executable path: %w", err)
	}

	batPath := filepath.Join(os.TempDir(), "pulse-update.bat")
	batContent := fmt.Sprintf("@echo off\r\ntimeout /t 2 /nobreak >nul\r\nmove /Y \"%s\" \"%s\"\r\nstart \"\" \"%s\" %s\r\ndel \"%%~f0\"\r\n",
		newBinaryPath, currentExe, currentExe, strings.Join(args, " "))

	if err := os.WriteFile(batPath, []byte(batContent), 0644); err != nil {
		return fmt.Errorf("write batch: %w", err)
	}

	cmd := exec.Command("cmd.exe", "/C", batPath)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start batch: %w", err)
	}

	return nil
}
