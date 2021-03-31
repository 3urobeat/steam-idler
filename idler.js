const SteamUser = require('steam-user');
const config = require("./config.json");
const bot = new SteamUser();

var logOnOptions = {
    accountName: config.username,
    password: config.password
};

bot.logOn(logOnOptions) //log in with logOnOptions

bot.on('loggedOn', () => { //this account is now logged on
    console.log("Simple steam-idler by 3urobeat v1.0")
    console.log("Logged in and idling games.")

    bot.gamesPlayed(config.playingGames) //start playing games
});
