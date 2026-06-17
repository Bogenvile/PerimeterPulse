package collector

import (
	"net"
	"time"
)

// PingGoogle measures TCP latency to 8.8.8.8:53
func PingGoogle() (float64, error) {
	start := time.Now()
	conn, err := net.DialTimeout("tcp", "8.8.8.8:53", 3*time.Second)
	if err != nil {
		return 0, err
	}
	defer conn.Close()

	return float64(time.Since(start).Milliseconds()), nil
}