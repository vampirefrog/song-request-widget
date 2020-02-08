const Chat = require('./Chat');
const WebSocket = require('ws');

class TwitchChat extends Chat {
	constructor() {
		super();

		this.state = 'none';
		this.waitConnectionCallbacks = [];
		this.users = {};

		this.webSocket = new WebSocket('wss://irc-ws.chat.twitch.tv/');

		this.webSocket.on('open', () => {
			this.webSocket.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
			this.webSocket.send('PASS SCHMOOPIIE');
			this.webSocket.send('NICK justinfan5555');
			this.webSocket.send('USER justinfan5555 8 * :justinfan5555');
			this.emit('open');
		});

		this.webSocket.on('message', (message) => {
			var lines = message.replace(/\s+$/, '').split('\r\n');
			for(var l of lines) {
				if(!l || typeof l == 'undefined')
					continue;

				let match = l.match(/^(@([^ ]+) )?:([^ ]+) ([^ ]+) ([^ ]+)( (([^ ]+) )?:(.*))?$/);
				if(match) {
					let vars = {};
					if(match[2]) {
						let pairs = match[2].split(';');
						for(let v in pairs) {
							let m = pairs[v].match(/^([^=]+)=(.*)$/);
							vars[m[1]] = m[2];
						}
					}
					let senderMatch = match[3].match(/^(.*?)!(.*?)@(.*?)$/);
					let msg = {
						varString: match[2],
						vars: vars,
						sender: senderMatch ? { nick: senderMatch[1], user: senderMatch[2], server: senderMatch[3] } : null,
						senderStr: match[3],
						code: match[4],
						target: match[5],
						cmd: match[7],
						text: match[9]
					};
					this.emit('message', msg);

					switch(msg.code) {
						case '001':
							this.serverName = msg.sender;
							this.state = 'connected';
							this.emit('connected');
							for(let cb of this.waitConnectionCallbacks)
								cb();
							this.waitConnectionCallbacks = null;
							setInterval(() => {
								this.webSocket.send('PING');
							}, 60 * 1000);
							break;
						case 'PRIVMSG':
							this.emit('chat', {
								data: this.users[msg.target.replace(/^#/, '')],
								username: msg.sender.user,
								displayName: msg.vars['display-name'] || msg.sender.nick || msg.sender.user,
								text: msg.text
							});
							break;
						default:
							// console.log("unhandled code", msg);
					}
				} else {
					// console.error('unmatched message', l);
				}
			}
		});
	}

	waitConnection(cb) {
		if(this.state == 'connected')
			cb()
		else
			this.waitConnectionCallbacks.push(cb);
	}

	listen(username, data, cb) {
		this.waitConnection(() => {
			this.users[username] = { username: username, data: data };
			this.webSocket.send('JOIN #' + username);
		});
	}
}

module.exports = TwitchChat;
