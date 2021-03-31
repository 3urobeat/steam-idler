# steam-idler
Simple cross-platform Steam game idler.

### How to use:
Make sure to have [node.js](https://nodejs.org/) installed.  
Download this repository as `.zip`, extract the folder and open a Terminal/Power Shell/Console in the folder.  

Type `npm install` to install needed packages.  
Open the `config.json` in a text editor, put your username and password inside the brackets and the games you wan't to idle inside the `playingGames` brackets.  
  
The first brackets specify a custom game. You can leave the brackets empty to show no custom game status.  
The other numbers define the games the script will start playing. You can add more by adding a comma and the app id.  

### Start
Then just type `node idler.js` to start the script.  
The script will try to log in and ask you for your Steam Guard code if it needs one. When it is logged in a logged in message will be displayed.  

Thats it. A very simple cross-platform steam game idling script powered by [DoctorMcKay's steam-user library](https://github.com/DoctorMcKay/node-steam-user).
