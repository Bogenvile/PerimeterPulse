package buffer

import (
	"encoding/json"
	"os"
	"sync"
)

// Buffer stores failed heartbeats to disk for offline replay
type Buffer struct {
	filePath string
	mu       sync.Mutex
}

func NewBuffer(agentID, apiKey, filePath string) *Buffer {
	// Store credentials in the buffer for replay
	// (We simply write failed payloads as JSON lines)
	return &Buffer{
		filePath: filePath,
	}
}

// Append writes a failed heartbeat payload to the buffer file
func (b *Buffer) Append(payload interface{}) {
	b.mu.Lock()
	defer b.mu.Unlock()

	f, err := os.OpenFile(b.filePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()

	data, err := json.Marshal(payload)
	if err != nil {
		return
	}

	f.Write(data)
	f.Write([]byte("\n"))
}

// Flush reads all buffered payloads and returns them
func (b *Buffer) Flush() [][]byte {
	b.mu.Lock()
	defer b.mu.Unlock()

	data, err := os.ReadFile(b.filePath)
	if err != nil {
		return nil
	}

	// Clear the file after reading
	os.Truncate(b.filePath, 0)

	var payloads [][]byte
	lines := splitLines(string(data))
	for _, line := range lines {
		if line != "" {
			payloads = append(payloads, []byte(line))
		}
	}
	return payloads
}

// HasPending returns true if there are buffered payloads
func (b *Buffer) HasPending() bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	info, err := os.Stat(b.filePath)
	if err != nil {
		return false
	}
	return info.Size() > 0
}

// Clear removes the buffer file
func (b *Buffer) Clear() {
	b.mu.Lock()
	defer b.mu.Unlock()
	os.Remove(b.filePath)
}

func splitLines(s string) []string {
	var lines []string
	current := ""
	for _, ch := range s {
		if ch == '\n' {
			lines = append(lines, current)
			current = ""
		} else {
			current += string(ch)
		}
	}
	if current != "" {
		lines = append(lines, current)
	}
	return lines
}