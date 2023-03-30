/*
 * File: controller.js
 * Project: steam-idler
 * Created Date: 17.10.2022 18:00:31
 * Author: 3urobeat
 *
 * Last Modified: 30.03.2023 15:06:27
 * Modified By: 3urobeat
 *
 * Copyright (c) 2022 3urobeat <https://github.com/HerrEurobeat>
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */


// Handles creating bot objects, providing them with data and relogging
const fs        = require("fs");
const logger    = require("output-logger");
const SteamTotp = require("steam-totp");

// Export both values to make them accessable from bot.js
module.exports.nextacc    = 0;
module.exports.relogQueue = []; // Queue tracking disconnected accounts to relog them after eachother with a delay

// Configure my logging lib
logger.options({
    msgstructure: `[${logger.Const.ANIMATION}] [${logger.Const.DATE} | ${logger.Const.TYPE}] ${logger.Const.MESSAGE}`,
    paramstructure: [logger.Const.TYPE, logger.Const.MESSAGE, "nodate", "remove", logger.Const.ANIMATION],
    outputfile: "./output.txt",
    exitmessage: "Goodbye!"
});


/**
 * Helper function to import login information from accounts.txt
 * @returns {Promise} logininfo object on success, bot is stopped on failure
 */
function importLogininfo() {
    return new Promise((resolve) => {
        logger("info", "Loading logininfo from accounts.txt...");

        var logininfo = {};

        // Either use logininfo.json or accounts.txt:
        if (fs.existsSync("./accounts.txt")) {
            var data = fs.readFileSync("./accounts.txt", "utf8").split("\n");

            if (data[0].startsWith("//Comment")) data = data.slice(1); // Remove comment from array

            data = data.filter(e => e.length > 0); // Remove empty lines to avoid issues like this: https://github.com/HerrEurobeat/steam-idler/issues/7

            if (data == "") {
                logger("error", "No accounts found in accounts.txt! Aborting...");
                process.exit(1);
            }

            data.forEach((e, i) => {
                if (e.length < 2) return; // If the line is empty ignore it to avoid issues like this: https://github.com/HerrEurobeat/steam-comment-service-bot/issues/80
                e = e.split(":");
                e[e.length - 1] = e[e.length - 1].replace("\r", ""); // Remove Windows next line character from last index (which has to be the end of the line)
                logininfo["bot" + i] = [e[0], e[1], e[2]];

                if (i == data.length - 1) resolve(logininfo); // Resolve promise with obj on last iteration
            });
        } else {
            logger("error", "No accounts found in accounts.txt! Aborting...");
            process.exit(1);
        }
    });
}


/* ------------ Login all accounts ------------ */
module.exports.start = async () => {
    global.logger = logger; // Make logger accessible from everywhere in this project

    logger("", "", true, true);
    logger("info", "steam-idler by 3urobeat v1.5\n");

    // Call helper function to import logininfo
    let logininfo = await importLogininfo();

    // Start creating a bot object for each account
    logger("", "", true);

    Object.values(logininfo).forEach((e, i) => {
        setTimeout(() => {

            var readycheckinterval = setInterval(() => {
                if (this.nextacc == i) { // Check if it is our turn
                    clearInterval(readycheckinterval);

                    // Construct logOnOptions obj which is passed to all bot objects
                    let logOnOptions = {
                        accountName: e[0],
                        password: e[1]
                    };

                    // If a shared secret was provided in the logininfo then add it to logOnOptions object
                    if (e[2] && e[2] != "") {
                        logOnOptions["twoFactorCode"] = SteamTotp.generateAuthCode(e[2]);
                        logOnOptions["sharedSecretForRelog"] = e[2]; // Add raw shared_secret to obj as well to be able to access it from disconnected event
                    }

                    // Create new bot object
                    let botfile = require("./bot.js");
                    let bot = new botfile(logOnOptions, i, logger);

                    bot.login();
                }
            }, 250);
        }, 1000);
    });

};