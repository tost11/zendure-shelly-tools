// controls zendure power station with ip connection with values EM3 Shell values, zendure device is found with network scanning

// power station serial number
let SERIAL = undefined;//TODO enter serial here
// max power in watt giving to grid
let MAX_POWER = 800;
// max power in watt loading from grid
let MAX_POWER_REVERSE = 1000;
// loading from grid is enabled (another inverter in home network)
let REVERSE = false;
// power in watt when lading from gid is started
let REVERSE_STARTUP_POWER = 30;
// power in watt when lading from gid is stopped
let REVERSE_STOP_POWER = 10;
// power in watt when inverting is started
let STARTUP_POWER = 30;
// power in watt when inverting is stopped
let STOP_POWER = 15;
// console shows debug information while script is running
let DEBUG = false;
// interval in seconds main power script is run (5 sec seems to be a good value)
let INTERVAL_RUN_MAIN_SCRIPT = 5;
// time in seconds when power station is assumed offline (no response from requests)
let INTERVAL_DEVICE_OFFLINE = 60 * 10;//offline after 10 minutes
// interval in seconds search for power station in network
let INTERVAL_SCAN_NETWORK = 15 * 60;//scan every 15 min
// scan wifi ap network for power station
var CHECK_WIFI_AP = true;
// scan wifi sta network for power station
var CHECK_WIFI_STA = true;
//scan ethernet network for power station
var CHECK_ETH = true

let lastRunTime = null;
let lastShellyPower = null;
let isRunning = false;
let lastRunningStarted = 0;
let scanRunning = false;
let lastSeenDevice = null;
let host = null;

if(!SERIAL){
    throw new Error("Variable: SERIAL is required");
}

function isDeviceReachable(){
    if(!lastSeenDevice){
        return false;
    }
    return Shelly.getUptimeMs() - lastSeenDevice < INTERVAL_DEVICE_OFFLINE * 1000;
}

function log(message,debug){
    if(!debug || DEBUG){
        print("[" + Shelly.getUptimeMs() + " Zendure Power Script]: "+message);
    }
}

if(REVERSE_STOP_POWER > REVERSE_STARTUP_POWER){
    log("REVERSE_STOP_POWER larger then REVERSE_STARTUP_POWER set both to: "+REVERSE_STARTUP_POWER);
    REVERSE_STOP_POWER = REVERSE_STARTUP_POWER;
}
if(STOP_POWER > STARTUP_POWER){
    log("STOP_POWER larger then STARTUP_POWER set both to: "+STARTUP_POWER);
    STOP_POWER = STARTUP_POWER;
}

function getTimeDiff(){
    let localLastRunTime = lastRunTime;
    if(localLastRunTime == null){
        return null;
    }
    let now = Shelly.getUptimeMs();
    return now - localLastRunTime;
}

function setLimit(shellyPower,currentDevicePower){
    log("Current Zendure power is: " + currentDevicePower + "W", true);

    let acMode = 2;
    let inputLimit = 0;
    let outputLimit = 0;

    let combinedLimit = shellyPower + currentDevicePower;

    log("Combined limit is: " + combinedLimit + "W", true);

    if(currentDevicePower <= 0 && combinedLimit > 0 && combinedLimit <= STARTUP_POWER){
        //not enoth to start up
        combinedLimit = 0;
    }

    if(REVERSE && currentDevicePower >= 0 && combinedLimit < 0 && combinedLimit >= (REVERSE_STARTUP_POWER * -1)){
        //no enoth to start up
        combinedLimit = 0;
    }

    if(!REVERSE || combinedLimit >= 0){
        outputLimit = Math.max(combinedLimit,0);
        outputLimit = Math.min(outputLimit,MAX_POWER);
        if(outputLimit >= 0 && outputLimit <= STOP_POWER){
            outputLimit = 0;
        }
    }else{
        acMode = 1;
        inputLimit = Math.max(combinedLimit,MAX_POWER_REVERSE * -1);
        inputLimit *= -1;
        if(inputLimit >= 0 && inputLimit <= REVERSE_STOP_POWER){
            inputLimit = 0;
        }
    }
    combinedLimit = (inputLimit * -1) + outputLimit;
    log("new Zendure power is: " + combinedLimit + "W",false);

    let payload = {
        sn: SERIAL,
        properties: {
            acMode: acMode,
            outputLimit: outputLimit,
            inputLimit: inputLimit
        }
    };

    log("Send POST data:" + JSON.stringify(payload),false);
    Shelly.call("http.request", {
        method: "POST",
        url: "http://" + host + "/properties/write",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        timeout: 5
    }, function(postResult, err_code, err_msg) {
        log("ret code: " + err_code,false);
        if (err_code === 0) {
            if (postResult.code === 200) {
                log("POST erfolgreich:" + postResult.body,true);
                lastRunTime = Shelly.getUptimeMs();
                log("Set power of Zendure device to: " + combinedLimit,false);
            }else{
                log("Fehler beim POST:" + err_code + " " + err_msg + " " + postResult.body,false);
            }
        } else {
            log("Fehler beim POST:" + err_code + " " + err_msg,false);
            if(err_code === -114){
                log("This can happend if Serial number is not matching device ",false);
            }
        }
    });
}

function runScript() {
    if(typeof host !== 'string' || host === ""){
        log("Main script no run -> Hostname or ip not set, scanning?: " + scanRunning,false);
        return;
    }

    if(isRunning && Shelly.getUptimeMs() - lastRunningStarted < 60 * 1000){
        log("Skipped execution still one running: " + (Shelly.getUptimeMs() - lastRunningStarted),false);
        return;
    }

    lastRunningStarted = Shelly.getUptimeMs();
    isRunning = true;

    let shellyPower = lastShellyPower;
    if(shellyPower == null){
        isRunning = false;
        return;
    }

    log("Current Shelly power:" + shellyPower + "W",true);

    let diff = getTimeDiff();
    if(diff != null && diff < 2 * 1000){
        log("Skipped execution last set power to new: " + diff,true);
        isRunning = false;
        return
    }

    if(Math.abs(shellyPower) < 5){
        log("current power is fine",true);

        if(diff == null || diff > 20 * 1000){
            log("Limit not set int a wile -> do anyway",true);
        }else{
            isRunning = false;
            return;
        }
    }

    Shelly.call("HTTP.GET", { url: "http://" + host + "/properties/report" }, function(result, err_code, err_msg) {
        if (err_code !== 0 || result.code !== 200 || !result.body) {
            log("error while getting status of power station, no post performed: " + err_code + " " + err_msg,false);
            isRunning = false;
            return;
        }
        let response;
        try {
            response = JSON.parse(result.body);
        } catch (e) {
            log("Error while parsing json from device status response" + err_code + " " + err_msg,false);
            isRunning = false;
            return;
        }
        if (response.properties && response.properties && response.product && response.sn === SERIAL) {
            lastSeenDevice = Shelly.getUptimeMs();
            let gotLimit = 0;
            log("got response, acMode: " + response.properties.acMode +", outputHome: " + response.properties.outputHomePower + ", inputHomePower: " + response.properties.gridInputPower,true);
            if(response.properties.acMode === 2){
                //gotLimit = response.properties.outputLimit;
                gotLimit = response.properties.outputHomePower;
            }else if(response.properties.acMode === 1){
                //gotLimit = response.properties.inputLimit * -1;
                gotLimit = response.properties.gridInputPower * -1;
            }
            setLimit(shellyPower,gotLimit);
        } else {
            log("Could not get value from request response (maybe it is not a zendure response or Serial (SN) is wrong)",false);
            log("Response: "+response,true);
        }
        isRunning = false;
    });
}

Shelly.addStatusHandler(function (event) {
    if (event.name === "em" && event.delta && typeof event.delta.total_act_power === "number") {
        lastShellyPower = event.delta.total_act_power;
    }
});

Timer.set(INTERVAL_RUN_MAIN_SCRIPT * 1000, true, runScript, null);

// -------------------- find device in network -------------------------------

var networks = [];
var currentTimeout = 1;

// Function to perform a network scan and look for the Zendure device
function scanForZendureDevice(i,networkId) {

    if(isDeviceReachable()){
        //device reconnected stop scan
        log("Device reconnected -> stop network scanning",false);
        currentTimeout = 1;
        scanRunning = false;
        return;
    }

    if (i > 255) {
        i=0
        networkId++
    }

    if(networkId >= networks.length){
        log("All networks scanned with timeout: " + currentTimeout + " -> increase Timeout",false);
        if(currentTimeout === 1){
            currentTimeout = 2;
            log("new scn itteration wiht timeout: " + currentTimeout,false);
            Timer.set(1, false, function(){scanForZendureDevice(1,0)}, null);
        }else if(currentTimeout === 2){
            currentTimeout = 5;
            log("new scn itteration wiht timeout: " + currentTimeout,false);
            Timer.set(1, false, function(){scanForZendureDevice(1,0)}, null);
        }else{
            log("Network scann ended without result -.-",false);
            currentTimeout = 1;
            scanRunning = false;
        }
        return
    }

    var ipBase = networks[networkId];
    var ip = ipBase + i;
    var url = "http://" + ip + "/properties/report"; // Assuming the device's API endpoint

    log("check ip for zendure: "+ip,true);
    Shelly.call("HTTP.GET", { url: url , timeout: currentTimeout}, function(result, err_code, err_msg) {
        if (err_code === 0) { // HTTP request was successful
            // Check for HTTP status code 200
            log("Recived http response: "+result.code, true);
            if (result.code === 200 && result.body) {
                try {
                    var deviceInfo = JSON.parse(result.body); // Parse the JSON response

                    // Check if the serial number matches the target
                    if (deviceInfo && deviceInfo.properties && deviceInfo.product && deviceInfo.sn === SERIAL) {
                        // If the serial number matches, log the internal IP and hostname
                        log("Device found with ip: " + ip,false);
                        Script.storage.setItem("deviceIp",ip);
                        host = ip;
                        scanRunning = false;
                        return;
                    }
                } catch (e) {
                    log("Error parsing response from IP: " + ip, true); // Log if JSON parsing fails
                }
            } else {
                log("Received non-200 status code (" + result.status + ") from IP or body is empty: " + ip, true);
            }
        } else {
            log("HTTP request error (" + err_code + "): " + err_msg + " from IP: " + ip, true);
        }

        Timer.set(1, false, function(){scanForZendureDevice(i + 1,networkId)}, null);
    });
}

function parseIp(ip){
    if(!ip && ip.length <= 0){
        return null;
    }
    let lastDotPos = ip.indexOf('.', ip.indexOf('.') + 1);

    while (lastDotPos !== -1) {
        let nextDotPos = ip.indexOf('.', lastDotPos + 1);
        if (nextDotPos === -1) break;
        lastDotPos = nextDotPos;
    }

    return ip.slice(0, lastDotPos+1);
}

function getWifiStaIp(){
    if(!CHECK_WIFI_STA){
        scanForZendureDevice(1,0);
        return;
    }
    log("Check ip for WiFi sta Mode",true);
    Shelly.call("WiFi.GetStatus",{}, function(result, err_code, err_msg) {
        if(err_code === 0 && result.sta_ip){
            log("sta mode-> found ip: " + result.sta_ip,true);
            networks.push(parseIp(result.sta_ip));//todo subnets (if possible)
        }else{
            log("sta mode-> not connected or configured incorrect",true);
        }
        //scanForZendureDevice(1,0);
        log("Networks to scann for devices: " + networks,false);
        scanForZendureDevice(1,0);
    });
}

function getWifiApIp(){
    if(!CHECK_WIFI_AP){
        getWifiStaIp();
        return;
    }
    log("Check ip for WiFi ap Mode",true);
    Shelly.call("WiFi.GetConfig",{}, function(result, err_code, err_msg) {
        if(err_code === 0 && result.ap && result.ap.enable){
            log("sta mode-> default ip: 192.168.33.1",true);
            networks.push("192.168.33.");
        }else{
            log("ap not enabled",true);
        }
        getWifiStaIp();
    });
}

function getEthernetIp(){
    if(!CHECK_ETH){
        getWifiApIp();
        return;
    }
    log("Check Ethernet",true);
    Shelly.call("Eth.GetConfig",{}, function(result, err_code, err_msg) {
        if(err_code === 0 && result.enable === true){
            if(result.server_mode && result.ip){
                log("eth-> in server mode ip: " + result.ip,true);
                networks.push(parseIp(result.ip));//todo subnet
                getWifiApIp();
            }else{
                Shelly.call("Ethernet.GetStatus",{}, function(result, err_code, err_msg) {
                    if(err_code === 0 && result.ip){
                        log("eth-> cient mode ip: " + result.sta_ip,true);
                        networks.push(parseIp(result.ip));
                    }else{
                        log("eth-> cient mode not connected",true);
                    }
                    getWifiApIp();
                });
            }
        }else{
            log("eth-> not enabled",true);
            getWifiApIp();
        }
    });
}

function startFindingDevice(){
    if(isDeviceReachable()){
        log("scanning not needed device is reachable -> do not start",true);
        return;
    }else{
        log("Device ip known but not seen in time: " + ((Shelly.getUptimeMs() - lastSeenDevice)/1000) + "s",true);
    }
    if(scanRunning){
        log("Scanning for zendure device already running -> do not start",true);
        return;
    }
    scanRunning = true;
    log("Device ip unknown or not reachable start search",false);
    networks = [];
    getEthernetIp();
}

function loadIpFromStorage(){
    const deviceIp = Script.storage.getItem("deviceIp");
    if(deviceIp){
        log("Loaded ip from storrage: "+deviceIp,false);
        host = deviceIp;
        //wait 30 sec to check if ip still valid to start first execution of finding device
        Timer.set(1000 * 30, false, startFindingDevice, null);
    }else{
        log("Device ip not found in storrage start search imediatly",false);
        //no ip from last run start finding instantly
        Timer.set(1, false, startFindingDevice, null);
    }
}

//on run periodically
Timer.set(INTERVAL_SCAN_NETWORK * 1000, true, startFindingDevice, null);
//on startup
Timer.set(1, false, loadIpFromStorage, null);