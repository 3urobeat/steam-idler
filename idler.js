const fs = require("fs");
const SteamUser = require('steam-user');
const SteamTotp = require("steam-totp");
const SteamID   = require('steamid');
const logger    = require("output-logger");

const config = require("./config.json");

var nextacc    = 0
var relogQueue = []; //queue tracking disconnected accounts to relog them after eachother with a delay

//Configure my logging lib
logger.options({
    msgstructure: `[${logger.Const.ANIMATION}] [${logger.Const.DATE} | ${logger.Const.TYPE}] ${logger.Const.MESSAGE}`,
    paramstructure: [logger.Const.TYPE, logger.Const.MESSAGE, "nodate", "remove", logger.Const.ANIMATION],
    outputfile: "./output.txt",
    exitmessage: "Goodbye!"
})


/* ------------ Functions: ------------ */
/**
 * Imports logininformation from accounts.txt
 * @returns logininfo object
 */
function importLogininfo(callback) {
    logger("info", "Loading logininfo from accounts.txt...")

    var logininfo = {}

    //Either use logininfo.json or accounts.txt:
    if (fs.existsSync("./accounts.txt")) {
        var data = fs.readFileSync("./accounts.txt", "utf8").split("\n")

        if (data[0].startsWith("//Comment")) data = data.slice(1); //Remove comment from array

        if (data == "") {
            logger("error", "No accounts found in accounts.txt! Aborting...")
            process.exit(1)
        }

        data.forEach((e, i) => {
            if (e.length < 2) return; //if the line is empty ignore it to avoid issues like this: https://github.com/HerrEurobeat/steam-comment-service-bot/issues/80
            e = e.split(":")
            e[e.length - 1] = e[e.length - 1].replace("\r", "") //remove Windows next line character from last index (which has to be the end of the line)
            logininfo["bot" + i] = [e[0], e[1], e[2]]

            if (i == data.length - 1) callback(logininfo) //callback finished obj on last iteration
        })
    } else {
        logger("error", "No accounts found in accounts.txt! Aborting...")
        process.exit(1)
    }
}


/**
 * Login an account and start playing games
 * @param {*} logOnOptions 
 */
function loginAcc(logOnOptions, index) {
    let bot = new SteamUser({ autoRelogin: false });

    logger("info", `Logging in ${logOnOptions.accountName} in ${config.loginDelay / 1000} seconds...`)
    setTimeout(() => bot.logOn(logOnOptions), config.loginDelay); //log in with logOnOptions

    //Attach event listeners
    bot.on('loggedOn', () => { //this account is now logged on
        logger("info", `[${logOnOptions.accountName}] Logged in and idling games.\n`)

        nextacc = index + 1 //the next index can start

        //If this is a relog then remove this account from the queue and let the next account be able to relog
        if (relogQueue.includes(index)) {
            logger("info", `[${logOnOptions.accountName}] Relog successful.`)

            relogQueue.splice(relogQueue.indexOf(index), 1) //remove this loginindex from the queue
        }

        if (config.onlinestatus) bot.setPersona(config.onlinestatus) //set online status if enabled (https://github.com/DoctorMcKay/node-steam-user/blob/master/enums/EPersonaState.js)
        bot.gamesPlayed(config.playingGames) //start playing games
    });

    bot.on('friendMessage', (steamID, message) => {
        var steamID64 = new SteamID(String(steamID)).getSteamID64()

        logger("info", `[${logOnOptions.accountName}] Friend message from ${steamID64}: ${message}`)

        if (config.afkMessage.length > 0) {
            logger("info", "Responding with: " + config.afkMessage)

            bot.chat.sendFriendMessage(steamID, config.afkMessage)
        }  
    })

    bot.on("disconnected", (eresult, msg) => { //handle relogging
        if (relogQueue.includes(index)) return; //don't handle this event if account is already waiting for relog

        logger("info", `[${logOnOptions.accountName}] Lost connection to Steam. Message: ${msg}. Trying to relog in ${config.relogDelay / 1000} seconds...`);
        relogQueue.push(index);

        //Check if it's our turn to relog every 1 sec after waiting relogDelay ms
        setTimeout(() => {
            var relogInterval = setInterval(() => {
                if (relogQueue.indexOf(index) != 0) return; //not our turn? stop and retry in the next iteration

                clearInterval(relogInterval) //prevent any retries
                bot.logOff()

                logger("info", `[${logOnOptions.accountName}] It is now my turn. Relogging in ${config.loginDelay / 1000} seconds...`)

                //Generate steam guard code again if user provided a shared_secret
                if (logOnOptions["sharedSecretForRelog"]) {
                    logOnOptions["twoFactorCode"] = SteamTotp.generateAuthCode(logOnOptions["sharedSecretForRelog"]);
                }

                //Attach relogdelay timeout
                setTimeout(() => {
                    logger("info", `[${logOnOptions.accountName}] Logging in...`)
                    
                    bot.logOn(logOnOptions)
                }, config.loginDelay);
            }, 1000);
        }, config.relogDelay);
    })

}



/* ------------ Start all accounts: ------------ */
logger("", "", true, true)
logger("info", "Simple steam-idler by 3urobeat v1.2\n")

importLogininfo((logininfo) => {
    logger("", "", true)

    Object.values(logininfo).forEach((e, i) => {
        setTimeout(() => {

            var readycheckinterval = setInterval(() => {
                if (nextacc == i) { //check if it is our turn

                    clearInterval(readycheckinterval)

                    let logOnOptions = {
                        accountName: e[0],
                        password: e[1]
                    };
            
                    //If a shared secret was provided in the logininfo then add it to logOnOptions object
                    if (e[2] && e[2] != "") { 
                        logOnOptions["twoFactorCode"] = SteamTotp.generateAuthCode(e[2])
                        logOnOptions["sharedSecretForRelog"] = e[2]; //add raw shared_secret to obj as well to be able to access it from disconnected event
                    }
                
                    loginAcc(logOnOptions, i)
                }
            }, 250)
        }, 1000);
    })
})