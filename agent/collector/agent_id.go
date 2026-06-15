package collector

import (
	"crypto/sha256"
	"encoding/hex"
	"sort"
	"strings"
)

// GenerateAgentID creates a deterministic, persistent agent ID based on hostname and MAC addresses.
// This ensures the agent_id remains the same across restarts on the same machine.
func GenerateAgentID(hostname string, macAddresses []string) string {
	// Normalize: lowercase hostname, sort MACs
	normalized := strings.ToLower(strings.TrimSpace(hostname))

	sortedMACs := make([]string, len(macAddresses))
	copy(sortedMACs, macAddresses)
	sort.Strings(sortedMACs)

	// Build input: hostname + sorted MACs joined
	input := normalized
	for _, mac := range sortedMACs {
		input += "|" + strings.ToLower(strings.ReplaceAll(mac, ":", ""))
	}

	// SHA256 hash → first 8 hex chars → prefix "agent-"
	hash := sha256.Sum256([]byte(input))
	return "agent-" + hex.EncodeToString(hash[:4]) // 8 hex chars
}