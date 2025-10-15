let HOST = "SET_IP_HERE" //use if in home wifi if not leave blank
let MAC = "SET_MAC_HERE" //use if in shelly wifi if not leave blank
let DEBUG = false;
let SERIAL = "DEVICE_SERIAL_HERE";
let MAX_POWER = 800;
let MAX_POWER_REVERSE = -1000;
let REVERSE = true;
let REVERSE_STARTUP_POWER = -10;

let INTERVAL_RESOLVE_MAC = 30;
let INTERVAL_CHECK_ZENDURE_STATUS = 30;
let INTERVAL_DEVICE_OFFLINE = 60;
let INTERVAL_RUN_MAIN_SCRIPT = 5;

let currentZendurePower = null;
let lastRunTime = null;
let lastShellyPower = null;
//dotn allow two execution to the same time
let isRunning = false;
//timer for impelmentaton error (is isRunning stuck on true)
let lastRunningStarted = 0;
let bypass = false;
let soc = 50;
let maxSoc = 100;
let minSoc = 0;

function log(message,debug){
    if(!debug || DEBUG){
        print("[" + Shelly.getUptimeMs() + " Zendure Power Script]: "+message);
    }
}

function getTimeDiff(){
    let localLastRunTime = lastRunTime;
    if(localLastRunTime == null){
        return null;
    }
    let now = Shelly.getUptimeMs();
    let dif = now - localLastRunTime;
    return dif;
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

    let acMode = 2;
    let inputLimit = 0;
    let outputLimit = 0;

    let combinedLimit = shellyPower + currentDevicePower;

    if(currentDevicePower >= 0 && combinedLimit > REVERSE_STARTUP_POWER && combinedLimit < 0){
        combinedLimit = 0;//set to zero so no wabbling appears
    }

    if(bypass == true){
        log("Do not set real limit bypass is enabled",true);
        combinedLimit = shellyPower;
    }

    if(!REVERSE || combinedLimit >= 0){
        outputLimit = Math.max(combinedLimit,0);
        outputLimit = Math.min(outputLimit,MAX_POWER);
    }else{
        acMode = 1;
        inputLimit = Math.max(combinedLimit,MAX_POWER_REVERSE);
        inputLimit *= -1;
    }

    combinedLimit = (inputLimit * -1) + outputLimit;
    log("new Zendure power is: " + combinedLimit + "W",false);

    let payload = {
        sn: SERIAL,
        properties: {
            acMode: acMode,
            outputLimit: outputLimit,
            inputLimit: inputLimit,
        }
    };

    log("Send POST data:" + JSON.stringify(payload),false);
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
    if(typeof HOST !== 'string' || HOST == ""){
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
        //set limit to new -> give zendure some time to apply it
        log("Skipped execution last set power to new: " + diff,true);
        isRunning = false;
        return
    }

    if(Math.abs(shellyPower) < 5 || (currentZendurePower >= 0 && shellyPower < 0 && shellyPower > REVERSE_STARTUP_POWER)){
        log("current power is fine",true);

        if(diff == null || diff > 20 * 1000){
            log("Limit not set int a wile -> do anyway",true);
        }else{
            isRunning = false;
            return;
        }
    }

    let localZendurePower = currentZendurePower;
    if(localZendurePower == null || soc-2 < minSoc || soc+2 > maxSoc){//soc check need for extra fetch bypass status
        if(localZendurePower == null){
            log("Current Zendure power unkonwn -> get it",false);
        }else{
            log("Fetch current zendure powe because near min or max level (bypass status needed)",true);
        }
        Shelly.call("HTTP.GET", { url: "http://" + HOST + "/properties/report" },
            function(result, err_code, err_msg) {
                if (err_code !== 0) {
                    log("Fehler beim GET von Zendure – Abbruch, kein POST:" + err_code + " " + err_msg,false);
                    isRunning = false;
                    return;
                }
                let response = JSON.parse(result.body || "{}");
                if (response.properties) {
                    let gotLimit = 0;
                    if(response.properties.acMode == 2){
                        gotLimit = response.properties.outputLimit;
                    }else{
                        gotLimit = response.properties.inputLimit * -1;
                    }
                    bypass = response.properties.packState == 0;
                    soc = response.properties.electricLevel;
                    maxSoc = response.properties.socSet / 10;
                    minSoc = response.properties.minSoc / 10;
                    log("Got from response: " + gotLimit,true);
                    setLimit(shellyPower,gotLimit);
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

//run adjustment every 5 seconds
Timer.set(INTERVAL_RUN_MAIN_SCRIPT * 1000, true, runScript, null);

//check if successfull reqeust was send at least in the last 1 minute
Timer.set(5000, true, function (){
    let dif = getTimeDiff();
    if(dif == null){
        return;
    }
    if(dif > INTERVAL_DEVICE_OFFLINE * 1000){
        log("Zendure limit to old -> reset (maybe offline)",false);
        //zendure value is to old -> delete
        setCurrentPower(null);
    }
}, null);

//check pack state and other statistics
Timer.set(INTERVAL_CHECK_ZENDURE_STATUS * 1000, true, function (){
    log("Timed Check Zendure -> check status",false);
    if(typeof HOST !== 'string' || HOST == ""){
        log("Timed Check Zendure -> Hostname or ip not set",false);
        return;
    }
    Shelly.call("HTTP.GET", { url: "http://" + HOST + "/properties/report" },
        function(result, err_code, err_msg) {
            if (err_code === 0) {
                //log("Timed Check Zendure -> successfull:" + result.body,true);
                let response = JSON.parse(result.body || "{}");
                if (response.properties) {
                    bypass = response.properties.packState == 0;
                    soc = response.properties.electricLevel;
                    maxSoc = response.properties.socSet / 10;
                    minSoc = response.properties.minSoc / 10;
                    log("Timed Check Zendure -> bypass is: " + bypass,true);
                }else{
                    log("Timed Check Zendure -> could not parse json response: " + bypass,false);
                }
            } else {
                log("Timed Check Zendure -> error: " + err_code + " " + err_msg,false);
            }
        }
    );
}, null);

// Funktion: prüfe Clients nach MAC-Adresse
function resolveMacToIp() {
    Shelly.call("WiFi.ListAPClients", {}, function(res, err) {
        if (err !== 0) {
            log("Mac Resolving -> Fehler bei WiFi.ListAPClients: Fehlercode " + err,false);
            return;
        }
        if (!res || !res.ap_clients) {
            log("Mac Resolving -> No clients available",true);
            return;
        }
        for (let c of res.ap_clients) {
            let mac = (c.mac || "").toUpperCase();
            log("Mac Resolving -> Check‑Device with mac: " + mac + " IP: " + c.ip,true);
            if (mac === MAC.toUpperCase()) {
                print("Mac Resolving -> Device‑MAC found: " + mac + " IP: " + c.ip);
                HOST = c.ip;
                return;  // wenn gefunden, beende die Schleife (oder setze fort, falls mehrere)
            }
        }
        log("Mac Resolving -> MAC-Adress: " + MAC + "could not be resolved",true);
    });
}

if(typeof MAC == 'string' && MAC != ""){
    log("Timed Check Zendure -> Hostname or ip not set",false);
    Timer.set(INTERVAL_RESOLVE_MAC * 1000, true, resolveMacToIp);
}