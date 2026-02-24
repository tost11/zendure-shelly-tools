// controls zendure power station with ip connection with values EM3 Shell values, zendure device ip or hostname is configured in variable

// hostname or ip where device is reachable
let HOST = undefined;//TODO ip hor host here
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

let lastRunTime = null;
let lastShellyPower = null;
let isRunning = false;
let lastRunningStarted = 0;
let lastSeenDevice = Shelly.getUptimeMs();

if(!SERIAL){
    throw new Error("Variable: SERIAL is required");
}
if(!HOST){
    throw new Error("Variable: HOST is required");
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
        url: "http://" + HOST + "/properties/write",
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
    if(typeof HOST !== 'string' || HOST === ""){
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

    Shelly.call("HTTP.GET", { url: "http://" + HOST + "/properties/report" }, function(result, err_code, err_msg) {
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