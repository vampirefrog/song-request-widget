function YoutubePlayer(elemId) {
	EventEmitter.call(this);

	this.elemId = elemId;

	this.getPlayerCallbacks = [];
	this.state = 'none';
}

YoutubePlayer.prototype = Object.create(EventEmitter.prototype);

YoutubePlayer.prototype.getName = function() { return 'YouTube'; };

YoutubePlayer.prototype.urlMatches = function(url) {
	var urlInstance = new URL(url);
	return urlInstance.host == 'www.youtube.com' || urlInstance.host == 'm.youtube.com' || urlInstance.host == 'youtu.be';
};

YoutubePlayer.prototype.getPlayer = function(fn) {
	if(this.state == 'ready') {
		fn(this.player);
		return;
	}
	
	this.getPlayerCallbacks.push(fn);

	if(this.state != 'loading') {
		this.state = 'loading';
		this.player = new YT.Player(this.elemId, {
			width: '100%',
			height: '200',
			playerVars: { 'autoplay': 1 },
			events: {
				onReady: (ev) => {
					this.state = 'ready';
					for(var i in this.getPlayerCallbacks)
						this.getPlayerCallbacks[i](this.player);
					this.getPlayerCallbacks = [];

					this.emit('ready', this);
				},
				onStateChange: (ev) => {
					var stateNames = {
						'-1': 'unstarted',
						'0': 'ended',
						'1': 'playing',
						'2': 'paused',
						'3': 'buffering',
						'5': 'video cued',
					};
					switch(ev.data) {
						case 0:
							document.getElementById(this.elemId).style.display = 'none';
							this.emit('stateChanged', 'finished');
							break;
						case 1:
							this.emit('stateChanged', 'playing');
							break;
						case 2:
							this.emit('stateChanged', 'paused');
							break;
						case 3:
							this.emit('stateChanged', 'loading');
							break;
					}
					this.emit('onStateChange', ev);
				}
			}
		});
	}
};

YoutubePlayer.prototype.load = function(item, time, cb) {
	document.getElementById(this.elemId).style.display = 'block';
	this.getPlayer((player) => {
		var fn = (ev) => {
			if(ev.data == 1) {
				if(cb)
					cb({
						title: player.getVideoData().title,
						requester: item.requester
					});
				this.off('onStateChange', fn);
			}
		};
		this.on('onStateChange', fn);
		var url = new URL(item.url);
		var id = '';
		if(url.host == 'youtu.be')
			id = url.pathname.replace(/^\//, '');
		else
			id = url.searchParams.get('v');
		if(time <= 0)
			time = .00001;
		player.loadVideoById({
			videoId: id,
			startSeconds: time
		});
	});
};

YoutubePlayer.prototype.play = function(cb) {
	this.getPlayer((player) => {
		var fn = (ev) => {
			if(ev.data == 1) {
				if(cb)
					cb();
				this.off('onStateChange', fn);
			}
		};
		this.on('onStateChange', fn);
		player.playVideo();
	});
};

YoutubePlayer.prototype.pause = function(cb) {
	this.getPlayer((player) => {
		var fn = (ev) => {
			if(ev.data == 2) {
				if(cb)
					cb();
				this.off('onStateChange', fn);
			}
		};
		this.on('onStateChange', fn);
		player.pauseVideo();
	});
};

YoutubePlayer.prototype.stop = function(cb) {
	document.getElementById(this.elemId).style.display = 'none';
	this.getPlayer((player) => {
		var fn = (ev) => {
			if(ev.data == 0 || ev.data == 2 || ev.data == 5 || ev.data == -1) {
				if(cb)
					cb();
				this.off('onStateChange', fn);
			}
		};
		this.on('onStateChange', fn);
		player.stopVideo();
	});
};

YoutubePlayer.prototype.getCurrentTime = function(cb) {
	this.getPlayer((player) => {
		if(cb)
			cb(player.getCurrentTime());
	})
};

YoutubePlayer.prototype.setVolume = function(vol) {
	this.getPlayer((player) => {
		player.setVolume(vol);
	});
};
