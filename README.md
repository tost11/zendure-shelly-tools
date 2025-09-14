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

To run the Scripts copy them into Shelly script page, start them and enable automatic run on restart of shelly

### Power Script

The power script is: [check_script_running.js](check_script_running.js)

It checks the current power of the shelly and compaers it with the pwoer of the zendure device. After that the new value
is applied via rest to the device.

Edit variables (written in caps) on beginning of script to fit your own setup.

#### Variables

| Column 1  | Column 2                                 |
|-----------|------------------------------------------|
| HOST      | Host or                                  |
| SERIAL    | SN of Zendure Device                     |
| MAX_POWER | Maximum power to apply to Zendure device |
| DEBUG     | print debug messages                     |

#### Additional feature
- Requests current value of Zendure device only when needed (to old)
- power change under 5w is ignored
- sends value only every 5 seconds, more often leads into fluctuation (maby more often will work, check for yourself)
- concurrency is checked, only one process runs at on time
- check if it stuck by itself (for maybe done implementation error)

### Restart script

The check other script script is: [check_script_running.js](check_script_running.js)

If an unhandled error in the previous script appears, it will not continue applying power, so the next script if it
is not running and restart it if so.

#### Variables

| Column 1           | Column 2                                         |
|--------------------|--------------------------------------------------|
| TARGET_SCRIPT_NAME | Name of the Zendure power script                 |
| CHECK_INTERVAL_MS  | Time in Milliseconds until nex check is performed |
| DEBUG              | print debug messages                             |

