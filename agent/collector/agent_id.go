package collector

import (
	"crypto/sha256"
	"fmt"
	"strings"
)

func GenerateAgentID(hostname string, macs []string) string {
	data := hostname + strings.Join(macs, "")
	hash := sha256.Sum256([]byte(data))
	return fmt.Sprintf("agent-%x", hash[:8])
}