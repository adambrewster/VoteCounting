function notEmpty(x) { return x != ""; }
function splitNames(input) { return input.toLowerCase().split(/[ -,.]/).filter(notEmpty); }

function PrefixSearch() {
	var wprefix = this.wprefix = new Map();
	var prefix = this.prefix = new Map();
	var exact  = this.exact  = new Map();

	function addSorted(aa, k, v) {
		if (aa.has(k))
			aa.get(k).add(v);
		else
			aa.set(k, new Set([v]));
	}

	this.addNickname = function(nick, name, value) { addSorted(exact, nick.toLowerCase(), value); }

	this.addPrefixes = function(name, value) {
		addSorted(exact, name.toLowerCase(), value);
		splitNames(name).map(function (word) {
			for (var ii = 1; ii < word.length+1; ii++) {
				addSorted(wprefix, word.substring(0, ii), word);
				addSorted(prefix, word.substring(0, ii), value);
			}
		});
	};

	this.lookup = function(key) {
		key = key.toLowerCase();
		if (exact.has(key)) return Array.from(exact.get(key));
		var words = splitNames(key);
		if (!words || !words.length || !prefix.get(words[0])) return [];
		var allMatch = Array.from(prefix.get(words[0]));
		for (var ii = 1; ii < words.length; ii++) {
			var match = prefix.get(words[ii]);
			if (!match) return [];
			allMatch = allMatch.filter(function (x) {return match.has(x);});
		}
		allMatch.sort();
		return allMatch;
	};

	this.getShortest = function(key) {
		key = key.toLowerCase();
		for (var i = 1; i < key.length+1; i++) {
			var ss = key.substring(0, i);
			if (wprefix.get(ss).size == 1) return ss;
		}
		return key;
	};
}


function Watcher(timeout) {
	var timer;
	var fns = [];

	this.timer = timer;
	this.fns = fns;

	this.fire = function() {
		timer = undefined;
		for (var fn in fns) fns[fn]();
	};

	var fire = this.fire;

	this.addCallback = function(fn) {
		fns.push(fn);
	};
	this.addInput = function(element) {
		element.addEventListener("input", function() {
			if (timer) clearTimeout(timer);
			timer = setTimeout(fire, timeout);
		})
	};
}

var setupWatcher = new Watcher(200);
var nomineeWatcher = new Watcher(200);
var ballotWatcher = new Watcher(200);

function addNominee() {
	//<tr><td><input size=5></td><td><input size=35></td></tr>
	var row = document.createElement("tr");

	var td = [];
	for (var ii = 0; ii < 3; ii++) {
		td.push(document.createElement("td"));
		row.appendChild(td[ii]);
	}

	var i1 = document.createElement("input");
	i1.setAttribute("size", 5);
	nomineeWatcher.addInput(i1);
	td[0].appendChild(i1);

	var i2 = document.createElement("input");
	i2.setAttribute("size", 35);
	nomineeWatcher.addInput(i2);
	td[1].appendChild(i2);

	var nomineeTable = document.getElementById("nominees");
	nomineeTable.appendChild(row);
}

function addBallot() {
	var ballotTable = document.getElementById("ballots");

	var row = document.createElement("tr");

	var td = [];
	td.push(document.createElement("th"));
	td[0].innerText = ballotTable.children.length+1;
	row.appendChild(td[0]);

	for (var ii = 1; ii < 3; ii++) {
		td.push(document.createElement("td"));
		row.appendChild(td[ii]);
	}

	var i1 = document.createElement("textarea");
	i1.setAttribute("cols", 35);
	i1.setAttribute("rows", parseInt(document.getElementById("num_inp").value)+1);
	ballotWatcher.addInput(i1);
	td[1].appendChild(i1);

	td[2].innerText = "(blank)";

	ballotTable.appendChild(row);
}

function updateSetup() {
	var ballotTable = document.getElementById("ballots");
	var rows = parseInt(document.getElementById("num_inp").value)+1;
	for (var ii = 0; ii < ballotTable.children.length; ii++) {
		var tr = ballotTable.children[ii];
		tr.children[1].children[0].setAttribute("rows", rows);
	}
}

var prefixes;
var nominees;

function updateNominees() {
	prefixes = new PrefixSearch();
	nominees = [];

	var blanks = 0;

	var nomineeTable = document.getElementById("nominees");
	for (var ii = 0; ii < nomineeTable.children.length; ii++) {
		var tr = nomineeTable.children[ii];
		var alias = tr.children[0].children[0].value;
		var name = tr.children[1].children[0].value;
		if (!name) { blanks += 1; continue; }
		if (alias) prefixes.addNickname(alias, ii);
		prefixes.addPrefixes(name, ii);
		nominees.push(name);
	}

	for (var ii = 0; ii < nomineeTable.children.length; ii++) {
		var tr = nomineeTable.children[ii];
		var name = tr.children[1].children[0].value;
		if (!name) { tr.children[2].innerText = ""; continue; }
		tr.children[2].innerText = splitNames(name).map(prefixes.getShortest).join(', ')
	}

	while (blanks++ < 3) addNominee();
}

function parseBallot(text) {
	var ballot = [];
	votes = text.split("\n");
	for (var jj = 0; jj < votes.length; jj++) {
		if (votes[jj] == "") continue;
		var s = new Set();
		var names = prefixes.lookup(votes[jj].trim());
		for (var mm = 0; mm < names.length; mm++) s.add(names[mm]);
		ballot.push(s);
	}

	return ballot;
}

function updateBallots() {
	var ballotTable = document.getElementById("ballots");
	var blanks = 0;

	var num_to_elect = document.getElementById("num_inp").value;
	var blt = nominees.length + " " + num_to_elect + "\n";

	for (var ii = 0; ii < ballotTable.children.length; ii++) {
		var tr = ballotTable.children[ii];
		var ballot = tr.children[1].children[0].value;
		var display = tr.children[2];
		display.innerHTML = "";
		if (!ballot) { blanks += 1; display.innerText = "(blank)"; continue;}
		ballot = parseBallot(ballot);
		var line = "1";
		ballot.forEach(function (name) {
			name = Array.from(name);
			name.sort();
			if (name.length == 0) display.innerHTML += "- (no match)<br>";
			else display.innerHTML += "- " + name.map(function(jj) { return nominees[jj]; }).join(" | ") + "<br>";
			if (line && name.length == 1) line += " " + (name[0] + 1);
			else line = ""
		});
		if (line) blt += line + " 0\n";
	}
	blt += "0\n";

	for (var ii = 0; ii < nominees.length; ii++) {
		blt += "\"" + nominees[ii] + "\"\n";
	}
	blt += "\"" + document.getElementById("header_inp").value + "\"";

	while (blanks++ < 3) addBallot();

	document.getElementById("blt").innerHTML = blt;
}

function submitBallots() {
	var blt = JSON.stringify({ "method" : "wilson STV" , "blt": document.getElementById("blt").innerHTML });
	var xhr = new XMLHttpRequest();
	xhr.open("POST", "https://www.opavote.com/api/v1/counts?key=aQu5fY8OSeG-g5oBTOLFFg");
	xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
	xhr.onreadystatechange = function () {
		console.log(xhr);
		if (xhr.readyState === XMLHttpRequest.DONE) { console.log(xhr.responseText); }
	};
	xhr.send(blt);
}

setupWatcher.addCallback(updateSetup);
setupWatcher.addCallback(updateNominees);
setupWatcher.addCallback(updateBallots);

nomineeWatcher.addCallback(updateNominees);
nomineeWatcher.addCallback(updateBallots);

ballotWatcher.addCallback(updateBallots);

window.addEventListener('load', function() {
	setupWatcher.addInput(document.getElementById("num_inp"));
	setupWatcher.addInput(document.getElementById("header_inp"));
	setupWatcher.fire();
}, false);

window.addEventListener("beforeunload", function(event) {
	event.returnValue = "Leaving the page will discard the results that have been entered.";
	return event.returnValue;
});
