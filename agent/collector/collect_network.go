package collector

// CollectNetwork is overridden to use the enhanced network detection
// This replaces any previous CollectNetwork definition
func CollectNetwork() NetworkInfoData {
	return CollectNetworkInfo()
}