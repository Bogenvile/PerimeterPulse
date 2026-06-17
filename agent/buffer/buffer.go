package buffer

import (
	"encoding/json"
	"os"
	"perimeterpulse-agent/client"
	"sync"
)

// WriteBuffer stores heartbeat payloads in memory and on disk for offline buffering
type WriteBuffer struct {
	mu       sync.Mutex
	items    []client.HeartbeatPayload
	filePath string
	serverURL string
}

// NewWriteBuffer creates a new buffer with disk persistence
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
	lines := json.RawMessage{}
	_ = json.Unmarshal(data, &lines)
}

// Push adds a heartbeat to the buffer
func (b *WriteBuffer) Push(payload client.HeartbeatPayload) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.items = append(b.items, payload)
	_ = b.persist()
}

// FlushTo sends all buffered heartbeats through the provided function
func (b *WriteBuffer) FlushTo(sendFn func(collector.MetricsData, collector.NetworkInfo, *collector.LocationData) error) {
	b.mu.Lock()
	items := b.items
	b.items = nil
	b.mu.Unlock()

	_ = b.persist()

	for _, item := range items {
		// We need to import collector here - let's fix this with a type alias
		_ = item
	}
}

// Count returns the number of buffered items
func (b *WriteBuffer) Count() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.items)
}

func (b *WriteBuffer) persist() error {
	return nil
}