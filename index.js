const TwitchChat = require('./TwitchChat');
const DLiveChat = require('./DLiveChat');
const Express = require('express');
const ExpressWS = require('express-ws');
const https = require('https');
const sqlite3 = require('sqlite3');

const Util = require('./static/util');
const YouTube = require('./youtube');
const SoundCloud = require('./soundcloud');

const ClientManager = require('./clientmanager');

var db = new sqlite3.Database('sr.sqlite', (err) => {
	if(err) {
		console.error('Error initializing sqlite', err.message);
	}
	console.log('Connected to SQLite database');
	var tables = {
		users: `CREATE TABLE "users" (
				"id"	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
				"username"	VARCHAR(32) NOT NULL,
				"display_name"	VARCHAR(32) NOT NULL,
				"key"	CHAR(32) NOT NULL,
				"dlive_username"	varchar(32),
				"twitch_username"	varchar(32),
				"volume"	INTEGER NOT NULL DEFAULT 80 CHECK(volume>=0 AND volume<=100),
				"song_time_limit"	INTEGER NOT NULL DEFAULT 0,
				"voice"	TEXT DEFAULT 'UK English Male',
				"rate"	NUMERIC DEFAULT .5 CHECK(rate>0 AND rate<=1),
				"pitch"	NUMERIC DEFAULT .5 CHECK(pitch>0 AND pitch<=1)
			)`,
		songs: `CREATE TABLE "songs" (
				"id"	INTEGER,
				"url"	VARCHAR(200) NOT NULL,
				"added_at"	INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
				"duration"	INT UNSIGNED NOT NULL,
				"thumbnail"	VARCHAR(200),
				"title"	VARCHAR(200),
				PRIMARY KEY("id")
			)`,
		song_requests: `CREATE TABLE "song_requests" (
				"id"	INTEGER,
				"song_id"	INTEGER NOT NULL,
				"user_id"	INTEGER NOT NULL,
				"requested_at"	INTEGER UNSIGNED NOT NULL DEFAULT CURRENT_TIMESTAMP,
				"requester"	VARCHAR(32) NOT NULL,
				"service"	VARCHAR(20),
				"status"	INTEGER NOT NULL,
				"playback_started_at"	TIMESTAMP,
				"playback_ended_at"	TIMESTAMP,
				PRIMARY KEY("id"),
				FOREIGN KEY("song_id") REFERENCES "songs"("id"),
				FOREIGN KEY("user_id") REFERENCES "users"("id")
			)`,
		song_bans: `CREATE TABLE "song_bans" (
				"user_id"	INTEGER NOT NULL,
				"song_id"	INTEGER NOT NULL,
				"banned_at"	INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY("user_id","song_id")
			) WITHOUT ROWID`,
		chat_users: `CREATE TABLE "chat_users" (
				"id"	INTEGER NOT NULL,
				"user_id"	INTEGER NOT NULL,
				"service"	varchar(32) NOT NULL,
				"username"	varchar(32) NOT NULL,
				"displayname"	varchar(32),
				"voice"	varchar(32) NOT NULL DEFAULT 'UK English Female',
				"pitch"	NUMERIC NOT NULL DEFAULT .5 CHECK(pitch>0 AND pitch<=1),
				"rate"	NUMERIC NOT NULL DEFAULT .5 CHECK(rate>0 AND rate<=1),
				"pan"	NUMERIC NOT NULL DEFAULT 0 CHECK(pan>=-1 AND pan<=1),
				PRIMARY KEY("id")
			)`
	};
	var q = `SELECT name FROM sqlite_master WHERE type='table'`;
	db.all(q, (err, rows) => {
		if(err) {
			console.error('Error reading tables', err);
		} else {
			var existingTables = {};
			for(let r of rows) {
				existingTables[r.name] = true;
			}
			var tableChecks = {};
			for(let t in tables) {
				tableChecks[t] = false;
			}
			function checkAllTables() {
				for(let c in tableChecks) {
					if(!tableChecks[c])
						return;
				}
				listenToChat();
			}
			for(let t in tables) {
				if(existingTables[t]) {
					console.log('Table', t, 'ok');
					tableChecks[t] = true;
					checkAllTables();
				} else {
					console.log('Table', t, 'missing, creating');
					let q = tables[t];
					db.run(q, (err) => {
						if(err) {
							console.error('Error creating table', t, err);
							process.exit();
						} else {
							console.log('Created table', t);
							tableChecks[t] = true;
							checkAllTables();
						}
					});
				}
			}
		}
	});
});

var app = Express();
var expressWs = ExpressWS(app);

Express.static.mime.define({
	'text/plain': ['md'],
	'appliation/javascript': ['js']
});
app.use(Express.static('static'));

app.get('/speech', (req, res, next) => {
	var url = 'https://code.responsivevoice.org/getvoice.php?'+Util.buildQueryString(req.query);
	console.log('SPEECH URL', url);
	https.get(url, {
		headers: { referer: 'https://responsivevoice.org/' }
	}, (r) => {
		if(r.statusCode !== 200) {
			res.send('Error '+r.statusCode);
		} else {
			res.append('Content-type', r.headers['content-type']);

			r.on('data', (chunk) => {
				res.write(chunk);
			});
			r.on('end', () => {
				res.end();
			});
		}
	});
});

function getUserByKey(key, cb) {
	let sql = `SELECT * FROM users WHERE key = ?`;
	db.get(sql, [ key ], (err, user) => {
		if(err) {
			cb(err);
		} else if(!user) {
			cb('Could not find user with key '+ key);
		} else {
			cb(null, user);
		}
	});
}

function getPlayQueueForUser(userId, cb, limit) {
	let q = `
		SELECT
			s.id AS song_id,
			s.url,
			s.duration,
			s.thumbnail,
			s.title,
			sr.id AS song_request_id,
			sr.requester,
			sr.service
		FROM song_requests sr
		JOIN users u ON u.id = sr.user_id
		JOIN songs s ON s.id = sr.song_id
		LEFT JOIN song_bans sb ON sb.song_id = s.id AND sb.user_id = u.id
		WHERE sr.status = 0
		AND sb.song_id IS NULL
		AND u.id = ?
		ORDER BY sr.id
	`;
	if(limit)
		q += ` LIMIT ${limit}`;
	db.all(q, [userId], (err, rows) => {
		if (err) {
			cb(err, null);
		} else {
			var ret = [];
			for(let r of rows) {
				ret.push({
					info: {
						url: r.url,
						duration: r.duration,
						title: r.title,
						thumbnail: r.thumbnail
					},
					requester: r.requester,
					service: r.service,
					song_request_id: r.song_request_id
				});
			}
			cb(null, ret);
		}
	});
}

function getFirstPlayQueueItemForUser(userId, cb) {
	getPlayQueueForUser(userId, (err, songs) => {
		cb(err, songs && songs[0] ? songs[0] : null);
	}, 1);
}

var clientManager = new ClientManager();

function getSongInfo(url, userId, cb) {
	var provider = null;
	for(let p of songProviders) {
		if(p.urlMatches(url)) {
			provider = p;
			break;
		}
	}

	if(!provider) {
		cb(`No provider found for URL ${url}`);
		return;
	}

	url = provider.getCanonicalUrl(url);
	let q = `SELECT
			s.*,
			sb.song_id IS NOT NULL AS banned
		FROM songs s
		LEFT JOIN song_bans sb ON sb.song_id = s.id AND sb.user_id = ?
		WHERE s.url = ?`; 
	db.get(q, [ userId, url ], (err, song) => {
		if(err) {
			cb(`Error getting song data from database for URL ${url}: ${err}`);
		} else if(song) {
			// Found already existing song in DB
			cb(null, song);
		} else {
			provider.getInfo(url, (err, info) => {
				if(err) {
					cb(`Error getting song info ${err}.`);
				} else {
					db.run(`INSERT INTO songs (
						url,
						duration,
						thumbnail,
						title
					) VALUES(
						?,
						?,
						?,
						?
					)`,
					[
						info.url,
						info.duration,
						info.thumbnail,
						info.title
					],
					function(err) {
						if(err) {
							cb(`Error inserting song with URL ${url}: ${err}`);
						} else {
							info.id = this.lastID;
							// Got info from provider, and inserted in DB
							cb(null, info);
						}
					});
				}
			});
		}
	});
}

function removeSong(url, userId, cb) {
	getPlayQueueForUser(userId, (err, queue) => {
		if(err) {
			cb(err);
		} else {
			getSongInfo(url, userId, (err, song) => {
				console.log('got song info', song);
				if(err) {
					cb(err);
				} else {
					let nextSongToPlay = null, endPlaylist = false;
					for(let i = 0; i < queue.length; i++) {
						if(queue[i].info.url == song.url) {
							if(i == 0) {
								if(queue.length > 1) {
									endPlaylist = false;
									nextSongToPlay = queue[1];
								} else {
									endPlaylist = true;
								}
							}
							clientManager.sendToAll(userId, {
								type: 'removeSong',
								data: queue[i]
							});
							cb(null, song);
							queue.splice(i, 1);
							i--;
						}
					}
					if(nextSongToPlay) {
						clientManager.sendToAll(userId, {
							type: 'playSong',
							data: nextSongToPlay
						});
					}
					if(endPlaylist) {
						clientManager.sendToAll(userId, {
							type: 'playlistEnded'
						});
					}
				}
			});
		}
	});
}

function insertSongRequest(song, user, requester, service, cb) {
	if(user.song_time_limit > 0 && song.duration > user.song_time_limit) {
		var userLimitStr = Util.secondsToTime(user.song_time_limit);
		var songDurationStr = Util.secondsToTime(song.duration);
		if(cb) cb(`Song ${song.url} exceeds user time limit, ${songDurationStr} > ${userLimitStr}`);
		return;
	}

	let q = `SELECT *
		FROM song_requests
		WHERE song_id = ?
		AND user_id = ?
		AND status = 0`;
	db.get(q, [ song.id, user.id ], (err, row) => {
		if(err) {
			if(cb) cb(`Error finding if song ${song.url} is already queued songId=${song.id} userId=${user.id}: ${err}`);
		} else if(row) {
			if(cb) cb(`Song ${song.url} is already queued`);
		} else {
			getFirstPlayQueueItemForUser(user.id, (err, firstSong) => {
				if(err) {
					if(cb) cb(`Error getting first play queue item for user ${user.id}: ${err}`);
				} else {
					db.run(
						`INSERT INTO song_requests (
							song_id,
							user_id,
							requester,
							service,
							status,
							playback_started_at,
							playback_ended_at
						) VALUES(
							?,
							?,
							?,
							?,
							0,
							NULL,
							NULL
						)`, [
							song.id,
							user.id,
							requester,
							service
						], function(err) {
							if(err) {
								if(cb) cb(`Error inserting song request ${song.url} userId=${user.id}: ${err}`);
							} else {
								var requestData = {
									info: song,
									requester: requester,
									service: service,
									song_request_id: this.lastID
								};
								clientManager.sendToAll(user.id, { type: 'addSong', data: requestData });
								if(!firstSong) {
									clientManager.sendToAll(user.id, { type: 'playSong', data: requestData });
								}
								if(cb) cb(null, requestData, firstSong);
							}
						});
					}
				}
			);
		}
	});
}

app.get('/playQueue', function(req, res, next) {
	if(!req.query.key) {
		res.end('No key specified');
	} else {
		getUserByKey(req.query.key, (err, user) => {
			if(err) {
				console.error('Error getting user by key', err);
				next(err);
			} else {
				if(user) {
					getPlayQueueForUser(user.id, (err, queue) => {
						if (err) {
							console.log(err);
							next(err);
						} else {
							res.end(JSON.stringify(queue));
						}
					});
				} else {
					console.error('Could not find user by key', req.query.key);
					next('Could not find user by key');
				}
			}
		});
	}
});

app.ws('/socket', function(ws, req) {
	ws.on('message', function(msg) {
		try {
			var parsed = JSON.parse(msg);
			if(parsed.key) {
				getUserByKey(parsed.key, (err, user) => {
					if(err) {
						ws.send(JSON.stringify({ error: 'Could not find user with key ' + parsed.key + ': ' + err}));
					} else {
						if(parsed.type == 'connect') {
							clientManager.add(user.id, ws);
							clientManager.send(ws, {
								type: 'volume',
								data: user.volume
							});
							getPlayQueueForUser(user.id, (err, queue) => {
								if(err) {
									console.error('Error loading play queue for user', user.id, err);
								} else {
									clientManager.send(ws, { type: 'playList', data: queue });
									if(queue.length > 0) {
										clientManager.send(ws, {
											type: 'playSong',
											data: queue[0]
										});
									} else {
										clientManager.send(ws, {
											type: 'playlistEnded'
										});
									}
								}
							});
						} else if(parsed.type == 'songEnded') {
							console.log("songEnded", parsed);
							getPlayQueueForUser(user.id, (err, queue) => {
								if(err) {
									console.error('Error loading play queue for user', user.id, err);
								} else {
									if(queue.length == 0 || queue[0].url != parsed.url) {
										if(queue.length > 0) {
											clientManager.send(ws, { type: 'playList', data: queue });
											clientManager.send(ws, { type: 'playSong', data: queue[0] });
										} else {
											clientManager.send(ws, { type: 'playlistEnded' });
										}
									} else {
										let q = `
											UPDATE song_requests
											SET status = 1
											WHERE id = ?
										`;
										db.run(q, [queue[0].song_request_id], function(err) {
											if(err) {
												console.error('Error updating top of play queue for user '+user.id, err);
											} else {
												clientManager.sendToAll(user.id, { type: 'removeSong', data: queue[0] });
												if(queue.length > 1) {
													clientManager.sendToAll(user.id, {
														type: 'playSong',
														data: queue[1]
													});
												} else {
													clientManager.sendToAll(user.id, {
														type: 'playlistEnded'
													});
												}
											}
										});
									}
								}
							});
						} else if(parsed.type == 'volume') {
							db.run(`UPDATE users SET volume = ? WHERE id = ?`, [ parsed.data, user.id ], (err) => {
								if(err) {
									console.error('Could not set volume', parsed.data, 'for user', user.id, err);
								} else {
									clientManager.sendToAll(user.id, { type: 'volume', data: parsed.data }, ws);
								}
							});
						} else if(parsed.type == 'ban') {
							removeSong(parsed.data, user.id, (err, song) => {
								db.run(`INSERT INTO song_bans (user_id, song_id) VALUES(?, ?)`, [ user.id, song.id ], (err) => {
									if(err) {
										console.error('Error banning song', parsed.data, 'song.id', song.id, 'user.id', user.id, 'error', err);
									} else {
										console.log('Banned song', parsed.data, song.id, user.id);
									}
								});
							});
						} else if(parsed.type == 'delete') {
							removeSong(parsed.data, user.id, (err, song) => {
								db.run(`UPDATE song_requests SET status = -1 WHERE user_id = ? AND song_id = ? AND status = 0`, [ user.id, song.id ], (err) => {
									if(err) {
										console.error('Could not delete song', parsed.data, song.id, user.id, err);
									} else {
										console.log('Deleted song', parsed.data, song.id, user.id);
									}
								});
							});
						}
					}
				});
			} else {
				ws.send(JSON.stringify({ error: 'No key specified' }));
			}
		} catch(e) {
			let error = 'Could not parse client message: ' + e.message;
			ws.send(JSON.stringify({ error: error }));
			console.error(error);
		}
	});
});
const serverWS = expressWs.getWss('/socket');

function getChatUser(userId, source, username, cb) {
	db.get(`SELECT * FROM chat_users WHERE user_id = ? AND service = ? AND username = ?`, [ userId, source, username ], (err, chatUser) => {
		if(err) {
			cb(err);
		} else if(!chatUser) {
			var chatUser = 
			db.run(`INSERT INTO chat_users (user_id, service, username) VALUES(?, ?, ?)`, [ userId, source, username ], function(err) {
				if(err)
					cb(err);
				else
					cb(null, {
						id: this.lastID,
						user_id: userId,
						service: source,
						username: username
					});
			});
		} else {
			cb(null, chatUser);
		}
	});
}

function handleChat(userId, msg) {
	if(!msg.text) return;

	chatMsg = {
		type: 'chat',
		data: msg
	};
	db.get(`SELECT * FROM users WHERE id = ?`, [ userId ], (err, user) => {
		if(err) {
			console.error('Could not get user', userId, 'from database for handling chat', err);
		} else if(!user) {
			console.error('Could not find user', userId, ' for handling chat');
		} else {
			getChatUser(userId, msg.source, msg.username, (err, chatUser) => {
				chatMsg.data.chatUser = chatUser;
				let match = msg.text.match(/^\!sr\s+(.+?)\s*$/);
				if(match) {
					getSongInfo(match[1], userId, (err, song) => {
						if(err) {
							console.error('Error getting song info', err);
						} else {
							if(song.banned) {
								console.log('Banned song requested', song.title);
								msg.banned = true;
							} else {
								insertSongRequest(song, user, msg.displayName, msg.source, (err, song) => {
									if(err) {
										console.error(err);
									} else {
										console.log('Inserted song request', song);
									}
								});
							}
							chatMsg.data.command = 'sr';
							chatMsg.data.song = song;
						}
						clientManager.sendToAll(userId, chatMsg);
					});
				} else {
					clientManager.sendToAll(userId, chatMsg);
				}
			});
		}
	});
}

var songProviders = [
	new YouTube(),
	new SoundCloud()
];

app.get('/videoInfo', function(req, res, next) {
	if(!req.query.url) {
		next('No URL specified');
	} else if(!req.query.key) {
		next('No key specified');
	} else {
		getUserByKey(req.query.key, (err, user) => {
			if(err) {
				next(err);
			} else {
				getSongInfo(req.query.url, (err, info) => {
					if(err) {
						next(err);
					} else {
						res.end(JSON.stringify(info));
					}
				});
			}
		});
	}
});

const twitchChat = new TwitchChat();
twitchChat.on('chat', (msg) => {
	msg.source = 'twitch';
	handleChat(msg.data.data.id, msg);
});

const dliveChat = new DLiveChat();
dliveChat.on('chat', (msg) => {
	msg.source = 'dlive';
	handleChat(msg.data.data.id, msg);
});

function listenToChat() {
	db.each(`SELECT * FROM users`, [], (err, user) => {
		if(err) {
			console.error('Error getting users', err);
		} else if(!user) {
			console.error('No user found');
		} else {
			console.log('Listening to chat for user', user)
			if(user.dlive_username) {
				console.log('Listening to dlive user ', user.dlive_username);
				dliveChat.listen(user.dlive_username, { id: user.id });
			}
			if(user.twitch_username) {
				console.log('Listening to twitch user ', user.twitch_username);
				twitchChat.listen(user.twitch_username, { id: user.id });
			}
		}
	});
}

app.get('/users', function(req, res, next) {
	if(process.env.ADMIN_KEY && process.env.ADMIN_KEY == req.query.key) {
		db.all(`SELECT * FROM users`, [], (err, users) => {
			if(err) {
				next(err);
			} else {
				res.end(JSON.stringify(users));
			}
		});
	} else {
		next('Auth mismatch');
	}
});

app.use(Express.urlencoded());
app.post('/users', function(req, res, next) {
	if(process.env.ADMIN_KEY && process.env.ADMIN_KEY == req.query.key) {
		var body = req.body;
		if(body.id) {
			q = `UPDATE users SET
				username = ?,
				display_name = ?,
				key = ?,
				dlive_username = ?,
				twitch_username = ?,
				volume = ?,
				song_time_limit = ?
				WHERE id = ?`;
			db.run(q, [
				body.username,
				body.displayName,
				body.key,
				body.dliveUsername,
				body.twitchUsername,
				body.volume,
				body.songTimeLimit,
				body.id
			], (err) => {
				if(err)
					next(err);
				else
					res.end('"ok"');
			});
		} else {
			q = `INSERT INTO users (
					username,
					display_name,
					key,
					dlive_username,
					twitch_username,
					volume,
					song_time_limit
				) VALUES (
					?,
					?,
					?,
					?,
					?,
					?,
					?
				)`;
			db.run(q, [
				body.username,
				body.displayName,
				body.key,
				body.dliveUsername,
				body.twitchUsername,
				body.volume,
				body.songTimeLimit
			], function(err) {
				if(err)
					next(err);
				else
					res.end(this.lastID.toString());
			});
		}
	} else {
		next('Auth mismatch');
	}
});

app.listen(4000);
console.log('Ready on http://localhost:4000');
