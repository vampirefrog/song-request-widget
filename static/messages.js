var prevConsoleLog = console.log;
var prevConsoleError = console.error;

function appendMsg() {
	var div = document.createElement('div');
	var str = '';
	for(let i = 0; i < arguments.length; i++) {
		if(typeof arguments[i] == 'undefined')
			str += '<i>undefined</i> ';
		else if(arguments[i] === null)
			str += '<i>null</i> ';
		else if(typeof arguments[i] == 'string')
			str += arguments[i] + ' ';
		else if(arguments[i].toString)
			str += arguments[i].toString() + ' ';
		else
			str += '<pre>'+JSON.stringify(arguments[i]) + '</pre> ';
	}
	div.innerHTML = str;
	setTimeout(() => {
		var msgDiv = document.getElementById('messages');
		if(msgDiv)
			msgDiv.removeChild(div);
	}, 10000);
	return div;
}

function msg() {
	prevConsoleLog.apply(console, arguments);
	var div = appendMsg.apply(null, arguments);
	var msgDiv = document.getElementById('messages');
	if(msgDiv)
		msgDiv.appendChild(div);
}

function errorMsg() {
	prevConsoleError.apply(console, arguments);
	var div = appendMsg.apply(null, arguments);
	div.style.color = '#ff8080';
	var err = new Error();
	div.innerHTML += '<pre>'+escapeHtml(err.stack)+'</pre>';
	var msgDiv = document.getElementById('messages');
	if(msgDiv)
		msgDiv.appendChild(div);
}

console.log = msg;
console.error = errorMsg;
