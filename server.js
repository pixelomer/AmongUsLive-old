// Libraries
import express from 'express';
import {
	AmongusClient,
	ColourID,
	Int2Code
} from 'amongus-protocol';

/*
	=== HOW TO USE ===
	1) Start iproxy
	2) Start tcp-to-udp
	3) Start server.js
	4) Join a lobby
	4.1) If you fail in step 4, close iproxy, server.js and tcp-to-udp and go to step 1
	5) Open http://localhost:8081/index.html in your browser
	6) Hope that server.js doesn't crash
	
	NOTE: This tool can only be used if you aren't the host of the lobby.
*/

// Constants
const port = 8081;
const projectRoot = process.cwd();

// Express.js application
const app = express();

// State
var didGameStart = false;
var players = Array(12);
var gameCode = "";
var mapID = null;

// State file
app.use('/state', function(request,response) {
	response.send(JSON.stringify({players:players, gameCode:gameCode, mapID:mapID}));
});

// Static files
app.use('/:file', function(request,response) {
	response.sendFile(projectRoot + '/static/' + request.params.file);
});
app.use('/maps/:file', function(request,response) {
	response.sendFile(projectRoot + '/static/maps/' + request.params.file);
});
app.use('/players/:file', function(request,response) {
	response.sendFile(projectRoot + '/static/players/' + request.params.file);
});

// Start the Among Us client
const gameClient = new AmongusClient({ debug: false });
gameClient.on("disconnect", ()=>{
	console.log("==> Disconnected");
});
gameClient.on("connected", ()=>{
	console.log("==> Connected");
});
gameClient.connect("0.0.0.0", 42069, "pxOMR").then(()=>{
	// The game code doesn't matter, the real client never sends
	// the packets that are sent from the JS library
	gameClient.join(0, { doSpawn: false }).then((game)=>{
		console.log(`==> Joined game: ${gameCode = Int2Code(game.code)}`);
		game.on("setImposters", (imposters)=>{
			mapID = game.options.mapID;
			if (didGameStart) return;
			didGameStart = true;
			for (var i=0; i<12; i++) {
				players[i] = {
					name:null,
					x:0.0,
					y:0.0,
					dead:false
				};
			}
			game.on("meeting", ()=>{
				game.GameData.GameData.players.forEach((playerData)=>{
					players[playerData.colour].x = 0;
					players[playerData.colour].y = 0;
				});
			});
			game.on("playerLeave", (playerClient)=>{
				players[playerClient.PlayerData.colour].name = null;
			});
			console.log("Impostors:");
			imposters.forEach((player)=>{
				console.log(`- ${player.name}`);
			});
			game.awaitSpawns().then(()=>{
				setTimeout(()=>{
					console.log("\nAll players:");
					game.GameData.GameData.players.forEach((player)=>{
						players[player.colour].name = player.name;
						console.log(`- ${player.name} (${ColourID[player.colour]}, #${player.playerId})`);
						const playerClient = game.getPlayer(player.playerId);
						playerClient.Player.CustomNetworkTransform.on("move", (transform)=>{
							players[player.colour].x = transform.position.x;
							players[player.colour].y = transform.position.y;
						});
						playerClient.on("murdered", (murderer)=>{
							players[playerClient.PlayerData.colour].dead = true;
							players[playerClient.PlayerData.colour].name = null;
						});
					});
				}, 3000);
			});
		});
	});
});

// Run the HTTP server
const HTTPServer = app.listen(port, ()=>{
	console.log(`Among Us Live listening at http://localhost:${port}`)
});

process.on("SIGINT", ()=>{
	HTTPServer.close();
	process.exit();
});