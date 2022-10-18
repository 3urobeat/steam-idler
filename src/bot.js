/*
 * File: this.client.js
 * Project: steam-idler
 * Created Date: 17.10.2022 17:32:28
 * Author: 3urobeat
 * 
 * Last Modified: 18.10.2022 11:12:25
 * Modified By: 3urobeat
 * 
 * Copyright (c) 2022 3urobeat <https://github.com/HerrEurobeat>
 * 
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. 
 */


const SteamUser = require("steam-user");

const controller = require("./controller.js");
const config     = require("../config.json");


/**
 * Constructor Creates a new bot object and logs in the account
 * @param {Object} logOnOptions The logOnOptions obj for this account
 * @param {Number} loginindex The loginindex for this account
 * @param {Function} logger The logger function
 */
const bot = function(logOnOptions, loginindex, logger) {

    this.logOnOptions = logOnOptions;
    this.loginindex   = loginindex;

    // Create new steam-user bot object
    this.client = new SteamUser({ autoRelogin: false });

    logger("info", `Logging in ${logOnOptions.accountName} in ${config.loginDelay / 1000} seconds...`);
    setTimeout(() => this.client.logOn(logOnOptions), config.loginDelay); //log in with logOnOptions

    // Attach relevant steam-user events after bot obj is created
    this.client.on('loggedOn', () => { //this account is now logged on
        logger("info", `[${logOnOptions.accountName}] Logged in and idling games.\n`)

        controller.nextacc++; // The next account can start

        //If this is a relog then remove this account from the queue and let the next account be able to relog
        if (controller.relogQueue.includes(loginindex)) {
            logger("info", `[${logOnOptions.accountName}] Relog successful.`)

            controller.relogQueue.splice(controller.relogQueue.indexOf(loginindex), 1) //remove this loginindex from the queue
        }

        if (config.onlinestatus) this.client.setPersona(config.onlinestatus) //set online status if enabled (https://github.com/DoctorMcKay/node-steam-user/blob/master/enums/EPersonaState.js)
        this.client.gamesPlayed(config.playingGames) //start playing games
    });


    this.client.on('friendMessage', (steamID, message) => {
        var steamID64 = new SteamID(String(steamID)).getSteamID64()

        logger("info", `[${logOnOptions.accountName}] Friend message from ${steamID64}: ${message}`)

        if (config.afkMessage.length > 0) {
            logger("info", "Responding with: " + config.afkMessage)

            this.client.chat.sendFriendMessage(steamID, config.afkMessage)
        }  
    });


    this.client.on("disconnected", (eresult, msg) => { //handle relogging
        if (controller.relogQueue.includes(loginindex)) return; //don't handle this event if account is already waiting for relog

        logger("info", `[${logOnOptions.accountName}] Lost connection to Steam. Message: ${msg}. Trying to relog in ${config.relogDelay / 1000} seconds...`);
        controller.relogQueue.push(loginindex);

        //Check if it's our turn to relog every 1 sec after waiting relogDelay ms
        setTimeout(() => {
            var relogInterval = setInterval(() => {
                if (controller.relogQueue.indexOf(loginindex) != 0) return; //not our turn? stop and retry in the next iteration

                clearInterval(relogInterval) //prevent any retries
                this.client.logOff()

                logger("info", `[${logOnOptions.accountName}] It is now my turn. Relogging in ${config.loginDelay / 1000} seconds...`)

                //Generate steam guard code again if user provided a shared_secret
                if (logOnOptions["sharedSecretForRelog"]) {
                    logOnOptions["twoFactorCode"] = SteamTotp.generateAuthCode(logOnOptions["sharedSecretForRelog"]);
                }

                //Attach relogdelay timeout
                setTimeout(() => {
                    logger("info", `[${logOnOptions.accountName}] Logging in...`)
                    
                    this.client.logOn(logOnOptions)
                }, config.loginDelay);
            }, 1000);
        }, config.relogDelay);
    });

}

module.exports = bot;