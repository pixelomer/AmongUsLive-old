var currentMap = undefined;
var gameElement = undefined;
var gameContainer = undefined;
var isFetchingMessages = true;
var fetchIntervalID = undefined;
var insertedMessageCount = 0;
var lastState = {
	"players": {},
	"mapID": null,
	"gameCode": ""
};

const colors = [
  'red',
  'blue',
  'darkgreen',
  'pink',
  'orange',
  'yellow',
  'black',
  'white',
  'purple',
  'brown',
  'cyan',
  'lime'
];

const foregroundColorForMaps = {
	'skeld' : 'black',
	'mirahq' : 'black',
	'polus' : 'white'
};

const maps = [
	'skeld',
	'mirahq',
	'polus'
];

const mapCenters = {
	'skeld' : {x:0.59, y:0.26},
	'mirahq' : {x:0.289, y:0.875},
	'polus' : {x:0.0, y:0.1}
};

const mapMultipliers = {
	'skeld' : {x:0.8, y:0.94},
	'mirahq' : {x:0.9, y:1.1},
	'polus' : {x:0.9, y:1.0}
};

// ratio = width/height
const mapRatios = {
	'skeld' : 1.786,
	'mirahq' : 1.231,
	'polus' : 1.445
};

function parseNewState(newState) {
	if ((newState["mapID"] !== null) && (lastState["mapID"] !== newState["mapID"])) {
		setMap(maps[newState["mapID"]]);
	}
	if (!isFetchingMessages && (newState["messageCount"] > insertedMessageCount)) {
		isFetchingMessages = true;
		fetch(`/messages/range/${insertedMessageCount}/${newState["messageCount"]}`).then((data)=>data.json().then((data)=>{
			insertMessages(data["messages"]);
			isFetchingMessages = false;
		}));
	}
	lastState = newState;
	const gameCodeLabel = document.getElementById("gameCode");
	if ((gameCodeLabel !== null) && (gameCodeLabel.innerText !== newState["gameCode"])) {
		document.title = (lastState["gameCode"] === "") ? "Among Us Live" : ("Game " + lastState["gameCode"]);
		gameCodeLabel.innerText = lastState["gameCode"];
	}
	for (let i=0; i<10; i++) {
		const player = document.getElementById("player"+i);
		if (!(i in newState["players"])) {
			player.hidden = true;
			continue;
		}
		const value = newState["players"][i];
		const src = "players/"+colors[value["colour"]]+".png";
		player.style.opacity = value["dead"] ? 0.5 : 1.0;
		player.src = src;
		player.hidden = false;
		player.style.left = (
			(currentMap.width * mapCenters[currentMap.id].x)
			- (player.width / 2)
			+ (value["x"] * (player.width * mapMultipliers[currentMap.id].x))
		) + "px";
		player.style.top = (
			(currentMap.height * mapCenters[currentMap.id].y)
			- (player.height / 2)
			+ (-value["y"] * (player.height * mapMultipliers[currentMap.id].y))
		) + "px";
	}
	if (newState["finished"]) {
		clearInterval(fetchIntervalID);
	}
}

function handleLoad() {
	window.onresize = handleResize;
	gameElement = document.getElementById("game");
	gameContainer = document.getElementById("gameContainer");
	for (let i in maps) {
		const element = document.createElement("img");
		element.src = "maps/" + maps[i] + ".jpg";
		element.hidden = true;
		element.id = maps[i];
		element.classList.add("map");
		gameElement.appendChild(element);
	}
	for (let i=0; i<10; i++) {
		const element = document.createElement("img");
		element.src = "players/red.png";
		element.hidden = true;
		element.id = "player"+i;
		element.classList.add("player");
		gameElement.appendChild(element);
	}
	setMap(maps[0]);
	handleResize();
	const gameCodeLabel = document.createElement("p");
	gameCodeLabel.id = "gameCode";
	const boldLabel = document.createElement("b");
	gameElement.appendChild(boldLabel);
	boldLabel.appendChild(gameCodeLabel);
	setMap(maps[0]);
	fetchIntervalID = window.setInterval(function(){
		// Fetch and refresh
		fetch("/state").then((raw) => raw.json().then((data)=>{
			// Update player positions
			parseNewState(data);
		}));
	}, 100);
	fetch("/messages/all").then((raw) => raw.json().then((data)=>{
		insertMessages(data["messages"]);
		isFetchingMessages = false;
	}));
}

function setMap(name) {
	const newMap = document.getElementById(name);
	if (currentMap !== undefined) {
		currentMap.hidden = true;
		//while (currentMap.children.length) {
		//	newMap.appendChild(currentMap.lastElementChild)
		//}
	}
	const gameCodeLabel = document.getElementById("gameCode");
	if (gameCodeLabel !== null) {
		gameCodeLabel.style.color = foregroundColorForMaps[name];
	}
	newMap.hidden = false;
	currentMap = newMap;
	handleResize();
}

function insertMessages(messages) {
	const chat = document.getElementById("chat");
	messages.forEach((message)=>{
		insertedMessageCount++;
		const element = document.createElement("p");
		element.innerHTML = message.contents;
		element.className = "message";
		if (message.fromSystem) {
			element.innerHTML = "<i>" + element.innerHTML + "</i>";
			element.className += " systemMessage";
		}
		chat.appendChild(element);
		chat.scrollBy(0, Number.MAX_SAFE_INTEGER);
	});
}

function handleResize() {
	let mapHeight, mapWidth;
	let ratio = mapRatios[currentMap.id];
	let fakeWidth = window.innerWidth - 250.0;
	if (window.innerHeight > (fakeWidth / ratio)) {
		mapWidth = fakeWidth;
		mapHeight = fakeWidth / ratio;
	}
	else {
		mapHeight = window.innerHeight;
		mapWidth = window.innerHeight * ratio;
	}
	const gameCodeLabel = document.getElementById("gameCode");
	if (gameCodeLabel !== null) {
		gameCodeLabel.style.marginLeft = ((mapWidth / 100) * 1.25) + "px";
		gameCodeLabel.style.fontSize = ((mapWidth / 100) * 2.5) + "px";
	}
	gameContainer.style.width = fakeWidth+"px";
	gameElement.style.width = mapWidth+"px";
	gameElement.style.height = mapHeight+"px";
	parseNewState(lastState);
}