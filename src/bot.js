/*
 * File: this.client.js
 * Project: steam-idler
 * Created Date: 17.10.2022 17:32:28
 * Author: 3urobeat
 *
 * Last Modified: 28.06.2023 13:46:57
 * Modified By: 3urobeat
 *
 * Copyright (c) 2022 3urobeat <https://github.com/HerrEurobeat>
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */


const SteamID   = require("steamid");
const SteamTotp = require("steam-totp");
const SteamUser = require("steam-user");

const sessionHandler = require("./sessions/sessionHandler.js");
const controller     = require("./controller.js");
const config         = require("../config.json");


/**
 * Constructor Creates a new bot object and logs in the account
 * @param {Object} logOnOptions The logOnOptions obj for this account
 * @param {Number} loginindex The loginindex for this account
 */
const bot = function(logOnOptions, loginindex, proxies) {

    this.logOnOptions = logOnOptions;
    this.loginindex   = loginindex;
    this.proxy        = proxies[loginindex % proxies.length]; // Spread all accounts equally with a simple modulo calculation

    // Create new steam-user bot object. Disable autoRelogin as we have our own queue system
    this.client = new SteamUser({ autoRelogin: false, httpProxy: this.proxy, protocol: SteamUser.EConnectionProtocol.WebSocket }); // Forcing protocol for now: https://dev.doctormckay.com/topic/4187-disconnect-due-to-encryption-error-causes-relog-to-break-error-already-logged-on/?do=findComment&comment=10917

    this.session;

    // Attach relevant steam-user events
    this.attachEventListeners();

};

module.exports = bot;


// Handles logging in this account
bot.prototype.login = async function() {

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


bot.prototype.attachEventListeners = function() {

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

        // Get all licenses this account owns
        let options = {
            includePlayedFreeGames: true,
            filterAppids: config.playingGames.filter(e => !isNaN(e)), // We only need to check for these appIDs. Filter custom game string
            includeFreeSub: false
        };

        this.client.getUserOwnedApps(this.client.steamID, options, (err, res) => {
            if (err) {
                logger("error", `[${this.logOnOptions.accountName}] Failed to get owned apps! Attempting to play set appIDs anyways...`);

                // Set playinggames for main account and child account
                this.client.gamesPlayed(config.playingGames); // Start playing games
                return;
            }

            // Check if we are missing a license
            let missingLicenses = config.playingGames.filter(e => !isNaN(e) && res.apps.filter(f => f.appid == e).length == 0);

            // Redeem missing licenses or start playing if none are missing. Event will get triggered again on change.
            if (missingLicenses.length > 0) {
                logger("info", `[${this.logOnOptions.accountName}] Requesting ${missingLicenses.length} missing license(s) before starting to play games set in config...`);

                this.user.requestFreeLicense(missingLicenses, (err) => {
                    if (err) {
                        logger("error", `[${this.logOnOptions.accountName}] Failed to request missing licenses! Starting to play anyways...`);
                        this.client.gamesPlayed(config.playingGames); // Start playing games
                    } else {
                        logger("info", `[${this.logOnOptions.accountName}] Successfully requested ${missingLicenses.length} missing game license(s)!`);
                        setTimeout(() => this.client.gamesPlayed(config.playingGames), 2500);
                    }
                });
            } else {
                logger("info", `[${this.logOnOptions.accountName}] Starting to idle ${config.playingGames.length} games...`);
                this.client.gamesPlayed(config.playingGames); // Start playing games
            }
        });
    });


    this.client.on("friendMessage", (steamID, message) => {
        var steamID64 = new SteamID(String(steamID)).getSteamID64();

        logger("info", `[${this.logOnOptions.accountName}] Friend message from ${steamID64}: ${message}`);

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
bot.prototype.handleRelog = function() {
    if (controller.relogQueue.includes(this.loginindex)) return; // Don't handle this request if account is already waiting for relog

    controller.relogQueue.push(this.loginindex); // Add account to queue

    // Check if it's our turn to relog every 1 sec after waiting relogDelay ms
    setTimeout(() => {
        var relogInterval = setInterval(() => {
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