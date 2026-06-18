package collector

import (
	"log"
	"time"
)

func BuildHeartbeat(agentID string) map[string]interface{} {
	metrics := CollectMetrics(agentID)
	location := CollectLocation()
	network := CollectNetworkInfo()

	payload := map[string]interface{}{
		"agent_id":     agentID,
		"metrics":      metrics,
		"location":     location,
		"network_info": network,
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
	}

	_ = log.Println
	return payload
}
