# Zendure Bluetooth WiFi Configuration

For project overview, see the [main README](../README.md)

## Overview

This Python script configures the WiFi settings of your Zendure Solarflow 800 Pro via Bluetooth, enabling you to connect the device to your network without using the official app.

## Prerequisites

- Python 3.x installed
- Bluetooth capability on your computer
- Zendure device in pairing mode
- Device MAC address (discoverable via Bluetooth scan)

## Finding Device MAC Address

Use `bluetoothctl` to discover your device:

```bash
bluetoothctl
scan on
```

Press the button on your Zendure device for 3 seconds to enable pairing mode. Wait for the device address to appear in the scan results.

**Note:** The device may change its Bluetooth MAC address. If connection fails, rescan to verify the current address.

## Python Environment Setup

Create and activate a virtual environment:

```bash
# Create virtual environment
python3 -m venv .venv

# Activate (Linux/Mac)
source .venv/bin/activate

# Activate (Windows)
.venv\Scripts\activate

# Install dependencies
pip install bleak python-dotenv
```

## Configuration

### Method 1: .env File

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```
WIFI_SSID="YOUR_WIFI_NAME"
WIFI_PASSWORD="YOUR_WIFI_PASSWORD"
DEVICE_ADDRESS="AA:BB:CC:DD:EE:FF"
```

### Method 2: Environment Variables

Set variables in your terminal:

```bash
export WIFI_SSID="YOUR_WIFI_NAME"
export WIFI_PASSWORD="YOUR_WIFI_PASSWORD"
export DEVICE_ADDRESS="AA:BB:CC:DD:EE:FF"
```

## Running the Script

1. Put the device in pairing mode (press button for 3 seconds)
2. Run the script:

```bash
python3 config_wifi_via_bluetooth.py
```

3. Wait for the confirmation message

## Next Steps

After successful WiFi configuration:

1. Verify the device appears on your network (check DHCP leases in your router)
2. Note the device's IP address for Shelly script configuration
3. Deploy Shelly power control scripts - see [zendure_power_control/README.md](../zendure_power_control/README.md)
4. Use the Zendure SDK for additional API operations: https://github.com/Zendure/zenSDK

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Connection timeout | Ensure device is in pairing mode (button pressed 3 seconds) |
| MAC address not found | Rescan with bluetoothctl - MAC may have changed |
| WiFi connection fails | Verify credentials and ensure 2.4GHz network (5GHz not supported) |
| Script errors | Check Python version (3.7+) and verify dependencies installed |
