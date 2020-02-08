function SoundCloudPlayer(iframeId, clientId) {
	EventEmitter.call(this);

	this.iframeId = iframeId;

	this.getWidgetCallbacks = [];
	this.state = 'none';
}

SoundCloudPlayer.prototype = Object.create(EventEmitter.prototype);

SoundCloudPlayer.prototype.getName = function() { return 'SoundCloud'; };

SoundCloudPlayer.prototype.urlMatches = function(url) {
	return url.match(/^https?:\/\/(www\.)?soundcloud\.com\/[^/]+\/[^/]+$/);
};

SoundCloudPlayer.prototype.getWidget = function(cb) {
	if(this.state == 'widgetReady') {
		cb(this.widget);
		return;
	}

	this.getWidgetCallbacks.push(cb);

	if(this.state != 'widgetLoading') {
		this.widget = SC.Widget(document.getElementById(this.iframeId));
		this.state = 'widgetLoading';

		this.on('widgetFinish', () => {
			document.getElementById(this.iframeId).style.display = 'none';
			this.emit('stateChanged', 'finished');
		});

		this.playState = null;
		var changePlayState = (st) => {
			if(this.playState != st) {
				this.emit('stateChanged', st);
			}
			this.playState = st;
		};

		this.on('widgetPlay', () => {
			changePlayState('playing');
		});
		this.on('widgetPause', () => {
			changePlayState('paused');
		});
		this.on('widgetLoadProgress', () => {
			changePlayState('loading');
		});

		this.on('widgetSeek', (ev) => {
			this.emit('seek', ev.currentPosition / 1000);
		});

		this.widget.bind(SC.Widget.Events.READY, () => {
			this.state = 'widgetReady';

			for(let i in this.getWidgetCallbacks)
				this.getWidgetCallbacks[i](this.widget);
			this.getWidgetCallbacks = [];

			// Use our event system instead of theirs
			this.widget.bind(SC.Widget.Events.FINISH, (ev) => this.emit('widgetFinish', ev));
			this.widget.bind(SC.Widget.Events.PLAY_PROGRESS, (ev) => this.emit('widgetPlayProgress', ev));
			this.widget.bind(SC.Widget.Events.PLAY, (ev) => { console.log('play', this); this.emit('widgetPlay', ev); });
			this.widget.bind(SC.Widget.Events.PAUSE, (ev) => this.emit('widgetPause', ev));
			this.widget.bind(SC.Widget.Events.LOAD_PROGRESS, (ev) => this.emit('widgetLoadProgress', ev));
			this.widget.bind(SC.Widget.Events.SEEK, (ev) => this.emit('widgetSeek', ev));
			this.emit('ready', this);
		});
	}
};

SoundCloudPlayer.prototype.load = function(item, time, cb) {
	document.getElementById(this.iframeId).style.display = 'block';
	this.getWidget((widget) => {
		this.once('widgetPlay', () => {
			console.log('widgetPlay');
			if(time)
				widget.seekTo(time);
			if(cb)
				cb();
		});
		console.log('SC loading', item.url);
		widget.load(item.url, { auto_play: true });
	});
}

SoundCloudPlayer.prototype.play = function(cb) {
	this.getWidget((widget) => {
		this.once('widgetPlay', () => {
			if(cb)
				cb();
		})
		widget.play();
	});
};

SoundCloudPlayer.prototype.pause = function(cb) {
	this.getWidget((widget) => {
		this.once('widgetPause', () => {
			if(cb)
				cb();
		});
		widget.pause();
	});
};

SoundCloudPlayer.prototype.stop = function(cb) {
	this.pause(cb);
	document.getElementById(this.iframeId).style.display = 'none';
};

SoundCloudPlayer.prototype.getCurrentTime = function(cb) {
	this.getWidget((widget) => {
		widget.getPosition(cb);
	});
};

SoundCloudPlayer.prototype.setVolume = function(vol) {
	this.getWidget((widget) => {
		widget.setVolume(vol);
	});
};
