package buffer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

type StoredRecord struct {
	Timestamp   string      `json:"timestamp"`
	Metrics     interface{} `json:"metrics"`
	Location    interface{} `json:"location"`
	NetworkInfo interface{} `json:"network_info"`
}

type Client interface {
	SendHeartbeat(metrics interface{}, location interface{}, networkInfo interface{}) error
}

type Buffer struct {
	client  Client
	mu      sync.Mutex
	queue   []StoredRecord
}

func New(c Client) *Buffer {
	return &Buffer{
		client: c,
		queue:  make([]StoredRecord, 0),
	}
}

func (b *Buffer) Start() {
	go b.flushLoop()
	b.loadFromDisk()
}

func (b *Buffer) Store(metrics interface{}, location interface{}, networkInfo interface{}) {
	b.mu.Lock()
	defer b.mu.Unlock()

	record := StoredRecord{
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
		Metrics:     metrics,
		Location:    location,
		NetworkInfo: networkInfo,
	}

	b.queue = append(b.queue, record)
	b.appendToDisk(record)
}

func (b *Buffer) Flush() {
	b.mu.Lock()
	pending := make([]StoredRecord, len(b.queue))
	copy(pending, b.queue)
	b.queue = nil
	b.mu.Unlock()

	successCount := 0
	for _, record := range pending {
		err := b.client.SendHeartbeat(record.Metrics, record.Location, record.NetworkInfo)
		if err != nil {
			b.mu.Lock()
			b.queue = append(b.queue, record)
			b.mu.Unlock()
			fmt.Printf("[buffer] Failed to resend: %v\n", err)
		} else {
			successCount++
		}
	}

	if successCount > 0 {
		fmt.Printf("[buffer] Resent %d/%d records\n", successCount, len(pending))
	}
}

func (b *Buffer) flushLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		b.Flush()
	}
}

func (b *Buffer) loadFromDisk() {
	b.mu.Lock()
	defer b.mu.Unlock()

	data, err := os.ReadFile("pulse-buffer.jsonl")
	if err != nil {
		return
	}

	lines := bytes.Split(data, []byte("\n"))
	for _, line := range lines {
		if len(line) == 0 {
			continue
		}
		var record StoredRecord
		if err := json.Unmarshal(line, &record); err != nil {
			continue
		}
		b.queue = append(b.queue, record)
	}

	if len(b.queue) > 0 {
		fmt.Printf("[buffer] Loaded %d buffered records from disk\n", len(b.queue))
	}
}

func (b *Buffer) appendToDisk(record StoredRecord) {
	data, err := json.Marshal(record)
	if err != nil {
		return
	}

	f, err := os.OpenFile("pulse-buffer.jsonl", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()

	f.Write(data)
	f.Write([]byte("\n"))
}