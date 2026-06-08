package collector

// CollectLocation returns the device location.
// On Windows it always falls back to a GeoIP lookup.
func CollectLocation() (Location, error) {
	lat, lon, acc, src, err := GetGeoIPLocation()
	if err != nil {
		return Location{}, err
	}
	return Location{
		Latitude:       lat,
		Longitude:      lon,
		AccuracyMeters: acc,
		Source:         src,
	}, nil
}