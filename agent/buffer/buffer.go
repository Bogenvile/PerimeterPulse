package buffer

import (
	"encoding/json"
	"os"
	"perimeterpulse-agent/client"
	"sync"
)

type WriteBuffer struct {
	mu        sync.Mutex
	items     []client.HeartbeatPayload
	filePath  string
	serverURL string
}

func NewWriteBuffer(serverURL string) *WriteBuffer {
	filePath := "pulse-buffer.jsonl"
	b := &WriteBuffer{
		filePath:  filePath,
		serverURL: serverURL,
	}
	b.loadFromDisk()
	return b
}

func (b *WriteBuffer) loadFromDisk() {
	data, err := os.ReadFile(b.filePath)
	if err != nil {
		return
	}
	lines := splitLines(string(data))
	for _, line := range lines {
		if line == "" {
			continue
		}
		var payload client.HeartbeatPayload
		if err := json.Unmarshal([]byte(line), &payload); err == nil {
			b.items = append(b.items, payload)
		}
	}
}

func (b *WriteBuffer) Push(payload client.HeartbeatPayload) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.items = append(b.items, payload)
	_ = b.persist()
}

func (b *WriteBuffer) FlushTo(sendFn func(client.HeartbeatPayload) error) {
	b.mu.Lock()
	items := b.items
	b.items = nil
	b.mu.Unlock()

	_ = b.persist()

	var failed []client.HeartbeatPayload
	for _, item := range items {
		if err := sendFn(item); err != nil {
			failed = append(failed, item)
		}
	}

	if len(failed) > 0 {
		b.mu.Lock()
		b.items = append(failed, b.items...)
		b.mu.Unlock()
		_ = b.persist()
	}
}

func (b *WriteBuffer) Count() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.items)
}

func (b *WriteBuffer) persist() error {
	var lines string
	for _, item := range b.items {
		data, err := json.Marshal(item)
		if err != nil {
			continue
		}
		lines += string(data) + "\n"
	}
	return os.WriteFile(b.filePath, []byte(lines), 0644)
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}
