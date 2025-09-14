let TARGET_SCRIPT_NAME = "INSERT OTHER SCRIPT NAME HERE";
let CHECK_INTERVAL_MS = 60 * 1000;
let DEBUG = false;

function log(message, debug) {
    if (!debug || DEBUG) {
        print("[" + Shelly.getUptimeMs() + "Script Restart Checker]: " + message);
    }
}

function findScriptByName(name, callback) {
    Shelly.call("Script.List", null, function(response, error_code, error_msg) {
        if (error_code !== 0) {
            log("Error calling Script.List: " + error_msg, false);
            callback(null);
            return;
        }
        if (!response || !response.scripts) {
            log("Unexpected response to Script.List", false);
            callback(null);
            return;
        }
        for (let i = 0; i < response.scripts.length; i++) {
            let sc = response.scripts[i];
            if (sc.name === name) {
                callback(sc);
                return;
            }
        }
        log("Script with name '" + name + "' not found.", false);
        callback(null);
    });
}

function ensureScriptHasCodeAndStart(id, name) {
    Shelly.call("Script.GetCode", { id: id, offset: 0, len: 1 }, function(getcode_resp, getcode_err, getcode_msg) {
        if (getcode_err !== 0) {
            log("Error getting code for script '" + name + "' (id " + id + "): " + getcode_msg, false);
            return;
        }
        if (!getcode_resp || !getcode_resp.data || getcode_resp.left === undefined) {
            log("Unexpected Script.GetCode response for script '" + name + "'", false);
        }
        if (getcode_resp.data === "" && getcode_resp.left === undefined) {
            log("Script '" + name + "' appears to have no code. Cannot start.", false);
            return;
        }

        Shelly.call("Script.Start", { id: id }, function(start_resp, start_err, start_msg) {
            if (start_err === 0) {
                log("Script '" + name + "' restarted successfully (was_running: " + start_resp.was_running + ")", false);
            } else {
                log("Failed to start script '" + name + "': " + start_msg, false);
            }
        });
    });
}

function checkAndRecover() {
    findScriptByName(TARGET_SCRIPT_NAME, function(scriptInfo) {
        if (!scriptInfo) {
            return;
        }

        let id = scriptInfo.id;
        if (scriptInfo.running) {
            log("Script '" + TARGET_SCRIPT_NAME + "' (id " + id + ") is running.", true);
        } else {
            log("Script '" + TARGET_SCRIPT_NAME + "' (id " + id + ") is NOT running. Attempting restart.", false);
            ensureScriptHasCodeAndStart(id, TARGET_SCRIPT_NAME);
        }
    });
}

// Periodic check
Timer.set(CHECK_INTERVAL_MS, true, function() {
    checkAndRecover();
});