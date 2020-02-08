const Chat = require('./Chat');
const WebSocket = require('ws');

class DLiveChat extends Chat {
	constructor() {
		super();

		this.users = {};
		this.id = 1;
		this.state = 'none';
		this.waitConnectionCallbacks = [];

		this.webSocket = new WebSocket('wss://graphigostream.prd.dlive.tv/', 'graphql-ws');

		this.webSocket.on('open', () => {
			this.webSocket.send('{"type":"connection_init","payload":{}}');
			this.emit('open');
		});

		this.webSocket.on('message', (message) => {
			var data = JSON.parse(message);
			if(data && data.type) {
				if(data.type == 'connection_ack') {
					this.state = 'connected';
					this.emit('connected');
					for(let cb of this.waitConnectionCallbacks)
						cb();
				} else if(data.type == 'data') {
					if(data.payload && data.payload.data) {
						if(data.payload.data.streamMessageReceived) {
							for(let i in data.payload.data.streamMessageReceived) {
								var msg = data.payload.data.streamMessageReceived[i];
								if(msg && msg.sender && msg.sender.displayname) {
									this.emit('chat', {
										data: this.users[data.id],
										username: msg.sender.username,
										displayName: msg.sender.displayname,
										text: msg.content
									});
								}
							}
						}
					}
				}
			}
		});
	}

	waitConnection(cb) {
		if(this.state == 'connected')
			cb();
		else
			this.waitConnectionCallbacks.push(cb);
	}

	listen(username, data, cb) {
		this.waitConnection(() => {
			var id = this.id.toString();
			this.users[id] = {
				username: username,
				id: id,
				data: data
			};
			this.connectUser(this.users[id]);
			this.id++;
			if(cb)
				cb();
		});
	}

	connectUser(user) {
		this.webSocket.send(JSON.stringify({
			id: user.id,
			type:'start',
			payload: {
				variables: {
					streamer: user.username
				},
				extensions: {
					persistedQuery: {
						version: 1,
						sha256Hash: "feb450b243f3dc91f7672129876b5c700b6594b9ce334bc71f574653181625d5"
					}
				},
				operationName: "StreamMessageSubscription",
				query:"subscription StreamMessageSubscription($streamer: String!) {\n"+
					"  streamMessageReceived(streamer: $streamer) {\n"+
					"    type\n"+
					"    ... on ChatGift {\n"+
					"      id\n"+
					"      gift\n"+
					"      amount\n"+
					"      message\n"+
					"      recentCount\n"+
					"      expireDuration\n"+
					"      ...VStreamChatSenderInfoFrag\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatHost {\n"+
					"      id\n"+
					"      viewer\n"+
					"      ...VStreamChatSenderInfoFrag\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatSubscription {\n"+
					"      id\n"+
					"      month\n"+
					"      ...VStreamChatSenderInfoFrag\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatExtendSub {\n"+
					"      id\n"+
					"      month\n"+
					"      length\n"+
					"      ...VStreamChatSenderInfoFrag\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatChangeMode {\n"+
					"      mode\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatText {\n"+
					"      id\n"+
					"      content\n"+
					"      subLength\n"+
					"      ...VStreamChatSenderInfoFrag\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatSubStreak {\n"+
					"      id\n"+
					"      ...VStreamChatSenderInfoFrag\n"+
					"      length\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatClip {\n"+
					"      id\n"+
					"      url\n"+
					"      ...VStreamChatSenderInfoFrag\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatFollow {\n"+
					"      id\n"+
					"      ...VStreamChatSenderInfoFrag\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatDelete {\n"+
					"      ids\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatBan {\n"+
					"      id\n"+
					"      ...VStreamChatSenderInfoFrag\n"+
					"      bannedBy {\n"+
					"        id\n"+
					"        displayname\n"+
					"        __typename\n"+
					"      }\n"+
					"      bannedByRoomRole\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatModerator {\n"+
					"      id\n"+
					"      ...VStreamChatSenderInfoFrag\n"+
					"      add\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatEmoteAdd {\n"+
					"      id\n"+
					"      ...VStreamChatSenderInfoFrag\n"+
					"      emote\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatTimeout {\n"+
					"      id\n"+
					"      ...VStreamChatSenderInfoFrag\n"+
					"      minute\n"+
					"      bannedBy {\n"+
					"        id\n"+
					"        displayname\n"+
					"        __typename\n"+
					"      }\n"+
					"      bannedByRoomRole\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatTCValueAdd {\n"+
					"      id\n"+
					"      ...VStreamChatSenderInfoFrag\n"+
					"      amount\n"+
					"      totalAmount\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatGiftSub {\n"+
					"      id\n"+
					"      ...VStreamChatSenderInfoFrag\n"+
					"      count\n"+
					"      receiver\n"+
					"      __typename\n"+
					"    }\n"+
					"    ... on ChatGiftSubReceive {\n"+
					"      id\n"+
					"      ...VStreamChatSenderInfoFrag\n"+
					"      gifter\n"+
					"      __typename\n"+
					"    }\n"+
					"    __typename\n"+
					"  }\n"+
					"}\n"+
					"\n"+
					"fragment VStreamChatSenderInfoFrag on SenderInfo {\n"+
					"  subscribing\n"+
					"  role\n"+
					"  roomRole\n"+
					"  sender {\n"+
					"    id\n"+
					"    username\n"+
					"    displayname\n"+
					"    avatar\n"+
					"    partnerStatus\n"+
					"    badges\n"+
					"    effect\n"+
					"    __typename\n"+
					"  }\n"+
					"  __typename\n"+
					"}"
			}
		}));
	}
}

module.exports = DLiveChat;
