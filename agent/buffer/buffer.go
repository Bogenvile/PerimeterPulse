package buffer

import (
	"bufio"
	"encoding/json"
	"os"
	"sync"
)

type Buffer struct {
	path  string
	mu    sync.Mutex
	file  *os.File
}

func NewBuffer(path string) *Buffer {
	b := &Buffer{path: path}
	return b
}

// HasPending returns true if there are buffered items
func (b *Buffer) HasPending() bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	info, err := os.Stat(b.path)
	if err != nil || info.Size() == 0 {
		return false
	}
	return true
}

// Append adds a heartbeat payload to the buffer file
func (b *Buffer) Append(payload interface{}) {
	b.mu.Lock()
	defer b.mu.Unlock()

	f, err := os.OpenFile(b.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
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

// Flush reads all buffered payloads and clears the file
func (b *Buffer) Flush() [][]byte {
	b.mu.Lock()
	defer b.mu.Unlock()

	var payloads [][]byte

	f, err := os.Open(b.path)
	if err != nil {
		return payloads
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) > 0 {
			payload := make([]byte, len(line))
			copy(payload, line)
			payloads = append(payloads, payload)
		}
	}

	// Clear file after reading
	os.Truncate(b.path, 0)

	return payloads
}