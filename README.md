# zendure-shelly-tools

Automation scripts for controlling the Zendure Solarflow 800 Pro without the official app. This project enables local control via Shelly devices and provides initial WiFi configuration through Bluetooth.

**DISCLAIMER: Progress at your own risk. I cannot be liable for any damage you do to the device.**

## Project Components

This project is organized into five main components:

### [zendure_bluetooth_connect/](zendure_bluetooth_connect/)
Initial WiFi setup for Zendure devices via Bluetooth. Use this for first-time configuration or when changing networks. Includes Python script for configuring WiFi credentials without the official app.

### [zendure_power_control/](zendure_power_control/)
Dynamic power control scripts for Shelly 3EM Pro that adjust Zendure inverter output based on real-time grid measurements. Three variants available for different network configurations:
- Direct IP connection (home WiFi)
- MAC address resolution (Shelly AP mode)
- Automatic network scanning (dynamic discovery)

### [zendure_online_monitoring/](zendure_online_monitoring/)
Online monitoring scripts that send Zendure device data to an external monitoring system for visualization and analysis. Read-only scripts that collect solar power, battery status, and grid data. Three variants available matching the power control configurations.

### [opendtu_power_control/](opendtu_power_control/)
OpenDTU inverter integration script that controls inverter power limits based on Shelly 3EM Pro measurements. Provides dynamic power adjustment for OpenDTU-compatible inverters.

### [shelly_script_checks/](shelly_script_checks/)
Watchdog scripts for monitoring and automatically restarting crashed Shelly scripts. Ensures your automation remains operational by detecting and recovering from script failures.

## Quick Start Workflow

1. **Configure WiFi via Bluetooth**

   Set up your Zendure device on your network using the Bluetooth configuration script.

   See [zendure_bluetooth_connect/README.md](zendure_bluetooth_connect/README.md)

2. **Deploy Power Control Script**

   Choose and configure the appropriate power control script variant for your network setup.

   See [zendure_power_control/README.md](zendure_power_control/README.md)

3. **Optional: Set Up Online Monitoring**

   Send device data to an external monitoring system for visualization and long-term analysis.

   See [zendure_online_monitoring/README.md](zendure_online_monitoring/README.md)

4. **Optional: Set Up Watchdog**

   Add automatic monitoring and restart capability for your scripts.

   See [shelly_script_checks/README.md](shelly_script_checks/README.md)

5. **Optional: Add OpenDTU Control**

   Integrate OpenDTU inverter control if you have an OpenDTU-compatible inverter.

   See [opendtu_power_control/README.md](opendtu_power_control/README.md)

## External Resources

- Zendure SDK Documentation: https://github.com/Zendure/zenSDK
- Official API reference for advanced device control and configuration
