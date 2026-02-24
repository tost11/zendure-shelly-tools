# Zendure Online Monitoring Scripts

For project overview, see the [main README](../README.md)

## Overview

These scripts send data from your Zendure Solarflow 800 Pro power station to an online monitoring system for visualization and analysis.

The online monitoring system is available at: https://github.com/tost11/solar-monitoring

Or an example running instance at: https://solar.pihost.org or https://solar.tost-soft.de

## Script Variants Comparison

Three variants are available for different network configurations:

| Script                                         | Connection Method      | Used when                       | Required Variables           |
|------------------------------------------------|------------------------|---------------------------------|------------------------------|
| `zendure_online_monitoring_ip.js`              | Direct IP/hostname     | Device on home WiFi network     | HOST, SERIAL, ONLINE_*       |
| `zendure_online_monitoring_mac.js`             | MAC address resolution | Shelly AP mode (range extender) | MAC, SERIAL, ONLINE_*        |
| `zendure_online_monitoring_find_device.js`     | Network scanning       | Unknown IP or dynamic networks  | SERIAL, ONLINE_*             |

## When to Use Each Variant

### zendure_online_monitoring_ip.js
Use when:
- Zendure device is connected to your home WiFi
- Device has a static IP or predictable hostname
- You want the simplest script

### zendure_online_monitoring_mac.js
Use when:
- Shelly is in AP mode acting as a WiFi range extender
- Zendure connects directly to Shelly's AP
- IP address changes but MAC remains constant

### zendure_online_monitoring_find_device.js
Use when:
- Device IP is unknown or frequently changes
- Automatic network discovery is needed
- Operating across multiple network interfaces (WiFi AP, WiFi STA, Ethernet)

## Installation Steps

1. Set up your online monitoring system following the instructions at https://github.com/tost11/solar-monitoring
2. Note down your SYSTEM_ID and CLIENT_TOKEN from the monitoring system
3. Open your Shelly device web interface
4. Navigate to Scripts section
5. Create a new script and paste the contents of your chosen variant
6. Configure the variables at the top of the script (see Configuration section)
7. Save and start the script
8. Enable "Run on startup" to ensure script runs after device restarts

## Configuration

### Basic Variables

| Name                  | Functionality                                                                     |
|-----------------------|-----------------------------------------------------------------------------------|
| HOST                  | IP address or hostname of Zendure device (IP variant only)                       |
| MAC                   | MAC address of Zendure device (MAC variant only, format: AA:BB:CC:DD:EE:FF)      |
| SERIAL                | Serial number of Zendure device (required for all variants)                      |
| DATA_DURATION         | Time interval in seconds between data fetches (default: 30, minimum: 5)          |
| ONLINE_SYSTEM_ID      | System ID from monitoring URL (e.g., https://[DOMAIN]/dd/[ID])                   |
| ONLINE_CLIENT_TOKEN   | Client secret token from monitoring system settings                              |
| ONLINE_URL_1          | Primary monitoring system URL (default: https://solar.pihost.org)                |
| ONLINE_URL_2          | Backup monitoring system URL (default: https://solar.tost-soft.de)               |
| ONLINE_DEVICE_ID      | Device ID in monitoring system (default: 1, important if multiple devices)        |
| DEBUG                 | Enable debug logging (true/false)                                                 |

### Advanced Setup - Intervals

All intervals are defined in seconds.

| Name                      | Functionality                                                                     |
|---------------------------|-----------------------------------------------------------------------------------|
| INTERVAL_RESOLVE_MAC      | MAC to IP resolution interval (MAC variant only, default: 300)                    |
| INTERVAL_SCAN_NETWORK     | Network scanning interval (find device variant only, default: 900)                |
| INTERVAL_DEVICE_OFFLINE   | Timeout before device considered offline (find device variant only, default: 600) |
| CHECK_WIFI_AP             | Scan WiFi AP network (find device variant only, true/false)                       |
| CHECK_WIFI_STA            | Scan WiFi STA network (find device variant only, true/false)                      |
| CHECK_ETH                 | Scan Ethernet network (find device variant only, true/false)                      |

**Important:** Do not set DATA_DURATION below 5 seconds. Also, online monitoring may block on to many request.

## Features

- Read-only monitoring (no device control)
- Fetches comprehensive device data:
  - Solar input power (DC) from up to 6 inputs
  - Battery power, voltage, and percentage
  - Grid input/output power (AC)
  - Device temperature
- Dual-URL failover mechanism (primary and backup monitoring servers)
- MAC to IP resolution for Shelly AP mode (MAC variant)
- Automatic network scanning and device discovery (find device variant)
- Persistent IP storage across restarts (find device variant)
- Configurable data collection interval

## Limitations

- 5-second minimum interval between data fetches
- Device must support Zendure local API
- Requires external monitoring system to be accessible

## Configuration Examples

### Example 1: Basic IP Setup

Simple home WiFi setup with fixed IP:

```javascript
let HOST = "192.168.1.100";
let SERIAL = "AB123456789";
let DATA_DURATION = 30;
let ONLINE_SYSTEM_ID = "abc123def456";
let ONLINE_CLIENT_TOKEN = "your-secret-token-here";
let ONLINE_URL_1 = "https://solar.pihost.org";
let ONLINE_URL_2 = "https://solar.tost-soft.de";
let ONLINE_DEVICE_ID = 1;
let DEBUG = false;
```

### Example 2: Advanced Find Device with Custom Intervals

Automatic discovery with custom scanning intervals:

```javascript
let SERIAL = "AB123456789";
let DATA_DURATION = 60;  // Fetch data every minute
let ONLINE_SYSTEM_ID = "abc123def456";
let ONLINE_CLIENT_TOKEN = "your-secret-token-here";
let ONLINE_URL_1 = "https://solar.pihost.org";
let ONLINE_DEVICE_ID = 1;
let DEBUG = false;
let INTERVAL_SCAN_NETWORK = 1800;  // Scan every 30 minutes
let INTERVAL_DEVICE_OFFLINE = 900;  // 15 minutes offline timeout
let CHECK_WIFI_AP = true;
let CHECK_WIFI_STA = true;
let CHECK_ETH = false;
```

### Example 3: AP Mode MAC Setup

Shelly as WiFi extender:

```javascript
let MAC = "AA:BB:CC:DD:EE:FF";
let SERIAL = "AB123456789";
let DATA_DURATION = 30;
let ONLINE_SYSTEM_ID = "abc123def456";
let ONLINE_CLIENT_TOKEN = "your-secret-token-here";
let ONLINE_URL_1 = "https://solar.pihost.org";
let ONLINE_URL_2 = "https://solar.tost-soft.de";
let ONLINE_DEVICE_ID = 1;
let INTERVAL_RESOLVE_MAC = 300;  // Resolve every 5 minutes
let DEBUG = false;
```

## Data Format

The scripts send data in the following JSON format:

```json
{
  "duration": 30,
  "timestamp": 1677649200000,
  "devices": [{
    "id": 1,
    "batteryWatt": 150,
    "inputWattDC": 500,
    "outputWattAC": 350,
    "inputWattAC": 0,
    "batteryVoltage": 51.2,
    "batteryPercentage": 80,
    "temperature": 25.5,
    "inputsDC": [
      {"id": 1, "watt": 250},
      {"id": 2, "watt": 250}
    ]
  }]
}
```

## Error Handling

The scripts implement intelligent error handling for monitoring system communication:

- **401/403/404 errors**: Authentication or system not found. Backup URL is not tried (same credentials would fail).
- **400 errors**: Invalid data format. Backup URL is not tried (data would be invalid there too).
- **Other errors**: Automatic failover to backup URL if configured.
- **Network errors**: Logged and retried on next cycle.

## Monitoring

Use the watchdog script to monitor this script and automatically restart if it crashes. See [shelly_script_checks/README.md](../shelly_script_checks/README.md) for details.

## Related Components

- **Power Control Scripts**: [zendure_power_control/README.md](../zendure_power_control/README.md)
- **Watchdog Scripts**: [shelly_script_checks/README.md](../shelly_script_checks/README.md)
- **WiFi Configuration**: [zendure_bluetooth_connect/README.md](../zendure_bluetooth_connect/README.md)

## External Resources

- Online Monitoring System: https://github.com/tost11/solar-monitoring
- Zendure SDK Documentation: https://github.com/Zendure/zenSDK
