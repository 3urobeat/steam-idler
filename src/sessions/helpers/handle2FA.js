/*
 * File: handle2FA.js
 * Project: steam-idler
 * Created Date: 09.10.2022 12:59:31
 * Author: 3urobeat
 *
 * Last Modified: 18.10.2022 19:55:47
 * Modified By: 3urobeat
 *
 * Copyright (c) 2022 3urobeat <https://github.com/HerrEurobeat>
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */


const SteamSession = require("steam-session"); // Only needed for the enum definitions below

const sessionHandler = require("../sessionHandler.js");


/**
 * Internal - Handles submitting 2FA code
 * @param {Object} res Response object from startWithCredentials() promise
 */
sessionHandler.prototype._handle2FA = function(res) {

    logger("debug", `[${this.thisbot}] getRefreshToken(): Received startWithCredentials() actionRequired response. Type: ${res.validActions[0].type} | Detail: ${res.validActions[0].detail}`);

    // Get 2FA code/prompt confirmation from user, mentioning the correct source
    switch (res.validActions[0].type) {
        case SteamSession.EAuthSessionGuardType.EmailCode:          // Type 2
            logger("info", `Please enter the Steam Guard Code from your email address at ${res.validActions[0].detail}. Skipping automatically in 1.5 minutes if you don't respond...`, true);

            this._get2FAUserInput();
            break;

        case SteamSession.EAuthSessionGuardType.DeviceConfirmation: // Type 4 (more convenient than type 3, both can be active at the same time so we check for this one first)
            logger("info", "Please confirm this login request in your Steam Mobile App.", false, false, logger.animation("waiting"));
            break;

        case SteamSession.EAuthSessionGuardType.DeviceCode:         // Type 3
            logger("info", "Please enter the Steam Guard Code from your Steam Mobile App. Skipping automatically in 1.5 minutes if you don't respond...", true);

            this._get2FAUserInput();
            break;

        case SteamSession.EAuthSessionGuardType.EmailConfirmation:  // Type 5
            logger("info", "Please confirm this login request via the confirmation email sent to you.", false, false, logger.animation("waiting"));
            break;

        default: // Dunno what to do with the other types
            logger("error", `Failed to get login session! Unexpected 2FA type ${res.validActions[0].type} for account '${this.logOnOptions.accountName}'! Sorry, I need to skip this account...`);

            this._resolvePromise(null);
            return;
    }
};


// Helper function to get 2FA code from user and passing it to accept function or skipping account if desired
sessionHandler.prototype._get2FAUserInput = function() {

    let question = `[${this.logOnOptions.accountName}] Steam Guard Code (leave empty and press ENTER to skip account): `;
    let timeout = 90000;

    // Ask user for code
    logger.readInput(question, timeout, (text) => {
        if (!text || text == "") { // No response or manual skip
            if (text == null) logger("info", "Skipping account because you didn't respond in 1.5 minutes...", true); // No need to check for main acc as timeout is disabled for it

            logger("info", `[${this.thisbot}] steamGuard input empty, skipping account...`, false, true);

            this._resolvePromise(null);
        } else { // User entered code
            logger("info", `[${this.thisbot}] Accepting Steam Guard Code...`, false, true);
            this._acceptSteamGuardCode(text.toString().trim()); // Pass code to accept function
        }
    });
};


// Helper function to make accepting and re-requesting invalid steam guard codes easier
sessionHandler.prototype._acceptSteamGuardCode = function(code) {

    this.session.submitSteamGuardCode(code)
        .then(() => { // Success
            logger("debug", `[${this.thisbot}] acceptSteamGuardCode(): User supplied correct code, authenticated event should trigger.`);
        })
        .catch((err) => { // Invalid code, ask again
            logger("warn", `Your code seems to be wrong, please try again or skip this account! ${err}`);

            // Ask user again
            this._get2FAUserInput();
        });

};