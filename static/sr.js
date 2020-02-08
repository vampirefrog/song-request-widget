var player;

function playSong() {
	player.play();
}

function pauseSong() {
	player.pause();
}

function nextSong() {
	player.nextSong();
}

function setVolume(vol) {
	player.setVolume(vol);
}

function banSong(url) {
	player.banSong(url);
}

function banCurSong() {
	player.banCurSong();
}

function deleteSong(url) {
	player.deleteSong(url);
}

window.onload = () => {
	msg('Initializing...');

	var url = new URLSearchParams(window.location.search);
	var socket = new ChatSocket('ws://localhost:4000/socket', url.get('key'));
	var backends = [];
	if(typeof YoutubePlayer != 'undefined')
		backends.push(new YoutubePlayer('youtubePlayer'));
	if(typeof SoundCloudPlayer != 'undefined')
		backends.push(new SoundCloudPlayer('soundCloudIframe'));
	player = new Player(socket, backends);

	function setCurSongInfo(info, requester, service) {
		var curSongDiv = document.getElementById('curSong');
		curSongDiv.dataset.url = info && info.url ? info.url : '';
		var songTitleDivs = curSongDiv.getElementsByClassName('song-title');
		for(let i in songTitleDivs) {
			songTitleDivs[i].innerHTML = (info && info.title) ? escapeHtml(info.title) : '<div style="text-align: center"><i>No song</i></div>';
		}
		var songTitleDivs = curSongDiv.getElementsByClassName('song-requester');
		for(let i in songTitleDivs) {
			songTitleDivs[i].innerHTML = (requester || '') + ' ' + (service ? '(' + service + ')' : '');
		}
	}

	socket.on('playSong', (song) => {
		setCurSongInfo(song.info, song.requester, song.service);
	});

	socket.on('playlistEnded', () => {
		setCurSongInfo(null, '', '');
	});
	setCurSongInfo(null, '', '');

	socket.on('removeSong', (song) => {
		console.log('removeSong', song);
		var playlistDiv = document.getElementById('playlist');
		var songDivs = playlistDiv.getElementsByClassName('song');
		for(var i = 0; i < songDivs.length; i++) {
			if(songDivs[i].dataset.url == song.info.url) {
				playlistDiv.removeChild(songDivs[i]);
			}
		}
		songDivs = playlistDiv.getElementsByClassName('song');
		if(songDivs.length == 0) {
			appendNothingPlaying();
		}
	});

	socket.on('addSong', (song) => {
		var playlistDiv = document.getElementById('playlist');
		var songDivs = playlistDiv.getElementsByClassName('song');
		if(songDivs.length == 0)
			playlistDiv.innerHTML = '';
		appendSongDiv(playlistDiv, song);
	});

	socket.on('volume', (vol) => {
		document.getElementById('volume').value = vol;
	});

	player.on('stateChanged', (state) => {
		if(state == 'playing') {
			document.getElementById('pause').style.display = 'inline';
			document.getElementById('play').style.display = 'none';
		} else {
			document.getElementById('pause').style.display = 'none';
			document.getElementById('play').style.display = 'inline';
		}
	});

	function appendSongDiv(playlistDiv, song) {
		var item = document.createElement('div');
		item.className = 'song';
		item.dataset.url =song.info.url;
		item.innerHTML =
			'<div class="song-thumbnail">'+(song.info.thumbnail ? '<img src="'+song.info.thumbnail+'" alt="">' : '') + '</div>'+
			'<div class="song-details">'+
				'<div class="song-title"><a href="'+escapeHtml(song.info.url)+'">'+escapeHtml(song.info.title || song.info.url) + '</a></div>'+
					'<div class="song-duration">'+secondsToTime(song.info.duration)+'</div>'+
					'<button type="button" class="song-delete" onclick="deleteSong('+escapeHtml(JSON.stringify(song.info.url))+')">Delete</button>'+
					'<button type="button" class="song-delete" onclick="banSong('+escapeHtml(JSON.stringify(song.info.url))+')">Ban</button>'+
					'<div class="song-requester">'+song.requester+(song.service ? ' ('+song.service+')':'')+'</div>'+
				'</div>'+
				'<div style="clear: both"></div>'+
			'</div>';
		playlistDiv.appendChild(item);
	}

	function appendNothingPlaying() {
		document.getElementById('playlist').innerHTML = '<div style="text-align: center"><br><i>No pee pee poo poo</i></div>';
	}

	socket.on('playList', (list) => {
		var playlistDiv = document.getElementById('playlist');
		playlistDiv.innerHTML = '';
		if(list.length > 0) {
			for(var i = 0; i < list.length; i++) {
				appendSongDiv(playlistDiv, list[i]);
			}
		} else {
			appendNothingPlaying();
		}
	});

	msg("Initialized");
};
