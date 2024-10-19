/*
 * File: handleCredentialsLoginError.js
 * Project: steam-idler
 * Created Date: 2022-10-09 13:22:39
 * Author: 3urobeat
 *
 * Last Modified: 2024-10-19 14:10:05
 * Modified By: 3urobeat
 *
 * Copyright (c) 2022 - 2024 3urobeat <https://github.com/3urobeat>
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */


const { EResult } = require("steam-session");
const sessionHandler = require("../sessionHandler.js");


/**
 * Helper function to make handling login errors easier
 * @param {*} err Error thrown by startWithCredentials()
 */
sessionHandler.prototype._handleCredentialsLoginError = function(err) {

    // Log error message
    logger("", "", true);
    logger("error", `[${this.thisbot}] Couldn't log in! '${err}' (${err.eresult})`, true);
    logger("debug", err.stack, true);

    // Add additional messages for specific errors to hopefully help the user diagnose the cause
    if (err.eresult == EResult.InvalidPassword) logger("", `Note: The error "InvalidPassword" (${err.eresult}) can also be caused by a wrong Username or shared_secret!\n      Try omitting the shared_secret (if you provided one) and check the username & password of '${this.logOnOptions.accountName}' in account.txt!`, true);

    // Skips account
    this._resolvePromise(null);

};


/**
 * Helper function to make handling login errors easier
 * @param {*} err Error thrown by startWithQR()
 */
sessionHandler.prototype._handleQrCodeLoginError = function(err) {

    logger("error", `[${this.thisbot}] Failed to start a QR-Code session! Are you having connectivity issues to Steam? ${err}`);
    logger("debug", err.stack, true);

    this._resolvePromise(null); // Skips account

};
