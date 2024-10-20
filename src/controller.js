/*
 * File: controller.js
 * Project: steam-idler
 * Created Date: 2022-10-17 18:00:31
 * Author: 3urobeat
 *
 * Last Modified: 2024-10-20 18:48:21
 * Modified By: 3urobeat
 *
 * Copyright (c) 2022 - 2024 3urobeat <https://github.com/3urobeat>
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */


// Handles creating bot objects, providing them with data and relogging
const fs     = require("fs");
const https  = require("https");
const logger = require("output-logger");

const config = require("../config.json");

// Export both values to make them accessable from bot.js
module.exports.nextacc    = 0;
module.exports.relogQueue = []; // Queue tracking disconnected accounts to relog them after eachother with a delay

// Configure my logging lib
logger.options({
    msgstructure: `[${logger.Const.ANIMATION}] [${logger.Const.DATE} | ${logger.Const.TYPE}] ${logger.Const.MESSAGE}`,
    paramstructure: [logger.Const.TYPE, logger.Const.MESSAGE, "nodate", "remove", logger.Const.ANIMATION],
    outputfile: "./output.txt",
    exitmessage: "Goodbye!",
    printdebug: false
});


/**
 * Helper function to import login information from accounts.txt
 * @returns {Promise} logininfo object on success, bot is stopped on failure
 */
function importLogininfo() {
    return new Promise((resolve) => {
        logger("info", "Loading logininfo from accounts.txt...");

        let logininfo = {};

        // Import data from accounts.txt
        if (fs.existsSync("./accounts.txt")) {
            let data = fs.readFileSync("./accounts.txt", "utf8").split("\n");

            if (data.length > 0 && data[0].startsWith("//Comment")) data = data.slice(1); // Remove comment from array

            if (data != "") {
                logininfo = {}; // Set empty object

                data.forEach((e) => {
                    if (e.length < 2) return; // If the line is empty ignore it to avoid issues like this: https://github.com/3urobeat/steam-comment-service-bot/issues/80
                    e = e.split(":");
                    e[e.length - 1] = e[e.length - 1].replace("\r", ""); // Remove Windows next line character from last index (which has to be the end of the line)

                    // Format logininfo object and use accountName as key to allow the order to change
                    logininfo[e[0]] = {
                        accountName: e[0],
                        password: e[1],
                        sharedSecret: e[2],
                        steamGuardCode: null
                    };
                });

                logger("info", `Found ${Object.keys(logininfo).length} accounts in accounts.txt, not checking for logininfo.json...`, false, true, logger.animation("loading"));

                return resolve(logininfo);
            } else {
                logger("error", "No accounts found in accounts.txt! Aborting...");
                process.exit(1);
            }
        } else {
            logger("error", "No accounts found in accounts.txt! Aborting...");
            process.exit(1);
        }
    });
}

/**
 * Helper functions to import proxies from proxies.txt
 * @returns {Promise} proxies array on completion
 */
function importProxies() {
    return new Promise((resolve) => {
        let proxies = []; // When the file is just created there can't be proxies in it (this bot doesn't support magic)

        if (!fs.existsSync("./proxies.txt")) {
            resolve([ null ]);
        } else { // File does seem to exist so now we can try and read it
            proxies = fs.readFileSync("./proxies.txt", "utf8").split("\n");
            proxies = proxies.filter(str => str != ""); // Remove empty lines

            if (proxies.length > 0 && proxies[0].startsWith("//Comment")) proxies = proxies.slice(1); // Remove comment from array

            if (config.useLocalIP) proxies.unshift(null); // Add no proxy (local ip) if useLocalIP is true

            // Check if no proxies were found (can only be the case when useLocalIP is false)
            if (proxies.length == 0) {
                logger("", "", true);
                logger("error", "useLocalIP is turned off in config.json but I couldn't find any proxies in proxies.txt!\n        Aborting as I don't have at least one IP to log in with!", true);
                return process.exit();
            }
        }

        resolve(proxies);
    });
}

/**
 * Checks if an update is available from the GitHub repository and logs a message
 */
function checkForUpdate() {
    logger("info", "Checking for an available update...", false, true, logger.animation("loading"));

    let output = "";

    try {
        const localVersion = require("../package.json").version;

        const req = https.get("https://raw.githubusercontent.com/3urobeat/steam-idler/main/package.json", function(res) {
            res.setEncoding("utf8");

            res.on("data", (chunk) => {
                output += chunk;
            });

            res.on("end", () => {
                output = JSON.parse(output);
                const onlineVersion = output.version;

                if (onlineVersion && onlineVersion != localVersion) {
                    logger("", `${logger.colors.fggreen}Update available!${logger.colors.reset} Your version: ${logger.colors.fgred}${localVersion}${logger.colors.reset} | New version: ${logger.colors.fggreen}${onlineVersion}`, true);
                    logger("", "", true);
                    logger("", `Download it here and transfer your accounts.txt, config.json & proxies.txt:\n${logger.colors.fgcyan}${logger.colors.underscore}https://github.com/3urobeat/steam-idler/archive/refs/heads/main.zip`, true);
                    logger("", "", true);
                }
            });
        });

        req.on("error", function(err) {
            logger("warn", `${logger.colors.reset}[${logger.colors.fgred}Notice${logger.colors.reset}]: Couldn't check for an available update because either GitHub is down or your internet isn't working.\n          Error: ${err}`, true);
        });
    } catch (err) {
        logger("error", "Failed to check for an update: " + err, true);
    }
}


/* ------------ Login all accounts ------------ */
const allBots = [];

module.exports.start = async () => {
    global.logger = logger; // Make logger accessible from everywhere in this project

    logger("", "", true, true);
    logger("info", "steam-idler by 3urobeat v1.10\n");

    // Check for an update
    checkForUpdate();

    // Call helper function to import logininfo
    const logininfo = await importLogininfo();

    // Call helper function to import proxies
    const proxies = await importProxies();

    // Start creating a bot object for each account
    logger("", "", true);

    Object.values(logininfo).forEach((e, i) => {
        setTimeout(() => {

            const readycheckinterval = setInterval(() => {
                if (this.nextacc == i) { // Check if it is our turn
                    clearInterval(readycheckinterval);

                    // Create new bot object
                    const botfile = require("./bot.js");
                    const bot = new botfile(e, i, proxies);

                    bot.login();

                    allBots.push(bot);
                }
            }, 250);

        }, 1000);
    });
};

// Log playtime for all accounts on exit
process.on("exit", () => {
    allBots.forEach((e) => e.logPlaytimeToFile());
});
