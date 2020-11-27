// Libraries
import express from 'express';
import {
	AmongusClient,
	ColourID,
	GameEndReason,
	Int2Code
} from 'amongus-protocol';

const enumDescriptions = {};
enumDescriptions[GameEndReason.HumansByTask] = "Crewmates won by completing all of the tasks.";
enumDescriptions[GameEndReason.HumansByVote] = "Crewmates won by ejecting the last impostor.";
enumDescriptions[GameEndReason.HumansDisconnect] = "Crewmates won because the last impostor disconnected.";
enumDescriptions[GameEndReason.ImposterByKill] = "Impostors won by killing a crewmate.";
enumDescriptions[GameEndReason.ImposterBySabotage] = "Impostors won because a sabotage wasn't fixed.";
enumDescriptions[GameEndReason.ImposterByVote] = "Impostors won by ejecting a crewmate.";
enumDescriptions[GameEndReason.ImposterDisconnect] = "Impostors won because a crewmate disconnected.";

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
var players = {};
var gameCode = "";
var didGameFinish = false;
var mapID = null;
var gameCompletionState = 0;
var messages = Array();

function getHTMLForPlayer(player, showDead = false) {
	if ((player === null) || (player === undefined)) {
		return "<b>(unknown)<b>";
	}
	let name = player.name ?? "";
	name = name.trim();
	let colorName = ColourID[player.colour ?? ColorID.Black];
	if (name === "") {
		name = colorName;
	}
	name = "";
	if (showDead && player.dead) {
		name += " (dead)";
	}
	name = `<img class="chatImage" src="players/${colorName.toLowerCase()}.png"></img> <b>${name}</b>`;
	return name;
}

function addMessage(HTMLContents, isSystemMessage) {
	messages.push({
		id:messages.length,
		contents:HTMLContents,
		fromSystem:isSystemMessage,
		date:Date.now()
	});
}

addMessage("Among Us Live has started up.", true);

// State file
app.use('/state', function(request,response) {
	response.send(JSON.stringify({
		players:players,
		gameCode:gameCode,
		mapID:mapID,
		state:gameCompletionState,
		messageCount:messages.length,
		finished:didGameFinish
	}));
});

// Messages
app.use('/messages/all', function(request,response) {
	response.send(JSON.stringify({
		messages:messages
	}));
});
app.use('/messages/range/:start/:end', function(request,response) {
	if (!(/^\d+$/.test(request.params.start)) || !(/^\d+$/.test(request.params.end))) {
		response.statusCode = 400;
		return;
	}
	const messagesLength = messages.length;
	const start = request.params.start;
	const length = request.params.end - start + 1; // inclusive
	let requestedMessages;
	if (length <= 0) {
		response.statusCode = 404;
		requestedMessages = Array();
	}
	else {
		if ((start + length) > messagesLength) {
			requestedMessages = messages.slice(start);
		}
		else {
			requestedMessages = messages.slice(start, start + length);
		}
	}
	response.send(JSON.stringify({
		more:(messagesLength > (start + length)),
		messages:requestedMessages
	}));
});
app.use('/message/id/:messageID', function(request,response) {
	if (!(/^\d+$/.test(request.params.messageID))) {
		response.statusCode = 400;
		return;
	}
	let requestedMessage;
	if (request.params.messageID > messages.length) {
		response.statusCode = 404;
		requestedMessage = null;
	}
	else {
		requestedMessage = messages[request.params.messageID];
	}
	response.send(JSON.stringify({
		more:(request.params.messageID < messages.length),
		message:requestedMessage
	}));
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
	addMessage("Disconnected from the server.", true);
	console.log("==> Disconnected");
});
gameClient.on("connected", ()=>{
	addMessage("Connected to the server.", true);
	console.log("==> Connected");
});
gameClient.connect("0.0.0.0", 42069, "pxOMR").then(()=>{
	// The game code doesn't matter, the real client never sends
	// the packets that are sent from the JS library
	gameClient.join(0, { doSpawn: true }).then((game)=>{
		console.log(`==> Joined game: ${gameCode = Int2Code(game.code)}`);
		addMessage(`Joined the game with code ${gameCode}.`, true);
		game.on("setImposters", (imposters)=>{
			mapID = game.options.mapID;
			if (didGameStart) return;
			didGameStart = true;
			let impostorMessage = (imposters.length === 1) ? "The impostor is " : "The impostors are";
			console.log("Impostors:");
			imposters.forEach((player, index)=>{
				console.log(`* ${player.name}`);
				impostorMessage += ` ${getHTMLForPlayer(player.PlayerData)}`;
				if ((imposters.length > 1) && (index === (imposters.length - 2))) {
					impostorMessage += " and";
				}
				else if ((index + 1) !== imposters.length) {
					impostorMessage += ",";
				}
			});
			impostorMessage += ".";
			addMessage(impostorMessage, true);
			console.log("\nAll players:");
			game.on("finish", (reason, shouldShowAd)=>{
				addMessage(enumDescriptions[reason] || "The game finished.", true);
				didGameFinish = true;
			});
			let allPlayersMessage = "The crewmates are";
			game.GameData.GameData.players.forEach((player)=>{
				if (!imposters.some((value) => (player.playerId == value.PlayerData.playerId))) {
					allPlayersMessage += ` ${getHTMLForPlayer(player)},`;
				}
				players[player.playerId] = {
					name: player.name,
					colour: player.colour,
					dead: false,
					x: 0.0,
					y: 0.0
				};
				players[player.playerId].name = player.name;
				console.log(`* ${player.name} (${ColourID[player.colour]}, #${player.playerId})`);
				const playerClient = game.getClientByPlayerID(player.playerId) || game.getClientByName(player.name);
				if ((playerClient !== undefined) && (playerClient !== null)) {
					playerClient.awaitSpawn().then((spawnedPlayer)=>{
						spawnedPlayer.CustomNetworkTransform.on("move", (transform)=>{
							if (player.playerId in players) {
								const currentPlayer = game.getClientByPlayerID(player.playerId);
								if (currentPlayer !== null) {
									const currentPlayerData = currentPlayer.PlayerData;
									if (currentPlayerData !== null) {
										players[player.playerId].colour = currentPlayerData.colour;
									}
								}
								players[player.playerId].x = transform.position.x;
								players[player.playerId].y = transform.position.y;
							}
						});
					});
				}
				else {
					console.log("'-* WARNING: Player object was null, not initializing");
				}
			});
			allPlayersMessage = `${allPlayersMessage.substr(0, allPlayersMessage.length - 1)}.`;
			addMessage(allPlayersMessage, true);
		});
		game.on("murder", (murderer, victim)=>{
			addMessage(`${getHTMLForPlayer(victim.PlayerData)} was murdered by ${getHTMLForPlayer(murderer.PlayerData)}.`, true);
			if ((victim.PlayerData !== null) && (victim.PlayerData !== undefined)) {
				if (victim.PlayerData.playerId in players) {
					players[victim.PlayerData.playerId].dead = true;
				}
			}
		});
		game.on("meeting", (emergency, reportedPlayer)=>{
			if (!emergency && (reportedPlayer !== null) && (reportedPlayer !== undefined)) {
				addMessage(`The corpse of ${getHTMLForPlayer(reportedPlayer.PlayerData)} was reported.`, true);
			}
			else {
				addMessage(`An emergency meeting was called.`, true);
			}
			game.GameData.GameData.players.forEach((playerData)=>{
				if (playerData.playerId in players) {
					players[playerData.playerId].x = 0;
					players[playerData.playerId].y = 0;
				}
			});
		});
		game.on("votingComplete", (skipped, tie, ejectedPlayer)=>{
			if (!skipped && !tie && (ejectedPlayer !== null) && (ejectedPlayer !== undefined)) {
				addMessage(`${getHTMLForPlayer(ejectedPlayer.PlayerData)} was ${ejectedPlayer.PlayerData.imposter ? "" : "not "}${(game.imposters.length > 1) ? "An" : "The"} Impostor.`, true);
				players[ejectedPlayer.PlayerData.playerId].dead = true;
			}
			else {
				addMessage(`No one was ejected.${tie ? " (Tie)" : (skipped ? " (Skipped)" : "")}`, true);
			}
		});
		/*
		// Sometimes causes a crash, even when it doesn't crash it doesn't always trigger
		game.on("vote", (voter, suspect)=>{
			if ((suspect === undefined) || (suspect === null)) {
				addMessage(`<b>${voter.name}</b> voted to skip`, true);
			}
			else {
				addMessage(`<b>${voter.name}</b> voted to eject <b>${suspect.name}</b>`, true);
			}
		});
		*/
		game.on("playerLeave", (playerClient)=>{
			addMessage(`${getHTMLForPlayer(playerClient.PlayerData)} left the game.`, true);
			if (playerClient.PlayerData.playerId in players) {
				delete players[playerClient.PlayerData.playerId];
			}
		});
		/*
		// Causes a crash for some reason
		game.on("playerJoin", (playerClient)=>{
			addMessage(`<b>${playerClient.PlayerData.name}</b> joined the game.`, true);
		});
		*/
		game.on("start", ()=>{
			addMessage(`The game started.`, true);
		});
		game.on("chat", (client, message)=>{
			addMessage(`${getHTMLForPlayer(client.PlayerData, true)}<b>:</b> ${message}`, false);
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