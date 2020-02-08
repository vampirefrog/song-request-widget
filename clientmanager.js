class ClientManager {
	constructor() {
		this.clients = [];
	}

	add(userId, ws) {
		if(!this.clients[userId])
			this.clients[userId] = [];

		this.clients[userId].push(ws);

		ws.on('close', (ev) => {
			for(let j in this.clients) {
				for(let i = 0; i < this.clients[j].length; i++) {
					if(this.clients[j][i] == ws) {
						this.clients[j].splice(i, 1);
						break;
					}
				}
			}
		});
	}

	send(c, msg) {
		try {
			c.send(JSON.stringify(msg));
		} catch(e) {
			console.error('Could not send to client', c, e);
		}
	}

	sendToAll(userId, msg, exclude) {
		if(this.clients[userId]) {
			for(let c of this.clients[userId]) {
				if(typeof exclude !== 'undefined' && c == exclude)
					continue;

				this.send(c, msg);
			}
		} else {
			console.error('Chat clients for user', userId, 'not found');
		}
	}
}

module.exports = ClientManager;
