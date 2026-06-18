package collector

import (
	"log"
	"time"
)

// BuildHeartbeat gathers metrics, location, and network info into a single map
// suitable for JSON serialisation in the heartbeat request.
func BuildHeartbeat(agentID string) map[string]interface{} {
	metrics, err := CollectMetrics()
	if err != nil {
		log.Printf("Warning: failed to collect metrics: %v", err)
		metrics = map[string]interface{}{}
	}
	metrics["timestamp"] = time.Now().Format(time.RFC3339)

	location, err := CollectLocation()
	if err != nil {
		log.Printf("Warning: failed to collect location: %v", err)
	}

	networkInfo, err := CollectNetworkInfo()
	if err != nil {
		log.Printf("Warning: failed to collect network info: %v", err)
	}

	payload := map[string]interface{}{
		"agent_id":     agentID,
		"metrics":      metrics,
		"location":     location,
		"network_info": networkInfo,
	}

	return payload
}