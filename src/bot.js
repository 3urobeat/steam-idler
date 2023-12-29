/*
 * File: this.client.js
 * Project: steam-idler
 * Created Date: 2022-10-17 17:32:28
 * Author: 3urobeat
 *
 * Last Modified: 2023-12-29 18:18:03
 * Modified By: 3urobeat
 *
 * Copyright (c) 2022 - 2023 3urobeat <https://github.com/3urobeat>
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */


const SteamID   = require("steamid");
const SteamTotp = require("steam-totp");
const SteamUser = require("steam-user");
const EResult   = SteamUser.EResult;

const sessionHandler = require("./sessions/sessionHandler.js");
const controller     = require("./controller.js");
const config         = require("../config.json");


/**
 * Constructor Creates a new bot object and logs in the account
 * @param {Object} logOnOptions The logOnOptions obj for this account
 * @param {Number} loginindex The loginindex for this account
 */
const Bot = function(logOnOptions, loginindex, proxies) {

    this.logOnOptions = logOnOptions;
    this.loginindex   = loginindex;
    this.proxy        = proxies[loginindex % proxies.length]; // Spread all accounts equally with a simple modulo calculation

    // Create new steam-user bot object. Disable autoRelogin as we have our own queue system
    this.client = new SteamUser({ autoRelogin: false, renewRefreshTokens: true, httpProxy: this.proxy, protocol: SteamUser.EConnectionProtocol.WebSocket }); // Forcing protocol for now: https://dev.doctormckay.com/topic/4187-disconnect-due-to-encryption-error-causes-relog-to-break-error-already-logged-on/?do=findComment&comment=10917

    this.session;

    // Attach relevant steam-user events
    this.attachEventListeners();

};

module.exports = Bot;


// Handles logging in this account
Bot.prototype.login = async function() {

    /* ------------ Login ------------ */
    if (this.proxy) logger("info", `Logging in ${this.logOnOptions.accountName} in ${config.loginDelay / 1000} seconds with proxy '${this.proxy}'...`);
        else logger("info", `Logging in ${this.logOnOptions.accountName} in ${config.loginDelay / 1000} seconds...`);

    // Generate steamGuardCode with shared secret if one was provided
    if (this.logOnOptions.sharedSecret) {
        this.logOnOptions.steamGuardCode = SteamTotp.generateAuthCode(this.logOnOptions.sharedSecret);
    }

    // Get new session for this account and log in
    this.session = new sessionHandler(this.client, this.logOnOptions.accountName, this.loginindex, this.logOnOptions);

    let refreshToken = await this.session.getToken();
    if (!refreshToken) return; // Stop execution if getToken aborted login attempt

    setTimeout(() => this.client.logOn({ "refreshToken": refreshToken }), config.loginDelay); // Log in with logOnOptions

};


Bot.prototype.attachEventListeners = function() {

    this.client.on("loggedOn", () => { // This account is now logged on
        controller.nextacc++; // The next account can start

        // If this is a relog then remove this account from the queue and let the next account be able to relog
        if (controller.relogQueue.includes(this.loginindex)) {
            logger("info", `[${this.logOnOptions.accountName}] Relog successful.`);

            controller.relogQueue.splice(controller.relogQueue.indexOf(this.loginindex), 1); // Remove this loginindex from the queue
        } else {
            logger("info", `[${this.logOnOptions.accountName}] Logged in! Checking for missing licenses...`);
        }

        // Set online status if enabled (https://github.com/DoctorMcKay/node-steam-user/blob/master/enums/EPersonaState.js)
        if (config.onlinestatus) this.client.setPersona(config.onlinestatus);


        // Check if user provided games specifically for this account
        let configGames = config.playingGames;

        if (typeof configGames[0] == "object") {
            if (Object.keys(configGames[0]).includes(this.logOnOptions.accountName)) configGames = configGames[0][this.logOnOptions.accountName]; // Get the specific settings for this account if included
                else configGames = configGames.slice(1);                                                                                          // ...otherwise remove object containing acc specific settings to use the generic ones
        }


        // Get all licenses this account owns
        let options = {
            includePlayedFreeGames: true,
            filterAppids: configGames.filter(e => !isNaN(e)), // We only need to check for these appIDs. Filter custom game string
            includeFreeSub: false
        };

        this.client.getUserOwnedApps(this.client.steamID, options, (err, res) => {
            if (err) {
                logger("error", `[${this.logOnOptions.accountName}] Failed to get owned apps! Attempting to play set appIDs anyways...`);

                // Set playinggames for main account and child account
                this.client.gamesPlayed(configGames); // Start playing games
                return;
            }

            // Check if we are missing a license
            let missingLicenses = configGames.filter(e => !isNaN(e) && res.apps.filter(f => f.appid == e).length == 0);

            // Redeem missing licenses or start playing if none are missing. Event will get triggered again on change.
            if (missingLicenses.length > 0) {
                // Check if we are missing more than 50 licenses (limit per hour) and cut array
                if (missingLicenses.length > 50) {
                    logger("warn", `[${this.logOnOptions.accountName}] This account is missing more than 50 licenses! Steam only allows registering 50 licenses per hour.\n                             I will register 50 licenses now and relog this account in 1 hour to register the next 50 licenses.`);
                    missingLicenses = missingLicenses.splice(0, 50);

                    setTimeout(() => {
                        logger("info", `[${this.logOnOptions.accountName}] Relogging account to register the next 50 licenses...`);
                        this.handleRelog();
                    }, 3.6e+6 + 300000); // 1 hour plus 5 minutes for good measure
                }

                logger("info", `[${this.logOnOptions.accountName}] Requesting ${missingLicenses.length} missing license(s) before starting to play games set in config...`);

                this.client.requestFreeLicense(missingLicenses, (err) => {
                    if (err) {
                        logger("error", `[${this.logOnOptions.accountName}] Failed to request missing licenses! Starting to play anyways...`);
                        this.client.gamesPlayed(configGames); // Start playing games
                    } else {
                        logger("info", `[${this.logOnOptions.accountName}] Successfully requested ${missingLicenses.length} missing game license(s)!`);
                        setTimeout(() => this.client.gamesPlayed(configGames), 2500);
                    }
                });
            } else {
                logger("info", `[${this.logOnOptions.accountName}] Starting to idle ${configGames.length} games...`);
                this.client.gamesPlayed(configGames); // Start playing games
            }
        });
    });


    this.client.chat.on("friendMessage", (msg) => {
        let message = msg.message_no_bbcode;
        let steamID = msg.steamid_friend;
        let steamID64 = new SteamID(String(steamID)).getSteamID64();
        let username = this.client.users[steamID64].player_name;

        logger("info", `[${this.logOnOptions.accountName}] Friend message from '${username}' (${steamID64}): ${message}`);

        // Respond with afk message if enabled in config
        if (config.afkMessage.length > 0) {
            logger("info", "Responding with: " + config.afkMessage);

            this.client.chat.sendFriendMessage(steamID, config.afkMessage);
        }
    });


    this.client.on("disconnected", (eresult, msg) => { // Handle relogging
        if (controller.relogQueue.includes(this.loginindex)) return; // Don't handle this event if account is already waiting for relog

        logger("info", `[${this.logOnOptions.accountName}] Lost connection to Steam. Message: ${msg}. Trying to relog in ${config.relogDelay / 1000} seconds...`);
        this.handleRelog();
    });


    this.client.on("error", (err) => {
        // Custom behavior for LogonSessionReplaced error
        if (err.eresult == SteamUser.EResult.LogonSessionReplaced) {
            logger("warn", `${logger.colors.fgred}[${this.logOnOptions.accountName}] Lost connection to Steam! Reason: LogonSessionReplaced. I won't try to relog this account because someone else is using it now.`);
            return;
        }

        // Check if this is a login error or a connection loss
        if (controller.nextacc == this.loginindex) { // Login error

            // Invalidate token to get a new session if this error was caused by an invalid refreshToken
            if (err.eresult == EResult.InvalidPassword || err.eresult == EResult.AccessDenied || err == "Error: InvalidSignature") { // These are the most likely enums that will occur when an invalid token was used I guess (Checking via String here as it seems like there are EResults missing)
                logger("debug", "Token login error: Calling SessionHandler's _invalidateTokenInStorage() function to get a new session when retrying this login attempt");

                if (err.eresult == EResult.AccessDenied) logger("warn", `[${this.logOnOptions.accountName}] Detected an AccessDenied login error! This is usually caused by an invalid login token. Deleting login token, please re-submit your Steam Guard code.`);

                this.session.invalidateTokenInStorage();

                setTimeout(() => this.login(), 5000);
                return;
            }

            logger("error", `[${this.logOnOptions.accountName}] Error logging in! ${err}. Continuing with next account...`);
            controller.nextacc++; // The next account can start

        } else { // Connection loss

            if (controller.relogQueue.includes(this.loginindex)) return; // Don't handle this event if account is already waiting for relog

            logger("info", `[${this.logOnOptions.accountName}] Lost connection to Steam. ${err}. Trying to relog in ${config.relogDelay / 1000} seconds...`);
            this.handleRelog();
        }
    });

};


// Handles relogging this bot account
Bot.prototype.handleRelog = function() {
    if (controller.relogQueue.includes(this.loginindex)) return; // Don't handle this request if account is already waiting for relog

    controller.relogQueue.push(this.loginindex); // Add account to queue

    // Check if it's our turn to relog every 1 sec after waiting relogDelay ms
    setTimeout(() => {
        let relogInterval = setInterval(() => {
            if (controller.relogQueue.indexOf(this.loginindex) != 0) return; // Not our turn? stop and retry in the next iteration

            clearInterval(relogInterval); // Prevent any retries
            this.client.logOff();

            logger("info", `[${this.logOnOptions.accountName}] It is now my turn. Relogging in ${config.loginDelay / 1000} seconds...`);

            // Attach relogdelay timeout
            setTimeout(async () => {
                logger("info", `[${this.logOnOptions.accountName}] Logging in...`);

                // Generate steamGuardCode with shared secret if one was provided
                if (this.logOnOptions.sharedSecret) {
                    this.logOnOptions.steamGuardCode = SteamTotp.generateAuthCode(this.logOnOptions.sharedSecret);
                }

                let refreshToken = await this.session.getToken();
                if (!refreshToken) return; // Stop execution if getToken aborted login attempt

                this.client.logOn({ "refreshToken": refreshToken });
            }, config.loginDelay);
        }, 1000);
    }, config.relogDelay);
};
