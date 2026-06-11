//go:build windows

package collector

import (
	"fmt"
	"unsafe"

	"github.com/go-ole/go-ole"
	"github.com/go-ole/go-ole/oleutil"
	"syscall"
)

// MEMORYSTATUSEX structure for GlobalMemoryStatusEx
type MEMORYSTATUSEX struct {
	Length               uint32
	MemoryLoad           uint32
	TotalPhys            uint64
	AvailPhys            uint64
	TotalPageFile        uint64
	AvailPageFile        uint64
	TotalVirtual         uint64
	AvailVirtual         uint64
	AvailExtendedVirtual uint64
}

// GetHardwareInfo returns detailed hardware info for Windows
func GetHardwareInfo() HardwareInfo {
	return HardwareInfo{
		CPUModel:  getCPUModel(),
		CPUCores:  getCPUCores(),
		RAMTotal:  getRAMTotal(),
		DiskModel: getPhysicalDiskModel(),
		DiskType:  detectDiskType(),
		DiskSize:  getPhysicalDiskSize(),
		OS:        "Windows",
	}
}

func getCPUModel() string {
	err := ole.CoInitialize(0)
	if err != nil {
		return "Unknown"
	}
	defer ole.CoUninitialize()

	unknown, err := oleutil.CreateObject("WbemScripting.SWbemLocator")
	if err != nil {
		return "Unknown"
	}
	defer unknown.Release()

	wmi, err := unknown.QueryInterface(ole.IID_IDispatch)
	if err != nil {
		return "Unknown"
	}
	defer wmi.Release()

	serviceRaw, err := oleutil.CallMethod(wmi, "ConnectServer", nil, `root\cimv2`)
	if err != nil {
		return "Unknown"
	}
	service := serviceRaw.ToIDispatch()
	defer service.Release()

	resultRaw, err := oleutil.CallMethod(service, "ExecQuery", "SELECT Name FROM Win32_Processor")
	if err != nil {
		return "Unknown"
	}
	result := resultRaw.ToIDispatch()
	defer result.Release()

	countVar, err := oleutil.GetProperty(result, "Count")
	if err != nil {
		return "Unknown"
	}
	count := int32(countVar.Val)

	if count > 0 {
		itemRaw, err := oleutil.CallMethod(result, "ItemIndex", 0)
		if err != nil {
			return "Unknown"
		}
		item := itemRaw.ToIDispatch()
		defer item.Release()

		nameVar, err := oleutil.GetProperty(item, "Name")
		if err != nil {
			return "Unknown"
		}
		return nameVar.ToString()
	}
	return "Unknown"
}

func getCPUCores() int {
	err := ole.CoInitialize(0)
	if err != nil {
		return 0
	}
	defer ole.CoUninitialize()

	unknown, err := oleutil.CreateObject("WbemScripting.SWbemLocator")
	if err != nil {
		return 0
	}
	defer unknown.Release()

	wmi, err := unknown.QueryInterface(ole.IID_IDispatch)
	if err != nil {
		return 0
	}
	defer wmi.Release()

	serviceRaw, err := oleutil.CallMethod(wmi, "ConnectServer", nil, `root\cimv2`)
	if err != nil {
		return 0
	}
	service := serviceRaw.ToIDispatch()
	defer service.Release()

	resultRaw, err := oleutil.CallMethod(service, "ExecQuery", "SELECT NumberOfCores FROM Win32_Processor")
	if err != nil {
		return 0
	}
	result := resultRaw.ToIDispatch()
	defer result.Release()

	countVar, err := oleutil.GetProperty(result, "Count")
	if err != nil || countVar.Val == 0 {
		return 0
	}

	itemRaw, err := oleutil.CallMethod(result, "ItemIndex", 0)
	if err != nil {
		return 0
	}
	item := itemRaw.ToIDispatch()
	defer item.Release()

	coresVar, err := oleutil.GetProperty(item, "NumberOfCores")
	if err != nil {
		return 0
	}
	return int(coresVar.Val)
}

func getRAMTotal() uint64 {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	proc := kernel32.NewProc("GlobalMemoryStatusEx")

	var memInfo MEMORYSTATUSEX
	memInfo.Length = uint32(unsafe.Sizeof(memInfo))

	r1, _, _ := proc.Call(uintptr(unsafe.Pointer(&memInfo)))
	if r1 == 0 {
		return 0
	}
	return memInfo.TotalPhys
}

func getPhysicalDiskModel() string {
	err := ole.CoInitialize(0)
	if err != nil {
		return ""
	}
	defer ole.CoUninitialize()

	unknown, err := oleutil.CreateObject("WbemScripting.SWbemLocator")
	if err != nil {
		return ""
	}
	defer unknown.Release()

	wmi, err := unknown.QueryInterface(ole.IID_IDispatch)
	if err != nil {
		return ""
	}
	defer wmi.Release()

	serviceRaw, err := oleutil.CallMethod(wmi, "ConnectServer", nil, `root\cimv2`)
	if err != nil {
		return ""
	}
	service := serviceRaw.ToIDispatch()
	defer service.Release()

	resultRaw, err := oleutil.CallMethod(service, "ExecQuery", "SELECT Model FROM Win32_DiskDrive")
	if err != nil {
		return ""
	}
	result := resultRaw.ToIDispatch()
	defer result.Release()

	countVar, err := oleutil.GetProperty(result, "Count")
	if err != nil || countVar.Val == 0 {
		return ""
	}

	itemRaw, err := oleutil.CallMethod(result, "ItemIndex", 0)
	if err != nil {
		return ""
	}
	item := itemRaw.ToIDispatch()
	defer item.Release()

	modelVar, err := oleutil.GetProperty(item, "Model")
	if err != nil {
		return ""
	}
	return modelVar.ToString()
}

func getPhysicalDiskSize() uint64 {
	err := ole.CoInitialize(0)
	if err != nil {
		return 0
	}
	defer ole.CoUninitialize()

	unknown, err := oleutil.CreateObject("WbemScripting.SWbemLocator")
	if err != nil {
		return 0
	}
	defer unknown.Release()

	wmi, err := unknown.QueryInterface(ole.IID_IDispatch)
	if err != nil {
		return 0
	}
	defer wmi.Release()

	serviceRaw, err := oleutil.CallMethod(wmi, "ConnectServer", nil, `root\cimv2`)
	if err != nil {
		return 0
	}
	service := serviceRaw.ToIDispatch()
	defer service.Release()

	resultRaw, err := oleutil.CallMethod(service, "ExecQuery", "SELECT Size FROM Win32_DiskDrive")
	if err != nil {
		return 0
	}
	result := resultRaw.ToIDispatch()
	defer result.Release()

	countVar, err := oleutil.GetProperty(result, "Count")
	if err != nil || countVar.Val == 0 {
		return 0
	}

	itemRaw, err := oleutil.CallMethod(result, "ItemIndex", 0)
	if err != nil {
		return 0
	}
	item := itemRaw.ToIDispatch()
	defer item.Release()

	sizeVar, err := oleutil.GetProperty(item, "Size")
	if err != nil {
		return 0
	}

	sizeStr := sizeVar.ToString()
	var size uint64
	fmt.Sscanf(sizeStr, "%d", &size)
	return size
}

func detectDiskType() string {
	err := ole.CoInitialize(0)
	if err != nil {
		return "Unknown"
	}
	defer ole.CoUninitialize()

	unknown, err := oleutil.CreateObject("WbemScripting.SWbemLocator")
	if err != nil {
		return "Unknown"
	}
	defer unknown.Release()

	wmi, err := unknown.QueryInterface(ole.IID_IDispatch)
	if err != nil {
		return "Unknown"
	}
	defer wmi.Release()

	serviceRaw, err := oleutil.CallMethod(wmi, "ConnectServer", nil, `root\cimv2`)
	if err != nil {
		return "Unknown"
	}
	service := serviceRaw.ToIDispatch()
	defer service.Release()

	resultRaw, err := oleutil.CallMethod(service, "ExecQuery", "SELECT MediaType, Model FROM Win32_DiskDrive")
	if err != nil {
		return "Unknown"
	}
	result := resultRaw.ToIDispatch()
	defer result.Release()

	countVar, err := oleutil.GetProperty(result, "Count")
	if err != nil || countVar.Val == 0 {
		return "Unknown"
	}

	itemRaw, err := oleutil.CallMethod(result, "ItemIndex", 0)
	if err != nil {
		return "Unknown"
	}
	item := itemRaw.ToIDispatch()
	defer item.Release()

	mediaVar, err := oleutil.GetProperty(item, "MediaType")
	if err != nil {
		return "Unknown"
	}

	modelVar, err := oleutil.GetProperty(item, "Model")
	if err != nil {
		return "Unknown"
	}

	media := mediaVar.ToString()
	model := modelVar.ToString()

	if containsAny(model, "SSD", "NVMe", "Solid", "M.2") {
		return "SSD"
	}
	if containsAny(media, "SSD", "Solid") {
		return "SSD"
	}
	return "HDD"
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		for i := 0; i <= len(s)-len(sub); i++ {
			if s[i:i+len(sub)] == sub {
				return true
			}
		}
	}
	return false
}

type HardwareInfo struct {
	CPUModel  string
	CPUCores  int
	RAMTotal  uint64
	DiskModel string
	DiskType  string
	DiskSize  uint64
	OS        string
}