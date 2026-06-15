package buffer

import (
	"encoding/json"
	"log"
	"os"
	"sync"
)

const bufferFile = "pulse-buffer.jsonl"

type HeartbeatEntry struct {
	Metrics  interface{} `json:"metrics"`
	Location interface{} `json:"location"`
	Network  interface{} `json:"network_info"`
}

type Buffer struct {
	mu    sync.Mutex
	file  *os.File
	items []HeartbeatEntry
}

func NewBuffer() *Buffer {
	f, err := os.OpenFile(bufferFile, os.O_APPEND|os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		log.Printf("⚠️  Buffer: cannot open file: %v", err)
	}
	b := &Buffer{file: f}

	// Load existing entries
	if f != nil {
		// We'll just flush them on next send; no need to preload
	}
	return b
}

func (b *Buffer) Store(metrics, location, network interface{}) {
	b.mu.Lock()
	defer b.mu.Unlock()

	entry := HeartbeatEntry{Metrics: metrics, Location: location, Network: network}

	if b.file != nil {
		data, _ := json.Marshal(entry)
		b.file.Write(append(data, '\n'))
	}
	b.items = append(b.items, entry)
	log.Printf("📦 Buffered offline heartbeat (%d total)", len(b.items))
}

func (b *Buffer) Flush(sendFn func(metrics, location, network interface{}) error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.items) == 0 {
		return
	}

	log.Printf("📤 Flushing %d buffered heartbeats...", len(b.items))
	successCount := 0
	for i, entry := range b.items {
		if err := sendFn(entry.Metrics, entry.Location, entry.Network); err != nil {
			log.Printf("⚠️  Failed to flush entry %d: %v", i, err)
			// Keep remaining items
			b.items = b.items[i:]
			return
		}
		successCount++
	}

	b.items = nil
	log.Printf("✅ Flushed %d heartbeats", successCount)
}