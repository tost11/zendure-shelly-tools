import asyncio
import random
import string
import json
import os
import sys
import time
from bleak import BleakClient
from dotenv import load_dotenv

load_dotenv()

def generate_random_token(length=16):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=length))

device_address = os.getenv("DEVICE_ADDRESS")
ssid = os.getenv("WIFI_SSID")
password = os.getenv("WIFI_PASSWORD")

missing = []
if not device_address:
    missing.append("DEVICE_ADDRESS")
if not ssid:
    missing.append("WIFI_SSID")
if not password:
    missing.append("WIFI_PASSWORD")

if missing:
    print(f"Error: missing environment variables: {', '.join(missing)}")
    sys.exit(1)

json_data = {
    "AM": 3,
    #this can also be set but i not know why (can also be configured via REST api afterwards)
    #"iotUrl": "mqttteu.zen-iot.com",
    "messageId": 1002,
    "method": "token",
    "password": password,
    "ssid": ssid,
    "timeZone": "GMT+08:00",
    "token": generate_random_token()
}

json_string = json.dumps(json_data)
payload = json_string.encode("utf-8")

# UUID of Write-Characteristic
CHARACTERISTIC_UUID = "0000c304-0000-1000-8000-00805f9b34fb"

print(f"Try to connect to device: {device_address} and configure ssid: {ssid}")

# retry connection for max. 60 seconds
async def connect_with_timeout(address, timeout=60):
    start_time = time.time()
    while True:
        try:
            client = BleakClient(address)
            await client.connect()
            if client.is_connected:
                print(f"connected to device: {address}")
                return client
        except Exception as e:
            print(f"connect failed: {e}")

        if time.time() - start_time > timeout:
            print("could not connect ot device within 60 seconds -> exit")
            return None

        print("new connection attempt in 3 seconds...")
        await asyncio.sleep(3)

async def send_payload(address, char_uuid, data):
    client = await connect_with_timeout(address, timeout=60)
    if client is None:
        return

    try:
        print(f"send command")
        await client.write_gatt_char(char_uuid, data, response=True)
        print("command send successful.")
    finally:
        await client.disconnect()
        print("disconnected")

asyncio.run(send_payload(device_address, CHARACTERISTIC_UUID, payload))