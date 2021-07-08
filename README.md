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
  
The first brackets specify a custom game. You can leave the brackets empty to show no custom game status.  
The other numbers define the games the script will start playing. You can add more by adding a comma and the app id.  
  
If you want to appear online you can provide a number from [this list](https://github.com/DoctorMcKay/node-steam-user/blob/master/enums/EPersonaState.js) as `onlinestatus`.  
If set to `null` (default) the bot will not change your online status.  
  
To set a message that will be send on a recieved message while idling, set a message as `afkMessage`.  
Leave the brackets empty (like this: `""`) to not send any message back.  
  

### Start
Then just type `node idler.js` to start the script.  
The script will try to log in and ask you for your Steam Guard code if it needs one. When it is logged in a logged in message will be displayed.  

Thats it. A very simple cross-platform steam game idling script powered by [DoctorMcKay's steam-user library](https://github.com/DoctorMcKay/node-steam-user).
