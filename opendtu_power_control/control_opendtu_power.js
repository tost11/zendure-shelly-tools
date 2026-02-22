// OpenDTU Power Control Script (Test Version)
// Adjusts OpenDTU inverter power limit based on Shelly EM3 measurements

// ==================== CONFIGURATION ====================
// User must configure these parameters:

// OpenDTU connection (use either HOST or MAC)
let HOST = "192.168.178.2";               // IP address or hostname of OpenDTU (leave empty if using MAC)
let MAC = "";                             // MAC address for auto-resolution (only for Shelly AP mode)
let PORT = 80;                           // Port (usually 80)
let AUTH_PASSWORD = "openDTU42";          // Admin password (if authentication is enabled)

// Inverter configuration
let INVERTER_SERIAL = "1234567890";        // Serial number of the inverter
let INVERTER_MANUFACTURER = "Hoymiles";    // Manufacturer name (e.g., "Hoymiles", "DeyeSun", "HoymilesW") only needed if on fork https://github.com/tost11/OpenDTU-Push-Rest-API-and-Deye-Sun
let MAX_INVERTER_POWER = 600;             // Maximum inverter power in watts (on some serial total power not save determined so set here manually)
let MAX_LIMIT_WATT = 200;                 // Maximum limit in watts (can be less than max power)
let MIN_LIMIT_PERCENTAGE = 0;             // Min percentage limit send to device (some device handle 0% as 100% so min there neets to be 1%)
let TIMEOUT_RESEND_LIMIT = 30;            // Serial number of the inverter in seconds
let TIMEOUT_DEVICE_UNREACHABLE = 95;      // Timout when inverter is recognieced as unreachable and no more requests send in seconds

// Control parameters advanced (normaly no change needed)
let DEBUG = true;                         // Enable debug logging
let INTERVAL_RUN_MAIN_SCRIPT = 5;         // Main loop interval in seconds
let INTERVAL_RESOLVE_MAC = 60;            // MAC resolution interval in seconds (if using MAC) in seconds
let INTERVAL_FETCH_CURRENT_LIMIT = 15;    // Interval when status fetch of inverter is checked in seconds
let INPUT_DEVIDER = 1;                    // for inverter with mutiple solar inputs where not all are used the limit have to set to double value for example for 2T with only one connected the value is 1/2 = 0.5, for 4T with one input it is: 1/4 = 0.25 and so on. 1 is default for all inputs used. not needed if inverter has firmware dynamic input limitation (set to 1).

// ==================== SCRIPT STATE ====================
let currentInverterPower = null;             // Current inverter power in watts
let lastRunTime = null;                      // Last time limit was set
let lastShellyPower = null;                  // Last measured Shelly power
let isRunning = false;                    // Prevents concurrent executions
let lastRunningStarted = 0;               // Timestamp of last script start
let lastSuccesfullSet = Shelly.getUptimeMs();

// Build authentication header if password is set
let authHeader = "";
if (AUTH_PASSWORD !== "") {
    let credentials = btoa("admin:" + AUTH_PASSWORD);
    authHeader = "Basic " + credentials;
}

// ==================== HELPER FUNCTIONS ====================

function log(message, debug) {
    if (!debug || DEBUG) {
        print("[" + Shelly.getUptimeMs() + " OpenDTU Power Script]: " + message);
    }
}

function getTimeDiff() {
    let localLastRunTime = lastRunTime;
    if (localLastRunTime == null) {
        return null;
    }
    let now = Shelly.getUptimeMs();
    let dif = now - localLastRunTime;
    return dif;
}

function setCurrentPower(power) {
    currentInverterPower = power;
    if (power != null) {
        lastRunTime = Shelly.getUptimeMs();
    } else {
        lastRunTime = null;
    }
}

// ==================== MAIN LIMIT CONTROL ====================

function setLimit(shellyPower, currentDevicePower) {
    log("Current inverter power: " + currentDevicePower + "W", true);
    log("Current Shelly power: " + shellyPower + "W", true);

    // Calculate combined limit (what we want the inverter to output)
    let combinedLimit = shellyPower + (currentDevicePower * INPUT_DEVIDER);

    combinedLimit = combinedLimit / INPUT_DEVIDER;

    // Clamp to valid range
    let outputLimit = Math.max(combinedLimit, 0);
    outputLimit = Math.min(outputLimit, MAX_LIMIT_WATT);

    // Convert watt to percentage
    let percentage = Math.round((outputLimit / MAX_INVERTER_POWER) * 100);
    percentage = Math.max(MIN_LIMIT_PERCENTAGE, Math.min(100, percentage)); // Clamp to 0-100%

    log("New inverter limit: " + outputLimit + "W (" + percentage + "%)", true);

    // Prepare POST data
    let postData = {
        serial: INVERTER_SERIAL,
        limit_value: percentage,
        limit_type: 3
    };

    // Only add manufacturer if it's not empty
    if (INVERTER_MANUFACTURER !== "") {
        postData.manufacturer = INVERTER_MANUFACTURER;
    }

    log("Sending POST to OpenDTU: " + JSON.stringify(postData), true);

    let boundary = "----shellyformboundary";

    // Multipart-Body erzeugen
    let body =
        "--" + boundary + "\r\n" +
        'Content-Disposition: form-data; name="data"\r\n\r\n' +
        JSON.stringify(postData) + "\r\n" +
        "--" + boundary + "--\r\n";

    Shelly.call("http.request", {
        method: "POST",
        url: "http://" + HOST + ":" + PORT + "/api/limit/config",
        headers: {
            "Content-Type": "multipart/form-data; boundary=" + boundary,
            "Authorization": authHeader
        },
        body: body,
        timeout: 5
    }, function (res, err_code, err_msg) {

        if (err_code !== 0) {
            log("HTTP error: " + err_code + " " + err_msg, false);
            return;
        }

        log("HTTP status: " + res.code, true);

        if (res.code === 200) {
            log("POST successful: " + res.body, true);
            setCurrentPower(outputLimit);
            log("Set inverter power to: " + outputLimit + "W (" + percentage + "%)", false);

            if(INPUT_DEVIDER != 1){
                log("Meaning with devider set to: " + (outputLimit * INPUT_DEVIDER) + "W ", false);
            }
        } else {
            log("POST failed: " + res.code + " " + res.body, false);
        }
    });
}

// ==================== MAIN SCRIPT LOOP ====================

function runScript() {
    if (typeof HOST !== 'string' || HOST === "") {
        log("HOST not configured", false);
        return;
    }

    // Prevent concurrent executions
    if (isRunning && Shelly.getUptimeMs() - lastRunningStarted < 60 * 1000) {
        log("Skipping execution, still running: " + (Shelly.getUptimeMs() - lastRunningStarted) + "ms", false);
        return;
    }

    lastRunningStarted = Shelly.getUptimeMs();
    isRunning = true;

    let shellyPower = lastShellyPower;
    if (shellyPower == null) {
        log("No Shelly power data available yet", true);
        isRunning = false;
        return;
    }

    log("Current Shelly power: " + shellyPower + "W", true);

    // Check if enough time has passed since last update
    let diff = getTimeDiff();
    if (diff != null && diff < 2 * 1000) {
        log("Skipping execution, too soon since last update: " + diff + "ms", true);
        isRunning = false;
        return;
    }

    // Check if power adjustment is needed
    if (Math.abs(shellyPower) < 5) {
        log("Current power is acceptable, no adjustment needed", true);

        // But update anyway if it's been a while
        if (diff == null || diff > TIMEOUT_RESEND_LIMIT * 1000) {
            log("Limit not set in a while, updating anyway", true);
        } else {
            isRunning = false;
            return;
        }
    }

    // Set the limit
    localInverterPower = currentInverterPower;
    if (localInverterPower == null || Shelly.getUptimeMs() - lastSuccesfullSet > TIMEOUT_DEVICE_UNREACHABLE * 1000) {
        log("Current inverter power unknown, no limit set, weit to be fetched first", false);
        isRunning = false;
        return;
    }

    setLimit(shellyPower, localInverterPower);
    isRunning = false;
}

// ==================== EVENT HANDLERS ====================

// Listen to Shelly EM power updates
Shelly.addStatusHandler(function (event) {
    if (event.name === "em" && event.delta && typeof event.delta.total_act_power === "number") {
        lastShellyPower = event.delta.total_act_power;
        log("Shelly power updated: " + lastShellyPower + "W", true);
    }

    //lastShellyPower = (Math.random() - 0.5 ) * 100;
    //log("fake power: " + lastShellyPower, false);
});

// ==================== MAC RESOLUTION ====================

// Resolve MAC address to IP (for Shelly AP mode)
function resolveMacToIp() {
    Shelly.call("WiFi.ListAPClients", {}, function(res, err) {
        if (err !== 0) {
            log("MAC resolution: WiFi.ListAPClients error code " + err, false);
            return;
        }
        if (!res || !res.ap_clients) {
            log("MAC resolution: No AP clients available", true);
            return;
        }
        for (let c of res.ap_clients) {
            let mac = (c.mac || "").toUpperCase();
            log("MAC resolution: Checking device with MAC: " + mac + " IP: " + c.ip, true);
            if (mac === MAC.toUpperCase()) {
                log("MAC resolution: Device found! MAC: " + mac + " IP: " + c.ip, false);
                HOST = c.ip;
                return;
            }
        }
        log("MAC resolution: MAC address " + MAC + " could not be resolved", true);
    });
}

function fetchCurrentLimit() {

    Shelly.call("http.request", {
        method: "GET",
        url: "http://" + HOST + ":" + PORT + "/api/livedata/status",
        headers: {
            "Authorization": authHeader
        }
    }, function (res, err_code, err_msg) {

        if (err_code !== 0) {
            log("HTTP error: " + err_code + " " + err_msg, false);
            return;
        }

        if (res.code !== 200) {
            log("Request failed. HTTP status: " + res.code, false);
            return;
        }

        let data = JSON.parse(res.body);

        if (!data.inverters) {
            log("No inverter data found!", false);
            return;
        }

        for (let i = 0; i < data.inverters.length; i++) {
            if (data.inverters[i].serial === INVERTER_SERIAL && (INVERTER_MANUFACTURER == null || data.inverters[i].manufacturer === INVERTER_MANUFACTURER)) {

                log("FetchLimit: Inverter found: " + INVERTER_SERIAL, true);

                let limitRelative = data.inverters[i].limit_relative;
                let limitAbsolute = data.inverters[i].limit_absolute;
                let reachable = data.inverters[i].reachable;

                if(reachable == false){
                    log("FetchLimit: inverter not rechable from opendtu -> skip", false);
                    return;
                }

                if(limitAbsolute < 0){
                    log("FetchLimit: Limit not fetched yet from inverter -> skip", false);
                    return;
                }

                log("FetchLimit: Temporary limit (relative): " + limitRelative + " %", true);
                log("FetchLimit: Absolute limit (relative): " + limitRelative * 0.01 * MAX_INVERTER_POWER + " W", true);

                currentInverterPower = limitRelative * MAX_INVERTER_POWER;

                lastSuccesfullSet = Shelly.getUptimeMs();

                return;
            }
        }

        log("Serial not found: " + SERIAL, false);
    });
}

// ==================== TIMERS ====================

// Main control loop
Timer.set(INTERVAL_RUN_MAIN_SCRIPT * 1000, true, runScript, null);
Timer.set(INTERVAL_FETCH_CURRENT_LIMIT * 1000, true, fetchCurrentLimit, null);

// MAC resolution timer (if MAC is configured)
if (typeof MAC === 'string' && MAC !== "") {
    log("MAC resolution enabled for: " + MAC, false);
    Timer.set(INTERVAL_RESOLVE_MAC * 1000, true, resolveMacToIp, null);
    // Resolve immediately on startup
    Timer.set(1, false, resolveMacToIp, null);
}

Timer.set(1, false, fetchCurrentLimit, null);
