package buffer

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/perimeterpulse/agent/client"
)

// Buffer stores failed heartbeats to a local JSONL file and retries them.
type Buffer struct {
	client   *client.Client
	filePath string
	mu       sync.Mutex
	stopCh   chan struct{}
	agentID  string
}

// NewBuffer creates a new offline buffer.
func NewBuffer(c *client.Client) *Buffer {
	dir, err := os.Getwd()
	if err != nil {
		dir = "."
	}
	return &Buffer{
		client:   c,
		filePath: filepath.Join(dir, "pulse_buffer.jsonl"),
		stopCh:   make(chan struct{}),
	}
}

// Start begins the background retry loop.
func (b *Buffer) Start(agentID string) {
	b.agentID = agentID
	go b.retryLoop()
	log.Printf("Buffer started (%s)", b.filePath)
}

// Stop gracefully stops the buffer.
func (b *Buffer) Stop() {
	close(b.stopCh)
	log.Println("Buffer stopped")
}

// Save persists a failed payload to disk.
func (b *Buffer) Save(payload client.HeartbeatPayload) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	f, err := os.OpenFile(b.filePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = f.Write(append(data, '\n'))
	return err
}

func (b *Buffer) retryLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-b.stopCh:
			return
		case <-ticker.C:
			b.flush()
		}
	}
}

func (b *Buffer) flush() {
	b.mu.Lock()
	defer b.mu.Unlock()

	data, err := os.ReadFile(b.filePath)
	if err != nil || len(data) == 0 {
		return
	}

	// Parse lines and attempt to resend
	lines := bytesSplit(data, '\n')
	var remaining [][]byte

	for _, line := range lines {
		if len(line) == 0 {
			continue
		}
		var payload client.HeartbeatPayload
		if err := json.Unmarshal(line, &payload); err != nil {
			remaining = append(remaining, line)
			continue
		}
		payload.APIKey = b.client.APIKey // inject current key
		if err := b.client.SendHeartbeat(payload); err != nil {
			log.Printf("Buffer retry failed: %v", err)
			remaining = append(remaining, line)
		} else {
			log.Println("Buffer retry successful")
		}
	}

	// Write back remaining lines
	if len(remaining) == 0 {
		os.Remove(b.filePath)
	} else {
		f, err := os.Create(b.filePath)
		if err != nil {
			log.Printf("Buffer: cannot rewrite file: %v", err)
			return
		}
		defer f.Close()
		for _, line := range remaining {
			f.Write(append(line, '\n'))
		}
	}
}

func bytesSplit(data []byte, sep byte) [][]byte {
	var parts [][]byte
	start := 0
	for i, b := range data {
		if b == sep {
			parts = append(parts, data[start:i])
			start = i + 1
		}
	}
	if start < len(data) {
		parts = append(parts, data[start:])
	}
	return parts
}