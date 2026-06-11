//go:build windows

package collector

import (
	"net"
	"syscall"
	"unsafe"
)

// WlanApi structures
var (
	wlanapi          = syscall.NewLazyDLL("wlanapi.dll")
	procOpenHandle   = wlanapi.NewProc("WlanOpenHandle")
	procCloseHandle  = wlanapi.NewProc("WlanCloseHandle")
	procEnumInterfaces = wlanapi.NewProc("WlanEnumInterfaces")
	procQueryInterface = wlanapi.NewProc("WlanQueryInterface")
)

type WLAN_INTERFACE_INFO struct {
	InterfaceGuid           [16]byte
	strInterfaceDescription [256]uint16
	isState                 uint32
}

type WLAN_INTERFACE_INFO_LIST struct {
	NumberOfItems uint32
	Index         uint32
	InterfaceInfo [1]WLAN_INTERFACE_INFO
}

type DOT11_SSID struct {
	uSSIDLength uint32
	ucSSID      [32]byte
}

type WLAN_ASSOCIATION_ATTRIBUTES struct {
	dot11Ssid         DOT11_SSID
	dot11Bssid        [6]byte
	dot11BssType      uint32
	dot11PhyType      uint32
	uDot11PhyIndex    uint32
	wlanSignalQuality uint32 // 0-100
	dot11Rate         uint32
}

type WLAN_SECURITY_ATTRIBUTES struct {
	bSecurityEnabled     uint32
	bOneXEnabled         uint32
	dot11AuthAlgorithm   uint32
	dot11CipherAlgorithm uint32
}

type WLAN_CONNECTION_ATTRIBUTES struct {
	isState                   uint32
	wlanConnectionMode        uint32
	strProfileName            [256]uint16
	wlanAssociationAttributes WLAN_ASSOCIATION_ATTRIBUTES
	wlanSecurityAttributes    WLAN_SECURITY_ATTRIBUTES
}

// GetWifiInfo connects to the Windows Native Wifi API to get precise signal strength
func GetWifiInfo() (string, int, string) {
	var handle uint32
	var negotiatedVersion uint32

	// 1. Open Handle
	ret, _, _ := procOpenHandle.Call(uintptr(2), 0, uintptr(unsafe.Pointer(&negotiatedVersion)), uintptr(unsafe.Pointer(&handle)))
	if ret != 0 {
		return "", 0, "Error: WlanApi open failed"
	}
	defer procCloseHandle.Call(uintptr(handle), 0)

	// 2. Enumerate Interfaces
	var pInterfaceList *WLAN_INTERFACE_INFO_LIST
	ret, _, _ = procEnumInterfaces.Call(uintptr(handle), 0, uintptr(unsafe.Pointer(&pInterfaceList)))
	if ret != 0 {
		return "", 0, "Error: Enum failed"
	}

	if pInterfaceList == nil || pInterfaceList.NumberOfItems == 0 {
		return "", 0, "No WLAN interface found"
	}

	// Fix: Access first element of the array correctly
	ifaceList := (*pInterfaceList)
	iface := ifaceList.InterfaceInfo[0]

	// 3. Query the interface for connection attributes
	var dataSize uint32
	var pData *byte
	opCode := uint32(7) // wlan_intf_opcode_current_connection

	ret, _, _ = procQueryInterface.Call(
		uintptr(handle),
		uintptr(unsafe.Pointer(&iface.InterfaceGuid)),
		uintptr(opCode),
		0,
		uintptr(unsafe.Pointer(&dataSize)),
		uintptr(unsafe.Pointer(&pData)),
		0,
	)

	if ret != 0 {
		return "", 0, "Query failed"
	}

	// Cast raw pointer to struct
	connAttr := (*WLAN_CONNECTION_ATTRIBUTES)(unsafe.Pointer(pData))

	// Extract SSID
	ssidBytes := connAttr.wlanAssociationAttributes.dot11Ssid.ucSSID[:connAttr.wlanAssociationAttributes.dot11Ssid.uSSIDLength]
	ssid := string(ssidBytes)

	// Extract Quality (0-100)
	quality := connAttr.wlanAssociationAttributes.wlanSignalQuality

	// Convert to dBm (Standard approximation: 0% = -100dBm, 100% = -50dBm)
	dBm := -100
	if quality > 0 {
		dBm = -100 + int(quality)/2
	}

	// Get IP for this interface (simplified)
	ip := getIPForInterface(iface.InterfaceGuid[:])

	return ssid, dBm, ip
}

func getIPForInterface(guid []byte) string {
	// Matching GUID to net.Interface is complex, fallback to finding active IPs
	return "" 
}

// GetAllIPs returns all active IPv4 addresses
func GetAllIPs() []string {
	var ips []string
	ifaces, err := net.Interfaces()
	if err != nil {
		return ips
	}
	for _, i := range ifaces {
		addrs, err := i.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil || ip.IsLoopback() {
				continue
			}
			ip = ip.To4()
			if ip != nil {
				ips = append(ips, ip.String())
			}
		}
	}
	return ips
}