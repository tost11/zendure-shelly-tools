# Zendure Power Control Scripts

For project overview, see the [main README](../README.md)

## Overview

These scripts dynamically adjust your Zendure Solarflow 800 Pro power output based on real-time measurements from a Shelly 3EM Pro energy meter. The system automatically balances grid power by adjusting the inverter output to minimize grid import/export.

## Script Variants Comparison

Three variants are available for different network configurations:

| Script                                 | Connection Method      | Used when                       | Required Variables |
|----------------------------------------|------------------------|---------------------------------|--------------------|
| `control_zendure_power_ip.js`          | Direct IP/hostname     | Device on home WiFi network     | HOST, SERIAL       |
| `control_zendure_power_mac.js`         | MAC address resolution | Shelly AP mode (range extender) | MAC, SERIAL        |
| `control_zendure_power_find_device.js` | Network scanning       | Unknown IP or dynamic networks  | SERIAL only        |

## When to Use Each Variant

### control_zendure_power_ip.js
Use when:
- Zendure device is connected to your home WiFi
- Device has a static IP or predictable hostname
- You want the simplest script

### control_zendure_power_mac.js
Use when:
- Shelly is in AP mode acting as a WiFi range extender
- Zendure connects directly to Shelly's AP
- IP address changes but MAC remains constant

### control_zendure_power_find_device.js
Use when:
- Device IP is unknown or frequently changes
- Automatic network discovery is needed
- Operating across multiple network interfaces (WiFi AP, WiFi STA, Ethernet)

## Installation Steps

1. Open your Shelly 3EM Pro web interface
2. Navigate to Scripts section
3. Create a new script and paste the contents of your chosen variant
4. Configure the variables at the top of the script (see Configuration section)
5. Save and start the script
6. Enable "Run on startup" to ensure script runs after device restarts

## Configuration

### Basic Variables

| Name                  | Functionality                                                                    |
|-----------------------|----------------------------------------------------------------------------------|
| HOST                  | IP address or hostname of Zendure device (IP variant only)                       |
| MAC                   | MAC address of Zendure device (MAC variant only, format: AA:BB:CC:DD:EE:FF)      |
| SERIAL                | Serial number of Zendure device (required for all variants)                      |
| MAX_POWER             | Maximum power in watts to send to grid (e.g., 800)                               |
| MAX_POWER_REVERSE     | Maximum power in watts to draw from grid (e.g., 1000, negative value internally) |
| REVERSE               | Enable charging from grid when excess power available (true/false)               |
| REVERSE_STARTUP_POWER | Minimum negative power to start charging from grid (e.g., 30 watts)              |
| REVERSE_STOP_POWER    | Power threshold to stop charging from grid (e.g., 10 watts)                      |
| STARTUP_POWER         | Minimum power to start inverting to grid (e.g., 30 watts)                        |
| STOP_POWER            | Power threshold to stop inverting (e.g., 15 watts)                               |
| DEBUG                 | Enable debug logging (true/false)                                                |

### Advanced Setup - Intervals

All intervals are defined in seconds.

| Name                      | Functionality                                                                     |
|---------------------------|-----------------------------------------------------------------------------------|
| INTERVAL_RUN_MAIN_SCRIPT  | Main control loop interval (default: 5, minimum: 5)                               |
| INTERVAL_RESOLVE_MAC      | MAC to IP resolution interval (MAC variant only, default: 300)                    |
| INTERVAL_SCAN_NETWORK     | Network scanning interval (find device variant only, default: 900)                |
| INTERVAL_DEVICE_OFFLINE   | Timeout before device considered offline (find device variant only, default: 600) |
| CHECK_WIFI_AP             | Scan WiFi AP network (find device variant only, true/false)                       |
| CHECK_WIFI_STA            | Scan WiFi STA network (find device variant only, true/false)                      |
| CHECK_ETH                 | Scan Ethernet network (find device variant only, true/false)                      |

**Important:** Do not set INTERVAL_RUN_MAIN_SCRIPT below 5 seconds. The device needs time to adjust power. More frequent updates cause oscillating values.

## Features

- Fetches current device status before setting new limits (avoids unnecessary writes)
- Minimum 5-second interval between power changes
- Concurrency control (only one execution at a time)
- Self-monitoring to detect stuck processes
- Bypass mode detection (recognizes when device is empty or full)
- Reverse charging support (stores excess power from additional inverters)
- MAC to IP resolution for Shelly AP mode (MAC variant)
- Automatic network scanning and device discovery (find device variant)
- Persistent IP storage across restarts (find device variant)

## Limitations

- Power changes under 5 watts are ignored to prevent oscillation
- 5-second minimum interval required between adjustments
- Device must support Zendure local API

## Configuration Examples

### Example 1: Basic IP Setup

Simple home WiFi setup with fixed IP:

```javascript
let HOST = "192.168.1.100";
let SERIAL = "AB123456789";
let MAX_POWER = 800;
let MAX_POWER_REVERSE = 1000;
let REVERSE = false;
let DEBUG = false;
```

### Example 2: Advanced Find Device with Reverse Charging

Automatic discovery with grid charging enabled:

```javascript
let SERIAL = "AB123456789";
let MAX_POWER = 800;
let MAX_POWER_REVERSE = 1000;
let REVERSE = true;
let REVERSE_STARTUP_POWER = 50;
let REVERSE_STOP_POWER = 20;
let STARTUP_POWER = 30;
let STOP_POWER = 15;
let DEBUG = false;
let CHECK_WIFI_AP = true;
let CHECK_WIFI_STA = true;
let CHECK_ETH = false;
```

### Example 3: AP Mode MAC Setup

Shelly as WiFi extender:

```javascript
let MAC = "AA:BB:CC:DD:EE:FF";
let SERIAL = "AB123456789";
let MAX_POWER = 800;
let INTERVAL_RESOLVE_MAC = 300;  // Resolve every 5 minutes
let DEBUG = false;
```

## Monitoring

Use the watchdog script to monitor this script and automatically restart if it crashes. See [shelly_script_checks/README.md](../shelly_script_checks/README.md) for details.
