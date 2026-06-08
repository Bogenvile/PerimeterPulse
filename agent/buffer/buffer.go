package buffer

import (
	"encoding/json"
	"log"
	"os"
	"sync"
)

// Buffer provides offline buffering. When the agent cannot reach the server,
// payloads are appended to a local JSON file. When connectivity is restored,
// buffered payloads are flushed and sent to the server.
type Buffer struct {
	filePath string
	mu       sync.Mutex
}

// New creates a new Buffer backed by the given file path.
func New(filePath string) *Buffer {
	return &Buffer{filePath: filePath}
}

// Append serializes a payload and appends it to the buffer file.
// The buffer format is one JSON object per line (JSONL).
func (b *Buffer) Append(payload interface{}) {
	b.mu.Lock()
	defer b.mu.Unlock()

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Buffer: marshal error: %v", err)
		return
	}

	f, err := os.OpenFile(b.filePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		log.Printf("Buffer: open error: %v", err)
		return
	}
	defer f.Close()

	if _, err := f.Write(append(data, '\n')); err != nil {
		log.Printf("Buffer: write error: %v", err)
	}
}

// AppendRaw appends raw JSON bytes to the buffer (used for re-buffering).
func (b *Buffer) AppendRaw(data []byte) {
	b.mu.Lock()
	defer b.mu.Unlock()

	f, err := os.OpenFile(b.filePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		log.Printf("Buffer: open error: %v", err)
		return
	}
	defer f.Close()

	if _, err := f.Write(append(data, '\n')); err != nil {
		log.Printf("Buffer: write error: %v", err)
	}
}

// Flush reads all buffered payloads, clears the file, and returns the items.
// Each item is a raw JSON byte slice.
func (b *Buffer) Flush() [][]byte {
	b.mu.Lock()
	defer b.mu.Unlock()

	data, err := os.ReadFile(b.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		log.Printf("Buffer: read error: %v", err)
		return nil
	}

	// Clear the file
	if err := os.Truncate(b.filePath, 0); err != nil {
		log.Printf("Buffer: truncate error: %v", err)
	}

	if len(data) == 0 {
		return nil
	}

	// Split by newlines, skip empty lines
	lines := splitLines(data)
	var items [][]byte
	for _, line := range lines {
		if len(line) > 0 {
			items = append(items, line)
		}
	}
	return items
}

// SaveAgentID persists the agent_id to a simple file so the agent can reuse it
// after restarts even if registration hasn't completed.
func (b *Buffer) SaveAgentID(agentID string) {
	_ = os.WriteFile(b.filePath+".agentid", []byte(agentID), 0600)
}

// LoadAgentID reads a previously saved agent_id.
func (b *Buffer) LoadAgentID() string {
	data, err := os.ReadFile(b.filePath + ".agentid")
	if err != nil {
		return ""
	}
	return string(data)
}

func splitLines(data []byte) [][]byte {
	var lines [][]byte
	start := 0
	for i, b := range data {
		if b == '\n' {
			lines = append(lines, data[start:i])
			start = i + 1
		}
	}
	if start < len(data) {
		lines = append(lines, data[start:])
	}
	return lines
}
