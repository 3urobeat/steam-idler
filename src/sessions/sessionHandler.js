/*
 * File: sessionHandler.js
 * Project: steam-idler
 * Created Date: 2022-10-09 12:47:27
 * Author: 3urobeat
 *
 * Last Modified: 2024-10-19 14:18:43
 * Modified By: 3urobeat
 *
 * Copyright (c) 2022 - 2024 3urobeat <https://github.com/3urobeat>
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */


// This sessionHandler module is a modified version from my Steam Comment Service Bot: https://github.com/3urobeat/steam-comment-service-bot

const SteamUser    = require("steam-user"); // eslint-disable-line
const SteamSession = require("steam-session");
const nedb         = require("@seald-io/nedb");
const { StartSessionResponse } = require("steam-session/dist/interfaces-external.js"); // eslint-disable-line

const controller   = require("../controller.js");


/**
 * Constructor - Object oriented approach for handling session for one account
 * @param {SteamUser} bot The bot instance of the calling account
 * @param {string} thisbot The thisbot string of the calling account
 * @param {number} loginindex The loginindex of the calling account
 * @param {object} logOnOptions Object containing username, password and optionally steamGuardCode
 */
const sessionHandler = function(bot, thisbot, loginindex, logOnOptions) {

    // Make parameters given to the constructor available
    this.bot          = bot;
    this.thisbot      = thisbot;
    this.loginindex   = loginindex;
    this.logOnOptions = logOnOptions;

    // Define vars that will be populated
    this.getTokenPromise = null; // Can be called from a helper later on
    this.session = null;

    // Load tokens database
    this.tokensdb = new nedb({ filename: "./src/tokens.db", autoload: true });

    // Load helper files
    require("./events/sessionEvents");
    require("./helpers/handle2FA.js");
    require("./helpers/handleCredentialsLoginError");
    require("./helpers/tokenStorageHandler.js");

};

// Make object accessible from outside
module.exports = sessionHandler;


/**
 * Handles getting a refresh token for steam-user to auth with
 * @returns {Promise} `refreshToken` on success or `null` on failure
 */
sessionHandler.prototype.getToken = function() { // I'm not allowed to use arrow styled functions here... (https://stackoverflow.com/questions/59344601/javascript-nodejs-typeerror-cannot-set-property-validation-of-undefined)
    return new Promise((resolve) => {
        logger("debug", `[${this.thisbot}] getToken(): Created new object for token request`);

        // Save promise resolve function so any other function of this object can resolve the promise itself
        this.getTokenPromise = resolve;

        // First ask tokenStorageHandler if we already have a valid token for this account in storage
        this._getTokenFromStorage((token) => {
            // Instantly resolve promise if we still have a valid token on hand, otherwise start credentials login flow
            if (token) {
                resolve(token);
            } else {
                this._attemptCredentialsLogin(); // Start first attempt of logging in
            }
        });
    });
};


/**
 * Internal - Handles resolving the getToken() promise and skipping the account if necessary
 * @param {string} token The token to resolve with or null when account should be skipped
 */
sessionHandler.prototype._resolvePromise = function(token) {

    // Skip this account if token is null or stop bot if this is the main account
    if (!token) {
        logger("error", `[${this.thisbot}] Couldn't log in! Continuing with next account...`);
        controller.nextacc++; // The next account can start

        this.session.cancelLoginAttempt(); // Cancel this login attempt just to be sure
    } else {
        // Save most recent valid token to tokens.db
        this._saveTokenToStorage(token);
    }

    this.getTokenPromise(token);

};


/**
 * Internal - Attempts to log into account with credentials
 */
sessionHandler.prototype._attemptCredentialsLogin = function() {

    // Init new session
    this.session = new SteamSession.LoginSession(SteamSession.EAuthTokenPlatformType.SteamClient, { httpProxy: this.bot.proxy });

    // Attach event listeners
    this._attachEvents();

    // Bail if username or password is null
    if (!this.logOnOptions.accountName || !this.logOnOptions.password) {
        logger("", "", true);

        if (this.logOnOptions.accountName) {
            logger("error", `[${this.thisbot}] The account '${this.logOnOptions.accountName}' is missing a password, which is required to login using credentials! Please re-check this 'accounts.txt' entry.`, true);
        } else {
            logger("error", `[${this.thisbot}] This account is missing a username or password, which are required to login using credentials! Please re-check your 'accounts.txt' entries.`, true);
        }

        this._resolvePromise(null);
        return;
    }

    // Login with QR Code if password is "qrcode", otherwise with normal credentials
    if (this.logOnOptions.password == "qrcode") {
        this.session.startWithQR()
            .then((res) => {
                if (res.actionRequired) this._handleQRCode(res); // This *should* always be the case
            })
            .catch((err) => {
                if (err) this._handleQrCodeLoginError(err);
            });
    } else {
        this.session.startWithCredentials(this.logOnOptions)
            .then((res) => {
                if (res.actionRequired) this._handle2FA(res); // Let handle2FA helper handle 2FA if a code is requested
            })
            .catch((err) => {
                if (err) this._handleCredentialsLoginError(err); // Let handleCredentialsLoginError helper handle a login error
            });
    }

};


/* ------------ Reference helper functions to let the IntelliSense know about them ------------ */

/**
 * Internal: Attaches listeners to all steam-session events we care about
 */
sessionHandler.prototype._attachEvents = function() {};

/**
 * Internal: Handles submitting 2FA code
 * @param {StartSessionResponse} res Response object from startWithCredentials() promise
 */
sessionHandler.prototype._handle2FA = function(res) {}; // eslint-disable-line

/**
 * Internal: Helper function to get 2FA code from user and passing it to accept function or skipping account if desired
 */
sessionHandler.prototype._get2FAUserInput = function() {};

/**
 * Internal: Helper function to make accepting and re-requesting invalid steam guard codes easier
 * @param {string} code Input from user
 */
sessionHandler.prototype._acceptSteamGuardCode = function(code) {}; // eslint-disable-line

/**
 * Handles displaying a QR Code to login using the Steam Mobile App
 * @param {StartSessionResponse} res Response object from startWithQR() promise
 */
sessionHandler.prototype._handleQRCode = function(res) {}; // eslint-disable-line

/**
 * Helper function to make handling login errors easier
 * @param {*} err Error thrown by startWithCredentials()
 */
sessionHandler.prototype._handleCredentialsLoginError = function(err) {}; // eslint-disable-line

/**
 * Helper function to make handling login errors easier
 * @param {*} err Error thrown by startWithQR()
 */
sessionHandler.prototype._handleQrCodeLoginError = function(err) {}; // eslint-disable-line

/**
 * Internal - Attempts to get a token for this account from tokens.db and checks if it's valid
 * @param {function(string|null): void} callback Called with `refreshToken` (String) on success or `null` on failure
 */
sessionHandler.prototype._getTokenFromStorage = function(callback) {}; // eslint-disable-line

/**
 * Internal - Saves a new token for this account to tokens.db
 * @param {string} token The refreshToken to store
 */
sessionHandler.prototype._saveTokenToStorage = function(token) {}; // eslint-disable-line

/**
 * Remove the token of this account from tokens.db. Intended to be called from the steam-user login error event when an invalid token was used so the next login attempt will create a new one.
 */
sessionHandler.prototype.invalidateTokenInStorage = function() {};
