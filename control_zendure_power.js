let HOST = "INSERT ZENDURE DEVICE IP OR HOSTNAME HERE" //could be "zendure" on default
let SERIAL = "INSERT SERIAL FROM DEVICE HERE";
let MAX_POWER = 800;
let DEBUG = false;

//last set power (so it is not requested every time)
let currentZendurePower = null;
let lastRunTime = null;
//current (last) power of shelly, because script run onyl every 5 seconds (more often -> power fluctuates)
let lastShellyPower = null;
//do not allow two execution to the same time
let isRunning = false;
//timer for implementation error (is isRunning stuck on true)
let lastRunningStarted = 0;

function log(message,debug){
    if(!debug || DEBUG){
        print("[" + Shelly.getUptimeMs() + "Zendure Power Script ]: "+message);
    }
}

function getTimeDiff(){
    let localLastRunTime = lastRunTime;
    if(localLastRunTime == null){
        return null;
    }
    let now = Shelly.getUptimeMs();
    return now - localLastRunTime;
}

function setCurrentPower(power){
    currentZendurePower = power;
    if(power != null) {
        lastRunTime = Shelly.getUptimeMs();
    }else{
        lastRunTime = null;
    }
}

function setLimit(shellyPower,currentDevicePower){
    log("Current Zendure power is: " + currentDevicePower + "W", true);

    let combinedLimit = shellyPower + currentDevicePower;
    combinedLimit = Math.max(combinedLimit,0);
    combinedLimit = Math.min(combinedLimit,MAX_POWER);

    log("new Zendure power is: " + combinedLimit + "W",true);

    let payload = {
        sn: SERIAL,
        properties: {
            acMode: 2,
            outputLimit: combinedLimit
        }
    };

    Shelly.call("HTTP.POST", {
        url: "http://" + HOST + "/properties/write",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    }, function(postResult, err_code, err_msg) {
        if (err_code === 0) {
            log("POST erfolgreich:" + postResult.body,true);
            setCurrentPower(combinedLimit);
            log("Set power of Zendure device to: " + combinedLimit,false);
        } else {
            log("Fehler beim POST:" + err_code + " " + err_msg,false);
        }
    });
}

function runScript() {
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
        //set limit to new -> give zendure some time to apply it
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

    let localZendurePower = currentZendurePower;
    if(localZendurePower == null){
        log("Current Zendure power unkonwn -> get it",false);
        Shelly.call("HTTP.GET", { url: "http://" + HOST + "/properties/report" },
            function(result, err_code, err_msg) {
                if (err_code !== 0) {
                    log("Fehler beim GET von Zendure – Abbruch, kein POST:" + err_code + " " + err_msg,false);
                    isRunning = false;
                    return;
                }
                let response = JSON.parse(result.body || "{}");
                if (response.properties && typeof response.properties.outputLimit === "number") {
                    log("Got from response: " + response.properties.outputLimit,true);
                    setLimit(shellyPower,response.properties.outputLimit);
                } else {
                    log("Could not get value from request response",false);
                }
                isRunning = false;
            });
    }else{
        setLimit(shellyPower,localZendurePower);
        isRunning = false;
    }
}

Shelly.addStatusHandler(function (event) {
    if (event.name === "em" && event.delta && typeof event.delta.total_act_power === "number") {
        lastShellyPower = event.delta.total_act_power;
    }
});

//run every 5 seconds
Timer.set(5000, true, runScript, null);

//check if successfully request was send at least in the last 1 minute
Timer.set(1000, true, function (){
    let dif = getTimeDiff();
    if(dif == null){
        return;
    }
    if(dif > 60 * 1000){
        log("Zendure limit to old -> reset (maybe offline)",false);
        //zendure value is to old -> delete
        setCurrentPower(null);
    }
}, null);