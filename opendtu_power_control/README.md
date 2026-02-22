# OpenDTU Power Control Script

For project overview, see the [main README](../README.md)

## Overview

This script controls an OpenDTU inverter power limit based on real-time measurements from a Shelly 3EM Pro energy meter. It dynamically adjusts the inverter output to balance grid power consumption.

## Prerequisites

- OpenDTU device with accessible API
- Shelly 3EM Pro for power measurements
- Inverter serial number
- OpenDTU admin password (if authentication enabled)

## Installation Steps

1. Open your Shelly 3EM Pro web interface
2. Navigate to Scripts section
3. Create a new script and paste the contents of `control_opendtu_power.js`
4. Configure the variables at the top of the script (see Configuration section)
5. Save and start the script
6. Enable "Run on startup" to ensure script runs after device restarts

## Configuration

### Basic Variables

| Name                       | Description                                                                                 |
|----------------------------|---------------------------------------------------------------------------------------------|
| HOST                       | IP address or hostname of OpenDTU device (leave empty if using MAC)                         |
| MAC                        | MAC address for auto-resolution (only for Shelly AP mode, leave empty if using HOST)        |
| PORT                       | OpenDTU port (usually 80)                                                                   |
| AUTH_PASSWORD              | Admin password for OpenDTU (leave empty if authentication disabled)                         |
| INVERTER_SERIAL            | Serial number of the inverter                                                               |
| INVERTER_MANUFACTURER      | Manufacturer name (e.g., "Hoymiles", "DeyeSun", "HoymilesW") - only needed for OpenDTU fork |
| MAX_INVERTER_POWER         | Maximum inverter power in watts (used for percentage calculations)                          |
| MAX_LIMIT_WATT             | Maximum limit to set in watts (can be less than MAX_INVERTER_POWER)                         |
| MIN_LIMIT_PERCENTAGE       | Minimum percentage limit (0-100, use 1 if device treats 0% as 100%)                         |
| TIMEOUT_RESEND_LIMIT       | Interval in seconds to resend limit even if no change detected (default: 30)                |
| TIMEOUT_DEVICE_UNREACHABLE | Timeout in seconds before inverter considered unreachable (default: 95)                     |
| DEBUG                      | Enable debug logging (true/false)                                                           |
| INPUT_DEVIDER              | Input divider for multi-input inverters (see explanation below)                             |

### Advanced Setup - Intervals

All intervals are defined in seconds.

| Name                         | Description                                        |
|------------------------------|----------------------------------------------------|
| INTERVAL_RUN_MAIN_SCRIPT     | Main control loop interval (default: 5)            |
| INTERVAL_RESOLVE_MAC         | MAC resolution interval if using MAC (default: 60) |
| INTERVAL_FETCH_CURRENT_LIMIT | Status fetch interval from inverter (default: 15)  |

## INPUT_DEVIDER Explanation

The INPUT_DEVIDER compensates for inverters with multiple solar inputs where not all inputs are used. This is needed when the inverter firmware does not support dynamic input limitation.

**Examples:**
- 2T inverter with 1 input connected: `INPUT_DEVIDER = 0.5` (1/2)
- 4T inverter with 1 input connected: `INPUT_DEVIDER = 0.25` (1/4)
- All inputs connected: `INPUT_DEVIDER = 1.0` (default)

**Why is this needed?**

When an inverter has 4 inputs but only 1 is connected, setting a limit of 100W might only allocate 25W to the connected input. The divider compensates by setting the limit higher internally (400W in this case) so the connected input receives the full 100W.

If your inverter firmware supports dynamic input limitation, use `INPUT_DEVIDER = 1.0`.

## Special Notes

### Manufacturer Name

The `INVERTER_MANUFACTURER` parameter is only required when using the OpenDTU fork: https://github.com/tost11/OpenDTU-Push-Rest-API-and-Deye-Sun

Standard OpenDTU installations can leave this empty or omit it.

### Authentication

If OpenDTU has admin password protection enabled, set `AUTH_PASSWORD` to your admin password. Leave empty if authentication is disabled.

### Percentage vs Watt Limits

The script converts watt limits to percentage limits before sending to OpenDTU:
- `percentage = (watt_limit / MAX_INVERTER_POWER) * 100`
- Percentage is clamped between MIN_LIMIT_PERCENTAGE and 100

## Troubleshooting

| Problem                 | Solution                                                                |
|-------------------------|-------------------------------------------------------------------------|
| Connection fails        | Verify HOST/IP is correct and OpenDTU is reachable from Shelly          |
| Authentication errors   | Check AUTH_PASSWORD matches OpenDTU admin password                      |
| Serial number not found | Verify INVERTER_SERIAL matches exactly (case-sensitive)                 |
| Limit not applied       | Check MIN_LIMIT_PERCENTAGE setting - some devices require minimum of 1% |
| Wrong power values      | Verify MAX_INVERTER_POWER matches inverter specification                |
| Multi-input issues      | Adjust INPUT_DEVIDER based on connected inputs                          |

## Configuration Example

```javascript
// Basic configuration
let HOST = "192.168.178.50";
let PORT = 80;
let AUTH_PASSWORD = "myPassword123";

// Inverter settings
let INVERTER_SERIAL = "116182123456";
let INVERTER_MANUFACTURER = "Hoymiles";
let MAX_INVERTER_POWER = 600;
let MAX_LIMIT_WATT = 500;
let MIN_LIMIT_PERCENTAGE = 1;

// Advanced
let DEBUG = true;
let INPUT_DEVIDER = 0.5;  // 2T with 1 input
```

## Monitoring

Use the watchdog script to monitor this script and automatically restart if it crashes. See [shelly_script_checks/README.md](../shelly_script_checks/README.md) for details.
