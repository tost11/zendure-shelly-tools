# Shelly Script Watchdog

For project overview, see the [main README](../README.md)

## Overview

This watchdog script monitors other Shelly scripts and automatically restarts them if they crash or stop running. It performs periodic checks and ensures critical automation scripts remain operational.

## How It Works

1. Periodically checks if the target script is running
2. If script is stopped, validates that it contains code
3. Automatically restarts the script if it has crashed
4. Logs all restart events for troubleshooting
5. Continues monitoring in the background

## Installation Steps

1. Deploy your target script first (e.g., power control script)
2. Verify the target script is working correctly
3. Create a new script in Shelly web interface
4. Paste the contents of `check_script_running.js`
5. Configure TARGET_SCRIPT_NAME to match your target script name exactly
6. Save and start the watchdog script
7. Enable "Run on startup" for the watchdog

**Important:** The target script must be running and configured before starting the watchdog.

## Configuration

| Name                | Description                                                |
|---------------------|------------------------------------------------------------|
| TARGET_SCRIPT_NAME  | Exact name of the script to monitor (must match exactly)   |
| CHECK_INTERVAL_MS   | Check interval in milliseconds (default: 60000 = 1 minute) |
| DEBUG               | Enable debug logging (true/false)                          |

## Usage Recommendations

### Which Scripts to Monitor

Recommended for:
- Power control scripts (Zendure, OpenDTU)
- Critical automation scripts
- Scripts that run continuously

Not needed for:
- One-time setup scripts
- Scripts that are already stable

### Check Interval Guidance

- Default (60000ms / 1 minute): Good for most use cases
- Shorter interval (30000ms): For critical scripts requiring faster recovery
- Longer interval (300000ms / 5 minutes): For stable scripts to reduce overhead

### Log Monitoring

Monitor Shelly logs to:
- Verify watchdog is running
- Track restart events
- Identify recurring failures that need investigation

### Troubleshooting Recurring Failures

If a script repeatedly crashes:
1. Check the target script logs for error messages
2. Verify configuration variables in the target script
3. Ensure network connectivity to external devices
4. Review resource constraints on Shelly device

## Configuration Example

```javascript
let TARGET_SCRIPT_NAME = "Zendure Power Control";
let CHECK_INTERVAL_MS = 60000;  // Check every minute
let DEBUG = false;
```

## Important Notes

- Script name must match exactly (case-sensitive)
- Watchdog cannot restart scripts with empty code
- Multiple watchdog instances can monitor different scripts
- The watchdog itself should be set to auto-start
- Check Shelly device logs regularly to monitor watchdog activity
