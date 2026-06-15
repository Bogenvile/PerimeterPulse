//go:build windows

package collector

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
	"unsafe"
)

// WiFiInfo holds wireless network details
type WiFiInfo struct {
	SSID      string
	SignalDBM int
	LinkSpeed float64
	IP        string
	Gateway   string
}

// GetWiFiInfo retrieves WiFi information using netsh on Windows
func GetWiFiInfo() WiFiInfo {
	info := WiFiInfo{SignalDBM: -999}

	cmd := exec.Command("netsh", "wlan", "show", "interfaces")
	out, err := cmd.Output()
	if err != nil {
		return info
	}

	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "SSID") && !strings.Contains(trimmed, "BSSID") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				info.SSID = strings.TrimSpace(parts[1])
			}
		}
		if strings.HasPrefix(trimmed, "Signal") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				signalStr := strings.TrimSpace(parts[1])
				signalStr = strings.TrimRight(signalStr, "%")
				if pct, err := strconv.Atoi(strings.TrimSpace(signalStr)); err == nil {
					switch {
					case pct >= 100:
						info.SignalDBM = -30
					case pct <= 0:
						info.SignalDBM = -90
					default:
						info.SignalDBM = -90 + (pct * 60 / 100)
					}
				}
			}
		}
		if strings.HasPrefix(trimmed, "Receive rate") || strings.HasPrefix(trimmed, "Transmit rate") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				rateStr := strings.TrimSuffix(strings.TrimSpace(parts[1]), " Mbps")
				if rate, err := strconv.ParseFloat(rateStr, 64); err == nil && rate > 0 {
					info.LinkSpeed = rate
				}
			}
		}
	}

	cmd2 := exec.Command("netsh", "interface", "ip", "show", "config")
	out2, err := cmd2.Output()
	if err != nil {
		return info
	}

	for _, line := range strings.Split(string(out2), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "IP Address") && !strings.Contains(trimmed, "Subnet") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 && info.IP == "" {
				info.IP = strings.TrimSpace(parts[1])
			}
		}
		if strings.HasPrefix(trimmed, "Default Gateway") {
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 && info.Gateway == "" {
				info.Gateway = strings.TrimSpace(parts[1])
			}
		}
	}

	return info
}

// detectCPU returns CPU model and core count via PowerShell
func detectCPU() (model string, cores int) {
	cmd := exec.Command("powershell", "-Command",
		"Get-CimInstance Win32_Processor | Select-Object -ExpandProperty Name -First 1")
	out, err := cmd.Output()
	if err == nil {
		model = strings.TrimSpace(string(out))
	}
	if model == "" {
		model = "Unknown"
	}

	cmd2 := exec.Command("powershell", "-Command",
		"(Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors")
	out2, err := cmd2.Output()
	if err == nil {
		if c, e := strconv.Atoi(strings.TrimSpace(string(out2))); e == nil && c > 0 {
			cores = c
		}
	}
	if cores == 0 {
		cores = 1
	}
	return
}

// getTotalRAM returns total RAM via kernel32 GlobalMemoryStatusEx
func getTotalRAM() uint64 {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	proc := kernel32.NewProc("GlobalMemoryStatusEx")
	var buf [64]byte
	buf[0] = 64
	proc.Call(uintptr(unsafe.Pointer(&buf[0])))
	return *(*uint64)(unsafe.Pointer(&buf[8]))
}

// getUsedRAM returns used RAM via kernel32 GlobalMemoryStatusEx
func getUsedRAM() uint64 {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	proc := kernel32.NewProc("GlobalMemoryStatusEx")
	var buf [64]byte
	buf[0] = 64
	proc.Call(uintptr(unsafe.Pointer(&buf[0])))
	total := *(*uint64)(unsafe.Pointer(&buf[8]))
	avail := *(*uint64)(unsafe.Pointer(&buf[16]))
	return total - avail
}

// getLocalIPs returns all non-loopback IPv4 addresses
func getLocalIPs() []string {
	cmd := exec.Command("powershell", "-Command",
		"(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*'}).IPAddress")
	out, err := cmd.Output()
	if err != nil {
		return nil
	}
	var ips []string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		ip := strings.TrimSpace(line)
		if ip != "" {
			ips = append(ips, ip)
		}
	}
	return ips
}

// getDefaultGatewayForInterface returns the default gateway for a given interface index
func getDefaultGatewayForInterface(idx int) string {
	cmd := exec.Command("powershell", "-Command",
		fmt.Sprintf("(Get-NetRoute -InterfaceIndex %d -DestinationPrefix '0.0.0.0/0').NextHop", idx))
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func init() {
	fmt.Print("") // suppress unused import warning
	_ = unsafe.Sizeof(0)
}