# steam-idler
Simple cross-platform Steam game idler with multi account support.

### How to use:
Make sure to have [node.js](https://nodejs.org/) installed.  
Download this repository as `.zip`, extract the folder and open a Terminal/Power Shell/Console in the folder.  

Type `npm install` to install needed packages.  

## Accounts
Open the accounts.txt file and put an account in each line in this format: `username:password:shared_secret`.  
`shared_secret` is optional. Only provide `username:password` if you don't want to use it.  
  
## Config
Open the `config.json` in a text editor and put the games you wan't to idle inside the `playingGames` brackets.  

You can set a custom game by passing a String as the first argument.  
The other numbers define the games the script will start playing. You can add more by adding a comma and the app id.  

&nbsp;

Examples:  
- Display "In non-Steam game: Minecraft" and idle TF2 & CS:GO: `"playingGames": ["Minecraft", 440, 730]`  
- Display "Currently In-Game: Team Fortress 2" and idle TF2 & CS:GO: `"playingGames": [440, 730]`  
- Only appear as online and don't idle anything: `"playingGames": []`  
  
&nbsp;
  
To set a different online status you can choose a number from [this list](https://github.com/DoctorMcKay/node-steam-user/blob/master/enums/EPersonaState.js) and provide it at `onlinestatus`.  
If set to `null` the bot will not change your online status.  
  
To set a message that will be send on a recieved message while idling, set a message as `afkMessage`.  
Leave the brackets empty (like this: `""`) to not send any message back.  

The loginDelay and relogDelay values control the time waited between logging in multiple accounts and the time waited before a relog is attempted after an account lost connection.  
I recommend not touching them as they have good defaults to avoid cooldowns, however if you know what you are doing - they are there.  
  

### Start
Then just type `node idler.js` to start the script.  
The script will try to log in and ask you for your Steam Guard code if it needs one. When it is logged in a logged in message will be displayed.  

Thats it. A very simple cross-platform steam game idling script powered by [DoctorMcKay's steam-user library](https://github.com/DoctorMcKay/node-steam-user).
