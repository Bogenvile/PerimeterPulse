package buffer

import (
	"encoding/json"
	"os"
	"sync"
)

// Buffer stores entries for offline buffering
type Buffer struct {
	mu      sync.Mutex
	entries []interface{}
	maxSize int
}

// NewBuffer creates a new Buffer
func NewBuffer(maxSize int) *Buffer {
	return &Buffer{maxSize: maxSize, entries: make([]interface{}, 0)}
}

// Add adds an entry to the buffer
func (b *Buffer) Add(entry interface{}) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if len(b.entries) < b.maxSize {
		b.entries = append(b.entries, entry)
	}
}

// Size returns the current size of the buffer
func (b *Buffer) Size() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.entries)
}

// Flush clears the buffer and returns all entries
func (b *Buffer) Flush() []interface{} {
	b.mu.Lock()
	defer b.mu.Unlock()
	entries := b.entries
	b.entries = make([]interface{}, 0)
	return entries
}

// SaveToDisk saves the buffer to a file
func (b *Buffer) SaveToDisk(path string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if len(b.entries) == 0 {
		return nil
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	for _, e := range b.entries {
		if err := enc.Encode(e); err != nil {
			return err
		}
	}
	return nil
}