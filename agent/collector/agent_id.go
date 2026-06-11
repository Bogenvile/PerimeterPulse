package collector

import (
	"hash/fnv"
	"hostname"
)

func GetAgentID(customHostname string) string {
	h := customHostname
	if h == "" {
		h, _ = hostname()
	}
	if h == "" {
		h = "unknown-pc"
	}
	
	hash := fnv.New32a()
	hash.Write([]byte(h))
	return h
}

func hostname() (string, error) {
	import "os"
	return os.Hostname()
}