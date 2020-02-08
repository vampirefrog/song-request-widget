function escapeHtml(unsafe) {
	return (unsafe||'').toString()
		 .replace(/&/g, "&amp;")
		 .replace(/</g, "&lt;")
		 .replace(/>/g, "&gt;")
		 .replace(/"/g, "&quot;")
		 .replace(/'/g, "&#039;");
}

function padInt(i) {
	return ('00'+i).substr(-2);
}

function secondsToTime(sec) {
	sec = Math.floor(sec);
	var s = sec % 60;
	var m = Math.floor(sec / 60) % 60;
	var h = Math.floor(sec / 60 / 60);
	return (h ? h + ':' : '') + (h ? padInt(m) + ':' : (m ? m + ':' : '')) + (h || m ? padInt(s) : s);
}

function loadJSON(url, cb) {
	var x = new XMLHttpRequest();
	x.addEventListener('load', function() {
		cb(JSON.parse(this.responseText));
	});
	x.open('GET', url);
	x.send();
}

function buildQueryString(params) {
	return Object.keys(params)
	.map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
	.join('&');
}

if(typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
	module.exports = {
		escapeHtml: escapeHtml,
		padInt: padInt,
		secondsToTime: secondsToTime,
		buildQueryString: buildQueryString
	};
}
