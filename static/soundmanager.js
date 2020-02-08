function SoundManager() {
	loadJSON('voices.json', (voices) => { this.voices = voices; });

	try {
		this.audioCtx = new AudioContext();
		this.mediaElement = new Audio();
		this.mediaElementSourceNode = this.audioCtx.createMediaElementSource(this.mediaElement);

		this.panNode = this.audioCtx.createStereoPanner();
		this.gainNode = this.audioCtx.createGain();
		this.gainNode.gain.setValueAtTime(4.0, this.audioCtx.currentTime);
		this.compressorNode = this.audioCtx.createDynamicsCompressor();
		this.compressorNode.threshold.setValueAtTime(-50, this.audioCtx.currentTime);
		this.compressorNode.knee.setValueAtTime(40, this.audioCtx.currentTime);
		this.compressorNode.ratio.setValueAtTime(12, this.audioCtx.currentTime);
		this.compressorNode.attack.setValueAtTime(0, this.audioCtx.currentTime);
		this.compressorNode.release.setValueAtTime(0.25, this.audioCtx.currentTime);

		this.panNode.connect(this.gainNode);
		this.gainNode.connect(this.compressorNode);
		this.compressorNode.connect(this.audioCtx.destination);
	} catch(e) {
		console.error(e);
	}

	this.queue = [];
	this.playing = false;
}

SoundManager.prototype.speak = function(text, options) {
	try {
		var rate = options.rate || 0.5;
		if(rate < 0) rate = 0;
		if(rate > 1) rate = 1;
		var pitch = options.pitch || 0.5;
		if(pitch < 0) pitch = 0;
		if(pitch > 1) pitch = 1;
		var voice = options.voice || 'UK English Female';

		var urlData = {
			t: text,
			tl: 'en-GB',
			sv: 'g1',
			vn: '',
			pitch: pitch,
			rate: rate,
			vol: '1',
			gender: 'female'
		};

		for(let i in this.voices.responsivevoices) {
			var voiceData = this.voices.responsivevoices[i];
			if(voiceData.name.toLowerCase() == voice.toLowerCase()) {
				var voiceParams = null;
				for(let j in voiceData.voiceIDs) {
					var voiceId = voiceData.voiceIDs[j];
					var vp = this.voices.voicecollection[voiceId];
					if(vp.fallbackvoice) {
						voiceParams = vp;
						break;
					}
				}
				if(voiceParams) {
					if(voiceParams.lang) urlData.tl = voiceParams.lang;
					if(voiceParams.service) urlData.sv = voiceParams.service || '';
					if(voiceParams.gender) urlData.gender = voiceParams.gender;
				}
				break;
			}
		}
		console.log('hi');
		var url = 'http://localhost:4000/speech?'+buildQueryString(urlData);
		var a = new Audio(url);
		var item = {
			audio: a,
			source: this.audioCtx.createMediaElementSource(a),
			pan: options.pan || 0,
			onEnd: options.onEnd,
			onStart: options.onStart,
			connected: false
		};
		if(item.pan < -1) item.pan = -1;
		if(item.pan > 1) item.pan = 1;

		var connectAndPlay = (item) => {
			this.panNode.pan.setValueAtTime(item.pan, this.audioCtx.currentTime);
			item.source.connect(this.panNode);
			item.connected = true;
			item.audio.play();
			if(item.onStart)
				item.onStart.call();
		};

		if(this.playing) {
			this.queue.push(item);
		} else {
			this.playing = true;
			connectAndPlay(item);
		}

		item.audio.addEventListener('ended', (ev) => {
			item.source.disconnect(this.panNode);

			if(this.queue.length > 0) {
				var i = this.queue[0];
				this.queue.splice(0, 1);
				connectAndPlay(i);
			} else {
				this.playing = false;
			}

			if(options.onEnd)
				options.onEnd.call();
		});

		item.audio.addEventListener('error', (ev) => {
			if(item.connected)
				item.source.disconnect(this.panNode);
			if(this.queue.length > 0) {
				var i = this.queue[0];
				this.queue.splice(0, 1);
				connectAndPlay(i);
			} else {
				this.playing = false;
			}

			if(options.onEnd)
				options.onEnd.call();
			if(options.onError)
				options.onError.call();
		});
	} catch(e) {
		if(options.onError)
			options.onError.call(e, this.playing);
	}
};
