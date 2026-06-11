package collector

import (
	"os"
)

// GetAgentID returns a unique ID for the agent based on hostname
func GetAgentID(customHostname string) string {
	if customHostname != "" {
		return customHostname
	}
	
	h, err := os.Hostname()
	if err != nil {
		return "unknown-pc"
	}
	return h
}