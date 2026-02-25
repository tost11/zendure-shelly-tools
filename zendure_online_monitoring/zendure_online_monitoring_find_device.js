// this scripts sends data retrived from zendure power station to online monitoring via rest https://github.com/tost11/solar-monitoring

let DATA_DURATION = 30; //time difference between fetching new inverter data in seconds
let DEBUG = false;//set log level to debug to se more information what's happening
let SERIAL = undefined;//serial number of zendure power station (so not wrong device is fetched accidentally

let ONLINE_SYSTEM_ID = undefined;//id of system (copied from url in browser: https://[DOMAIN]/dd/[ID])
let ONLINE_CLIENT_TOKEN = undefined; //client secret token retrieved when setting up system (regenerate on settings page)
let ONLINE_URL_1 = "https://solar.pihost.org";//first domain to send data to
let ONLINE_URL_2 = "https://solar.tost-soft.de";//backup domain if first is down
let ONLINE_DEVICE_ID = 1;//device id for online monitoring (only important if multiple device are in one system)

// interval in seconds search for power station in network
let INTERVAL_SCAN_NETWORK = 15 * 60;//scan every 15 min
// scan wifi ap network for power station
var CHECK_WIFI_AP = true;
// scan wifi sta network for power station
var CHECK_WIFI_STA = true;
//scan ethernet network for power station
var CHECK_ETH = true
// time in seconds when power station is assumed offline (no response from requests)
let INTERVAL_DEVICE_OFFLINE = 60 * 10;//offline after 10 minutes

let host = undefined;
let lastSeenDevice = null;
let scanRunning = false;

if(!SERIAL){throw new Error("Variable: SERIAL is required");}
if(!DATA_DURATION){throw new Error("Variable: DATA_DURATION is required");}
if(DATA_DURATION < 5){throw new Error("Variable: DATA_DURATION not allowed to be lower then 5 seconds");}
if(ONLINE_DEVICE_ID <= 0){throw new Error("Variable: ONLINE_DEVICE_ID not allowed to be lower then 1");}
if(!ONLINE_SYSTEM_ID){throw new Error("Variable: ONLINE_SYSTEM_ID is required");}
if(!ONLINE_URL_1){throw new Error("Variable: ONLINE_URL_1 is required");}
if(!ONLINE_CLIENT_TOKEN){throw new Error("Variable: ONLINE_CLIENT_TOKEN is required");}
if(!INTERVAL_DEVICE_OFFLINE){throw new Error("Variable: INTERVAL_DEVICE_OFFLINE is required");}
if(!INTERVAL_SCAN_NETWORK){throw new Error("Variable: INTERVAL_SCAN_NETWORK is required");}
if(!CHECK_WIFI_AP){throw new Error("Variable: CHECK_WIFI_AP is required");}
if(!CHECK_WIFI_STA){throw new Error("Variable: CHECK_WIFI_STA is required");}
if(!CHECK_ETH){throw new Error("Variable: CHECK_ETH is required");}

function log(message, debug) {
  if (!debug || DEBUG) {
    let prefix = "[" + Shelly.getUptimeMs() + " Zendure Online Monitoring]: ";
    let fullMessage = prefix + message;
    print(fullMessage);
  }
}

function isDeviceReachable(){
  if(!lastSeenDevice){
    return false;
  }
  return Shelly.getUptimeMs() - lastSeenDevice < INTERVAL_DEVICE_OFFLINE * 1000;
}

// Parsing Funktion mit sauberem Entfernen von Null- und 0-Werten
function parseZendureData(resp) {
  let p = resp.properties || {};
  let now = Date.now();

  let inputsDC = [];
  for (let i = 1; i <= 6; i++) {
    let key = "solarPower" + i;
    if (typeof p[key] === "number" && p[key] !== 0) {
      inputsDC.push({
        id: i,
        watt: p[key]
      });
    }
  }

  let inputsAC = [];
  let outputsAC = [];
  let batteries = [];
  //TODO pars packData

  let device = {
    id: ONLINE_DEVICE_ID
  };

  let packPower = 0;
  let packPowerOk = false;
  if (typeof p.packInputPower === "number") {
    packPower -= p.packInputPower;
    packPowerOk = true;
  }
  if (typeof p.outputPackPower === "number") {
    packPower += p.outputPackPower;
    packPowerOk = true;
  }
  if (packPowerOk){
    device.batteryWatt = packPower;
  }
  if (typeof p.solarInputPower === "number" && p.solarInputPower > 0) {
    device.inputWattDC = p.solarInputPower;
  }
  if (typeof p.outputHomePower === "number") {
    device.outputWattAC = p.outputHomePower;
  }
  if (typeof p.gridInputPower === "number") {
    device.inputWattAC = p.gridInputPower;
  }
  if (typeof p.BatVolt === "number") {
    device.batteryVoltage = p.BatVolt / 100.0;
  }
  if (typeof p.electricLevel === "number") {
    device.batteryPercentage = p.electricLevel;
  }
  if (typeof p.hyperTmp === "number" && p.hyperTmp !== 0) {
    device.temperature = p.hyperTmp / 100.0;
  }

  if (inputsDC.length) device.inputsDC = inputsDC;
  if (inputsAC.length) device.inputsAC = inputsAC;
  if (batteries.length) device.batteries = batteries;
  if (outputsAC.length) device.outputsAC = outputsAC;

  return {
    duration: DATA_DURATION,
    timestamp: now,
    devices: [device]
  };
}

function tryLogMessageIfPossible(body){
  if(!body){
    return;//no body given
  }
  try{
    var msg = JSON.parse(body);
    if(msg.error){
      log("Response error: "+msg.error,true);
    }else{
      log("Response body: "+msg,true);
    }
  }catch(error){
    //coult not be handle log full body
    log("Response body: "+msg,true);
  }
}

function handlePostResult(domain,result, err_code, err_msg){
  if (err_code !== 0) {
    log("could not send data to: " + domain + " error_code: " + err_code + " error_msg: " + err_msg,false);
    return false;
  }
  if(result.code === 403 || result.code === 401 || result.code === 404){
    log("Permission denied or system no found while sending data to " + domain + " with status: "+result.code+", is system id and client token correct ?, status code " + result.code,false);
    tryLogMessageIfPossible(result.body);
    return true;//return true so second domain is not tried (it will also be unauthorized on second domain)
  }
  if(result.code === 400){
    log("Could not send data " + domain + ", because our data seem to be invalid ?! -> skip this sample, status code " + result.code,false);
    tryLogMessageIfPossible(result.body);
    return true;//return true so second domain is not tried (it will also be invalid on second domain)
  }
  if(result.code === 200){
    log("Data successfully send to " + domain,false);
    return true;
  }
  log("Data not send was no possible to " + domain + " http code: " + result.code,false);
  tryLogMessageIfPossible(result.body);
  return false;
}

function runScript() {
  if(typeof host !== 'string' || host === ""){
    log("Main script no run -> Hostname or ip not set, scanning?: "+scanRunning,false);
    return;
  }
  Shelly.call("HTTP.GET", {url: "http://" + host + "/properties/report",timeout: 5},function(result, err_code, err_msg) {
    if (err_code !== 0 || result.code !== 200 || !result.body) {
      log("error while getting status of power station, no post performed: " + err_code + " " + err_msg,false);
      return;
    }

    let response;
    try {
      response = JSON.parse(result.body);
    }catch(error){
      log("Could parse json response from zendure bower station", false);
    }

    if (!response || !response.properties || !response.messageId || !response.product || response.sn !== SERIAL) {
      log("Could not get value from request response (maybe it is not a zendure response or Serial (SN) is wrong)",false);
      log("Response: "+response,true);
      return;
    }

    lastSeenDevice = Shelly.getUptimeMs();

    let payload = parseZendureData(response);
    let toSend = JSON.stringify(payload)

    log("sendData: "+toSend,true);

    Shelly.call("HTTP.Request", {
      method: "POST",
      url: ONLINE_URL_1+"/api/solar/data?systemId="+ONLINE_SYSTEM_ID,
      timeout: 10,
      headers: {
        "Content-Type": "application/json",
        "clientToken": ONLINE_CLIENT_TOKEN
      },
      body: toSend
    }, function(result, err_code, err_msg) {
      if(!handlePostResult(ONLINE_URL_1,result,err_code,err_msg)){
        //try second domain
        if(!ONLINE_URL_2){
          log("No Second Domain defined",true);
          return;
        }
        Shelly.call("HTTP.Request", {
          method: "POST",
          timeout: 10,
          url: ONLINE_URL_2+"/api/solar/data?systemId="+ONLINE_SYSTEM_ID,
          headers: {
            "Content-Type": "application/json",
            "clientToken": ONLINE_CLIENT_TOKEN
          },
          body: toSend
        }, function(result, err_code, err_msg) {
          handlePostResult(ONLINE_URL_2,result,err_code,err_msg);
        });
      }
    });
  });
}

// Timer alle DATA_DURATION Sekunden für Datenerfassung & Übertragung
Timer.set(DATA_DURATION * 1000, true, runScript, null);

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