# zendure-shelly-tools

Lately I own a Solar flow 800 Pro.

To use ist without the official App (where an account is needed) I have implemented some usefull scripts to configure
and handle it.

Currently, containing:
- python script to set WIFI config via bluetooth: [config_wifi_via_bluetooth.py](config_wifi_via_bluetooth.py)
- script for shelly 3EM Pro to set limit via rest call directly on to device

**DISCLAIMER (progress at own risk! I can't be liable for any damage you do to the device!)**

## Configure Device via Bluetooth

To use the script configure needed variables: name and ssid of WIFI and Mac address of the device.

The device mac can be cound out by using: "bluetoothctl" and "scan on". After that press the Button on your device
for 3 seconds and wait for the address to show up.

*Hint: sometimes the device changes its bluetooth MAC-Address keep an eye on it.*

### set up tooling
```bash
# init python virtual enviroment
python3 -m venv .venv

#install bleak
./.venv/bin/pip3 install bleak
./.venv/bin/pip3 install python-dotenv
```

### Environment variables
There are to way of set parameter to the script

#### 1. Env variable file
Create .env file like shown in [.env.example](.env.example) and fill in your values.

#### 2.define variable in terminal

Set the these variables to your current context and the script will pick them up.

```bash
export WIFI_SSID="WIFI_NAME"
export WIFI_PASSWORD="WIFI_PASSWORD"
export DEVICE_ADDRESS="AA:BB:CC:DD:EE:FF"
```

### Run the script
Then execute the script and wait for WIFI to be configured. Also you have to press the button on the device for 3 seconds
to set in pairing mode if not the connection will not work.

```bash
./.venv/bin/python3 config_wifi_via_bluetooth.py
```

After that the Device should show up in your WIFI-Network after that you kann use the api to set further data.
Use the official documentation for that: https://github.com/Zendure/zenSDK

## Scripts for Shelly
coming soon