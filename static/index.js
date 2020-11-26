var currentMap = undefined;
var container = undefined;
var isFetchingMessages = true;
var insertedMessageCount = 0;
var lastState = {
	"players": {},
	"mapID": null,
	"gameCode": ""
};

const colors = [
  'red',
  'blue',
  'green',
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
	'skeld' : {x:0.59, y:0.28},
	'mirahq' : {x:0.289, y:0.852},
	'polus' : {x:0.0, y:0.1}
};

const mapMultipliers = {
	'skeld' : {x:0.8, y:0.75},
	'mirahq' : {x:0.9, y:0.85},
	'polus' : {x:0.9, y:0.84}
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
}

function onShowHideClick(event) {
	const messageBox = document.getElementById("messageBox");
	const messageBoxButton = document.getElementById("messageBoxButton");
	if (messageBox.style.display !== "none") {
		messageBox.style.display = "none";
		messageBoxButton.firstChild.innerText = "Show Messages";
		messageBoxButton.style.borderTopWidth = "0px";
		messageBoxButton.style.borderTopLeftRadius = "10px";
		messageBoxButton.style.borderTopRightRadius = "10px";
	}
	else {
		messageBox.style.display = "";
		messageBoxButton.firstChild.innerText = "Hide Messages";
		messageBoxButton.removeAttribute("style");
	}
}

function handleLoad() {
	window.onresize = handleResize;
	container = document.getElementById("container");
	for (let i in maps) {
		const element = document.createElement("img");
		element.src = "maps/" + maps[i] + ".png";
		element.hidden = true;
		element.id = maps[i];
		element.classList.add("map");
		container.appendChild(element);
	}
	for (let i=0; i<10; i++) {
		const element = document.createElement("img");
		element.src = "players/red.png";
		element.hidden = true;
		element.id = "player"+i;
		element.classList.add("player");
		element.style.objectFit = "contain";
		container.appendChild(element);
	}
	setMap(maps[0]);
	handleResize();
	const messageBox = document.createElement("div");
	const messageBoxButton = document.createElement("div");
	messageBoxButton.id = "messageBoxButton";
	messageBoxButton.onclick = onShowHideClick;
	messageBox.id = "messageBox";
	const messageBoxButtonText = document.createElement("p");
	messageBoxButtonText.innerText = "Hide Messages";
	messageBoxButtonText.onselectstart = ()=>{return false};
	container.appendChild(messageBox);
	container.appendChild(messageBoxButton);
	messageBoxButton.appendChild(messageBoxButtonText);
	const gameCodeLabel = document.createElement("p");
	gameCodeLabel.id = "gameCode";
	const boldLabel = document.createElement("b");
	container.appendChild(boldLabel);
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
	const messageBox = document.getElementById("messageBox");
	messages.forEach((message)=>{
		insertedMessageCount++;
		const element = document.createElement("p");
		element.innerHTML = message.contents;
		element.className = "message";
		if (message.fromSystem) {
			element.innerHTML = "<i>" + element.innerHTML + "</i>";
			element.className = " systemMessage";
		}
		messageBox.appendChild(element);
		messageBox.scrollBy(0, Number.MAX_SAFE_INTEGER);
	});
}

function handleResize() {
	let mapHeight, mapWidth;
	let ratio = mapRatios[currentMap.id];
	if (window.innerHeight > (window.innerWidth / ratio)) {
		mapWidth = window.innerWidth;
		mapHeight = window.innerWidth / ratio;
	}
	else {
		mapWidth = window.innerHeight * ratio;
		mapHeight = window.innerHeight;
	}
	const gameCodeLabel = document.getElementById("gameCode");
	if (gameCodeLabel !== null) {
		gameCodeLabel.style.marginLeft = ((mapWidth / 100) * 1.25) + "px";
		gameCodeLabel.style.fontSize = ((mapWidth / 100) * 2.5) + "px";
	}
	const elements = document.getElementsByTagName("img");
	container.style.width = mapWidth+"px";
	container.style.height = mapHeight+"px";
	for (let i=0; i<elements.length; i++) {
		if (elements[i].classList.contains("player")) {
			elements[i].width = mapWidth / 37;
			elements[i].height = mapWidth / 37;
		}
		else if (elements[i].classList.contains("map")) {
			elements[i].width = mapWidth;
			elements[i].height = mapHeight;
		}
	}
	parseNewState(lastState);
}