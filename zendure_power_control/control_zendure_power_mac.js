// controls zendure power station with ip connection with values EM3 Shell values, zendure device is found while checking client connected to shelly ap (only working if ap used as range extender)

// hostname or ip where device is reachable
let MAC = undefined;//TODO enter mac here (AA:BB:CC:DD:EE:FF)
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
// interval in seconds mac to ip resolving ist started
let INTERVAL_RESOLVE_MAC = 5 * 60;//every 5 min

let lastRunTime = null;
let lastShellyPower = null;
let isRunning = false;
let lastRunningStarted = 0;
let lastSeenDevice = Shelly.getUptimeMs();
let host = undefined;

if(!SERIAL){
    throw new Error("Variable: SERIAL is required");
}
if(!MAC){
    throw new Error("Variable: MAC is required");
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

    if(REVERSE && currentDevicePower > 0 && combinedLimit > (REVERSE_STARTUP_POWER * -1) && combinedLimit < 0){
        //to not drectly swap from input to ouptu mode step with zero
        combinedLimit = 0;
    }

    if(currentDevicePower < 0 && combinedLimit > STARTUP_POWER && combinedLimit > 0){
        //to not drectly swap from input to ouptu mode step with zero
        combinedLimit = 0;
    }

    if(currentDevicePower === 0 && combinedLimit > 0 && combinedLimit <= STARTUP_POWER){
        combinedLimit = 0;
    }

    if(REVERSE && currentDevicePower === 0 && combinedLimit <0 && combinedLimit >= (REVERSE_STARTUP_POWER * -1)){
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
        log("Timed Check Zendure -> Hostname or ip not set",false);
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
            let gotLimit;
            if(response.properties.acMode === 2){
                //gotLimit = response.properties.outputLimit;
                gotLimit = response.properties.outputHomePower;
            }else{
                //gotLimit = response.properties.inputLimit * -1;
                gotLimit = response.properties.gridInputPower * -1;
            }
            log("Got from response: " + gotLimit,true);
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


// -------------------- mac resolving ---------------------


function resolveMacToIp() {
    Shelly.call("WiFi.ListAPClients", {}, function(res, err) {
        if (err !== 0) {
            log(`Mac Resolving -> error while WiFi.ListAPClients: ${err}`, false);
            return;
        }

        if (!res || !res.ap_clients) {
            log("Mac Resolving -> No clients available", true);
            return;
        }

        for (let c of res.ap_clients) {
            let mac = (c.mac || "").toUpperCase();
            log("Found device, mac: " + c.mac + " ip: " + c.ip,true);

            if (mac === MAC.toUpperCase()) {
                log("Ip for device found: "+ c.ip,false);
                host = c.ip;
                return;
            }
        }

        log(`Mac Resolving -> MAC Address: ${MAC} could not be resolved`, true);
    });
}

//scheduled mac resolution
Timer.set(INTERVAL_RESOLVE_MAC * 1000, true, resolveMacToIp);
//start mac resolution
Timer.set(1, false, resolveMacToIp);