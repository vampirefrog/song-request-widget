function Player(chatSocket, backends) {
	EventEmitter.call(this);

	this.chatSocket = chatSocket;
	this.backends = backends;
	this.curSong = null;
	this.paused = false;

	this.chatSocket.on('playSong', (data) => {
		this.playSong(data.info, data.requester, data.service);
	});

	this.chatSocket.on('playlistEnded', (data) => {
		this.stop();
	});

	this.chatSocket.on('volume', (data) => {
		this.setVolume(data, true);
	});

	for(var i in this.backends) {
		this.backends[i].on('stateChanged', (state) => {
			if(state == 'finished') {
				this.curSong = null;
				this.saveCurSongPosition();
				this.nextSong();
			}
			this.emit('stateChanged', state);
		});
	}

	setInterval(() => this.saveCurSongPosition(), 1000);
}

Player.prototype = Object.create(EventEmitter.prototype);

Player.prototype.playSong = function(info, requester, service) {
	if(curSong && curSong.info && (curSong.info.url == info.url)) {
		return false;
	}
	var found = false;
	for(let b of this.backends) {
		if(b.urlMatches(info.url)) {
			b.setVolume(this.volume);
			var time = 0;
			if(localStorage.curSong == info.url)
				time = parseFloat(localStorage.curSongPosition);
			b.load(info, time, () => {
				b.setVolume(this.volume);
			});
			this.curSong = {
				backend: b,
				info: info,
				requester: requester,
				service: service
			};
			found = true;
		} else {
			b.stop();
		}
	}
	if(!found) {
		this.nextSong();
	}
};

Player.prototype.nextSong = function() {
	if(this.curSong)
		this.curSong.backend.stop(() => {
			// this.emit('stateChanged', 'stopped');
		});
	this.chatSocket.send('songEnded');
};

Player.prototype.load = function(item, time, cb) {
	item.backend.load(item, time, (songData) => {
		if(cb)
			cb();
	});
};

Player.prototype.play = function(cb) {
	if(this.curSong) {
		this.curSong.backend.play(cb);
	}
};

Player.prototype.pause = function(cb) {
	console.log('pause', this.curSong);
	if(this.curSong) {
		this.curSong.backend.pause();
	}
};

Player.prototype.stop = function(cb) {
	if(this.curSong) {
		this.curSong.backend.stop(cb);
	}
};

var volDebounce = null;
Player.prototype.setVolume = function(vol, noSend) {
	this.volume = vol;
	if(this.curSong) {
		this.curSong.backend.setVolume(vol);
	}
	if(!noSend) {
		if(volDebounce) {
			clearTimeout(volDebounce);
			volDebounce = null;
		}
		volDebounce = setTimeout(() => {
			this.chatSocket.send('volume', vol);
		}, 200);
	}
};

Player.prototype.banSong = function(url) {
	this.chatSocket.send('ban', url);
};

Player.prototype.banCurSong = function() {
	if(this.curSong) {
		this.banSong(this.curSong.info.url);
	}
};

Player.prototype.deleteSong = function(url) {
	this.chatSocket.send('delete', url);
};

Player.prototype.saveCurSongPosition = function() {
	if(this.curSong) {
		localStorage.curSong = this.curSong.info.url;
		this.curSong.backend.getCurrentTime((time) => {
			localStorage.curSongPosition = time;
		});
	} else {
		localStorage.curSong = '';
		localStorage.curSongPosition = '';
	}
};
