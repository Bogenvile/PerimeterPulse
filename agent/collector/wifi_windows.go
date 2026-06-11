//go:build windows

package collector

import (
	"syscall"
	"unsafe"
)

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
	wlanSignalQuality uint32
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

func GetWifiInfo() (string, int, string) {
	var handle uint32
	var negotiatedVersion uint32

	ret, _, _ := procOpenHandle.Call(uintptr(2), 0, uintptr(unsafe.Pointer(&negotiatedVersion)), uintptr(unsafe.Pointer(&handle)))
	if ret != 0 { return "", 0, "" }
	defer procCloseHandle.Call(uintptr(handle), 0)

	var pInterfaceList *WLAN_INTERFACE_INFO_LIST
	ret, _, _ = procEnumInterfaces.Call(uintptr(handle), 0, uintptr(unsafe.Pointer(&pInterfaceList)))
	if ret != 0 || pInterfaceList == nil || pInterfaceList.NumberOfItems == 0 {
		return "", 0, ""
	}

	ifaceList := (*pInterfaceList)
	iface := ifaceList.InterfaceInfo[0]

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

	if ret != 0 { return "", 0, "" }

	connAttr := (*WLAN_CONNECTION_ATTRIBUTES)(unsafe.Pointer(pData))
	ssidBytes := connAttr.wlanAssociationAttributes.dot11Ssid.ucSSID[:connAttr.wlanAssociationAttributes.dot11Ssid.uSSIDLength]
	ssid := string(ssidBytes)

	quality := connAttr.wlanAssociationAttributes.wlanSignalQuality
	dBm := -100
	if quality > 0 {
		dBm = -100 + int(quality)/2
	}

	return ssid, dBm, ""
}