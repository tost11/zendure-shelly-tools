// this scripts sends data retrived from zendure power station to online monitoring via rest https://github.com/tost11/solar-monitoring

let HOST = undefined;//ip in local network where to find zendure power stations
let DATA_DURATION = 30; //time difference between fetching new inverter data in seconds
let DEBUG = false;//set log level to debug to se more information what's happening
let SERIAL = undefined;//serial number of zendure power station (so not wrong device is fetched accidentally

let ONLINE_SYSTEM_ID = undefined;//id of system (copied from url in browser: https://[DOMAIN]/dd/[ID])
let ONLINE_CLIENT_TOKEN = undefined; //client secret token retrieved when setting up system (regenerate on settings page)
let ONLINE_URL_1 = "https://solar.pihost.org";//first domain to send data to
let ONLINE_URL_2 = "https://solar.tost-soft.de";//backup domain if first is down
let ONLINE_DEVICE_ID = 1;//device id for online monitoring (only important if multiple device are in one system)
let ONLINE_DEVICE_ID_SHELLY = 2;

if(!HOST){throw new Error("Variable: HOST is required");}
if(!SERIAL){throw new Error("Variable: SERIAL is required");}
if(!DATA_DURATION){throw new Error("Variable: DATA_DURATION is required");}
if(DATA_DURATION < 5){throw new Error("Variable: DATA_DURATION not allowed to be lower then 5 seconds");}
if(ONLINE_DEVICE_ID <= 0){throw new Error("Variable: ONLINE_DEVICE_ID not allowed to be lower then 1");}
if(ONLINE_DEVICE_ID_SHELLY <= 0){throw new Error("Variable: ONLINE_DEVICE_ID_SHELLY not allowed to be lower then 1");}
if(ONLINE_DEVICE_ID_SHELLY == ONLINE_DEVICE_ID){throw new Error("Variable: ONLINE_DEVICE_ID can not be equal");}
if(!ONLINE_SYSTEM_ID){throw new Error("Variable: ONLINE_SYSTEM_ID is required");}
if(!ONLINE_URL_1){throw new Error("Variable: ONLINE_URL_1 is required");}
if(!ONLINE_CLIENT_TOKEN){throw new Error("Variable: ONLINE_CLIENT_TOKEN is required");}

function log(message, debug) {
  if (!debug || DEBUG) {
    let prefix = "[" + Shelly.getUptimeMs() + " Zendure Online Monitoring]: ";
    let fullMessage = prefix + message;
    print(fullMessage);
  }
}

// Parsing Funktion mit sauberem Entfernen von Null- und 0-Werten
function parseZendureData(resp) {
  let p = resp.properties || {};

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

  return device;
}

// Function to get and print the model information of the device
function getShellyData(callback) {

  Shelly.call("EM.GetStatus", {id:0}, function (ShellyEM) {
    log("Device Info: " + JSON.stringify(ShellyEM),true);
    Shelly.call("EMData.GetStatus", {id:0}, function (ShellyEMData) {
      log("Device Info: " + JSON.stringify(ShellyEMData),true);

      var shellyDevice = {
        id: ONLINE_DEVICE_ID_SHELLY,
        gridWatt: 0,
        grids:[{
          id:1
        },{
          id:2
        },{
          id:3
        }]
      };

      if(ShellyEM){
        if(ShellyEM.a_voltage > 1){
          shellyDevice.grids[0].voltage = ShellyEM.a_voltage;
          shellyDevice.grids[0].ampere = ShellyEM.a_current;
          shellyDevice.grids[0].watt = ShellyEM.a_act_power;
          shellyDevice.grids[0].frequency = ShellyEM.a_freq;
        }

        if(ShellyEM.b_voltage > 1){
          shellyDevice.grids[1].voltage = ShellyEM.b_voltage;
          shellyDevice.grids[1].ampere = ShellyEM.b_current;
          shellyDevice.grids[1].watt = ShellyEM.b_act_power;
          shellyDevice.grids[1].frequency = ShellyEM.b_freq;
        }

        if(ShellyEM.c_voltage > 1){
          shellyDevice.grids[2].voltage = ShellyEM.c_voltage;
          shellyDevice.grids[2].ampere = ShellyEM.c_current;
          shellyDevice.grids[2].watt = ShellyEM.c_act_power;
          shellyDevice.grids[2].frequency = ShellyEM.c_freq;
        }

        shellyDevice.gridWatt = ShellyEM.total_act_power;
      }

      if(ShellyEMData){
        //TODO handle calucate more save
        typeof ShellyEMData.a_total_act_energy === "number" && shellyDevice.grids[0].totalConsumptionKWH = ShellyEMData.a_total_act_energy / 1000;
        typeof ShellyEMData.a_total_act_energy === "number" && shellyDevice.grids[0].totalFeedInKWH = ShellyEMData.a_total_act_ret_energy / 1000;

        typeof ShellyEMData.b_total_act_energy === "number" && shellyDevice.grids[1].totalConsumptionKWH = ShellyEMData.b_total_act_energy / 1000;
        typeof ShellyEMData.b_total_act_ret_energy === "number" && shellyDevice.grids[1].totalFeedInKWH = ShellyEMData.b_total_act_ret_energy / 1000;

        typeof ShellyEMData.c_total_act_energy === "number" && shellyDevice.grids[2].totalConsumptionKWH = ShellyEMData.c_total_act_energy / 1000;
        typeof ShellyEMData.c_total_act_ret_energy === "number" && shellyDevice.grids[2].totalFeedInKWH = ShellyEMData.c_total_act_ret_energy / 1000;

        typeof ShellyEMData.total_act === "number" && shellyDevice.gridTotalConsumptionKWH = ShellyEMData.total_act / 1000;
        typeof ShellyEMData.total_act_ret === "number" && shellyDevice.gridTotalFeedInKWH = ShellyEMData.total_act_ret / 1000;
      }

      log("Shelly parsed data: " + JSON.stringify(shellyDevice),true)
      callback(shellyDevice)
    });
  });
}

function runSecondPartOfScript(payload){

  getShellyData(function(shellyDevice){

    payload.devices.push(shellyDevice);

    let toSend = JSON.stringify(payload)

    log("sendData: "+toSend,false);

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
  var payload = {
    duration: DATA_DURATION,
    timestamp: Date.now(),
    devices: []
  };

  Shelly.call("HTTP.GET", {url: "http://" + HOST + "/properties/report",timeout: 5},function(result, err_code, err_msg) {
    if (err_code !== 0 || result.code !== 200 || !result.body) {
      log("error while getting status of power station, no post performed: " + err_code + " " + err_msg,false);
      runSecondPartOfScript(payload);
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
      runSecondPartOfScript(payload);
      return;
    }
    //set zendure data to our send payload
    payload.devices.push(parseZendureData(response));
    runSecondPartOfScript(payload);
  });
}

// Timer alle DATA_DURATION Sekunden für Datenerfassung & Übertragung
Timer.set(DATA_DURATION * 1000, true, runScript, null);