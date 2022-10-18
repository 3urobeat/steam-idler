/*
 * File: handleCredentialsLoginError.js
 * Project: steam-idler
 * Created Date: 09.10.2022 13:22:39
 * Author: 3urobeat
 *
 * Last Modified: 18.10.2022 19:14:12
 * Modified By: 3urobeat
 *
 * Copyright (c) 2022 3urobeat <https://github.com/HerrEurobeat>
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */


const { EResult } = require("steam-session");
const sessionHandler = require("../sessionHandler.js");


// Helper function to make handling login errors easier
sessionHandler.prototype._handleCredentialsLoginError = function(err) {

    // Log error message
    logger("", "", true);
    logger("error", `[${this.thisbot}] Couldn't log in. ${err} (${err.eresult})`, true);

    // Add additional messages for specific errors to hopefully help the user diagnose the cause
    if (err.eresult == EResult.InvalidPassword) logger("", `Note: The error "InvalidPassword" (${err.eresult}) can also be caused by a wrong Username or shared_secret!\n      Try leaving the shared_secret field empty and check username & password.`, true);

    // Skips account
    this._resolvePromise(null);

};
