package buffer

import (
	"bytes"
	"encoding/json"
	"os"
	"sync"

	"perimeterpulse/agent/collector"
)

type Buffer struct {
	path string
	mu   sync.Mutex
}

func New(path string) *Buffer {
	return &Buffer{path: path}
}

func (b *Buffer) Save(metrics *collector.Metrics, loc *collector.Location, netInfo *collector.NetworkInfo) {
	b.mu.Lock()
	defer b.mu.Unlock()

	entry := map[string]interface{}{
		"metrics":  metrics,
		"location": loc,
		"network":  netInfo,
	}

	data, _ := json.Marshal(entry)

	f, err := os.OpenFile(b.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()

	f.Write(data)
	f.Write([]byte("\n"))
}

func (b *Buffer) Flush(sendFn func(*collector.Metrics, *collector.Location, *collector.NetworkInfo) error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	data, err := os.ReadFile(b.path)
	if err != nil {
		return
	}

	if len(data) == 0 {
		return
	}

	lines := bytes.Split(data, []byte("\n"))
	for _, line := range lines {
		if len(line) == 0 {
			continue
		}

		var entry struct {
			Metrics *collector.Metrics      `json:"metrics"`
			Location *collector.Location     `json:"location"`
			Network  *collector.NetworkInfo  `json:"network"`
		}

		if err := json.Unmarshal(line, &entry); err != nil {
			continue
		}

		if err := sendFn(entry.Metrics, entry.Location, entry.Network); err != nil {
			return // stop on first failure, will retry later
		}
	}

	os.Remove(b.path)
}