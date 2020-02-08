function ChatSocket(wsUri, key) {
	EventEmitter.call(this);

	this.wsUri = wsUri;
	this.key = key;

	this.openWebSocket();
}

ChatSocket.prototype = Object.create(EventEmitter.prototype);

ChatSocket.prototype.openWebSocket = function() {
	console.log('Opening websocket', this.wsUri);
	this.websocket = new WebSocket(this.wsUri);
	this.websocket.addEventListener('open', (evt) => {
		this.websocket.send(JSON.stringify({
			type: 'connect',
			key: this.key
		}));
	});
	this.websocket.addEventListener('close', (evt) => {
		console.log('Websocket closed, reopening in 1s');
		setTimeout(() => this.openWebSocket(), 1000);
	});
	this.websocket.addEventListener('error', (evt) => {
		errorMsg(evt);
	});
	this.websocket.addEventListener('message', (evt) => {
		var data = null;
		try {
			data = JSON.parse(evt.data);
		} catch(e) {
			errorMsg('Error parsing JSON', e.message);
		}
		if(data && data.error)
			errorMsg(data.error);
		else if(data)
			this.emit(data.type, data.data);
	});
};

ChatSocket.prototype.send = function(type, data) {
	this.websocket.send(JSON.stringify({
		key: this.key,
		type: type,
		data: data
	}));
};
