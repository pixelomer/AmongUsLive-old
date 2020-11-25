var currentMap = undefined;
var container = undefined;

var lastState = {
	"players": [],
	"mapID": null,
	"gameCode": ""
};

let colors = [
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

let maps = [
	'skeld',
	'mirahq',
	'polus'
];

let mapCenters = {
	'skeld' : {x:0.59, y:0.28},
	'mirahq' : {x:0.289, y:0.852},
	'polus' : {x:0.5, y:0.1}
};

let mapMultipliers = {
	'skeld' : {x:0.8, y:0.75},
	'mirahq' : {x:0.9, y:0.85},
	'polus' : {x:0.8, y:0.75}
};

// ratio = width/height
let mapRatios = {
	'skeld' : 1.786,
	'mirahq' : 1.231,
	'polus' : 1.445
};

function parseNewState(newState) {
	if ((newState["mapID"] !== null) && (lastState["mapID"] !== newState["mapID"])) {
		setMap(maps[newState["mapID"]]);
	}
	lastState = newState;
	for (var i=0; (i<lastState["players"].length) && (i<colors.length); i++) {
		if (lastState["players"][i] === null) continue;
		document.title = (lastState["gameCode"] === "") ? "Among Us Live" : ("Game " + lastState["gameCode"]);
		let player = document.getElementById(colors[i]);
		if (lastState["players"][i]["name"] === null) {
			player.hidden = true;
			continue;
		}
		player.hidden = false;
		player.style.left = (
			(currentMap.width * mapCenters[currentMap.id].x)
			- (player.width / 2)
			+ (lastState["players"][i]["x"] * (player.width * mapMultipliers[currentMap.id].x))
		) + "px";
		player.style.top = (
			(currentMap.height * mapCenters[currentMap.id].y)
			- (player.height / 2)
			+ (-lastState["players"][i]["y"] * (player.height * mapMultipliers[currentMap.id].y))
		) + "px";
	}
}

function handleLoad() {
	window.onresize = handleResize;
	container = document.getElementById("container");
	var gameCodeLabel = document.createElement("p");
	gameCodeLabel.style.top = 0;
	gameCodeLabel.style.left = 0;
	gameCodeLabel.id = "gameCode";
	gameCodeLabel.style.fontFamily = "Arial";
	gameCodeLabel.style.fontSize = "15px";
	//container.appendChild(gameCodeLabel);
	for (var i in maps) {
		var element = document.createElement("img");
		element.src = "maps/" + maps[i] + ".png";
		element.hidden = true;
		element.id = maps[i];
		element.classList.add("map");
		container.appendChild(element);
	}
	setMap(maps[0]);
	for (var i in colors) {
		var element = document.createElement("img");
		element.src = "players/" + colors[i] + ".png";
		element.hidden = true;
		element.id = colors[i];
		element.classList.add("player");
		element.style.objectFit = "contain";
		container.appendChild(element);
	}
	handleResize();
	window.setInterval(function(){
		// Fetch and refresh
		fetch("state").then((raw) => raw.json().then(function(data){
			// Update player positions
			parseNewState(data);
		}));
	}, 100);
}

function setMap(name) {
	var newMap = document.getElementById(name);
	if (currentMap !== undefined) {
		currentMap.hidden = true;
		//while (currentMap.children.length) {
		//	newMap.appendChild(currentMap.lastElementChild)
		//}
	}
	newMap.hidden = false;
	currentMap = newMap;
	handleResize();
}

function handleResize() {
	var mapHeight, mapWidth;
	let ratio = mapRatios[currentMap.id];
	if (window.innerHeight > (window.innerWidth / ratio)) {
		mapWidth = window.innerWidth;
		mapHeight = window.innerWidth / ratio;
	}
	else {
		mapWidth = window.innerHeight * ratio;
		mapHeight = window.innerHeight;
	}
	var elements = document.getElementsByTagName("img");
	container.style.width = mapWidth;
	container.style.height = mapHeight;
	for (var i=0; i<elements.length; i++) {
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