let TARGET_SCRIPT_NAMES = [
  "__auto_zendure-online-monit-find_",
  "__auto_zendure-power-control-find_"
];
let CHECK_INTERVAL_MS = 60 * 1000;
let DEBUG = false;

if(!TARGET_SCRIPT_NAMES || TARGET_SCRIPT_NAMES.length === 0){
  throw new Error("Variable: TARGET_SCRIPT_NAMES must contain at least one script name");
}

function log(message, debug) {
    if (!debug || DEBUG) {
        print("[" + Shelly.getUptimeMs() + " Script Restart Checker]: " + message);
    }
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
    Shelly.call("Script.List", null, function(response, error_code, error_msg) {
        if (error_code !== 0) {
            log("Error calling Script.List: " + error_msg, false);
            return;
        }
        if (!response || !response.scripts) {
            log("Unexpected response to Script.List", false);
            return;
        }

        // Check each target script
        for (var i = 0; i < TARGET_SCRIPT_NAMES.length; i++) {
            var targetName = TARGET_SCRIPT_NAMES[i];
            var found = false;

            // Find matching script in list
            for (var j = 0; j < response.scripts.length; j++) {
                var sc = response.scripts[j];
                if (sc.name.indexOf(targetName) === 0) {
                    found = true;
                    var id = sc.id;

                    if (sc.running) {
                        log("Script '" + sc.name + "' (id " + id + ") is running.", true);
                    } else {
                        log("Script '" + sc.name + "' (id " + id + ") is NOT running. Attempting restart.", false);
                        ensureScriptHasCodeAndStart(id, sc.name);
                    }
                    break;
                }
            }

            if (!found) {
                log("Script starting with '" + targetName + "' not found.", false);
            }
        }
    });
}

// Periodic check
Timer.set(CHECK_INTERVAL_MS, true, function() {
    checkAndRecover();
});