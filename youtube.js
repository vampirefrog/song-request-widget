const SongProvider = require('./songprovider');
const https = require('https');

class YouTube extends SongProvider {
	constructor() {
		super();
	}

	urlMatches(url) {
		try {
			var urlInstance = new URL(url);
			return urlInstance.host == 'www.youtube.com' || urlInstance.host == 'm.youtube.com' || urlInstance.host == 'youtu.be';
		} catch(e) {
			return false;
		}
	}

	getCanonicalUrl(url) {
		var canonicalUrl = url;
		var urlInstance = new URL(url);
		if(urlInstance.host == 'www.youtube.com' || urlInstance.host == 'youtube.com' || urlInstance.host == 'm.youtube.com')
			canonicalUrl = 'https://www.youtube.com/watch?v='+urlInstance.searchParams.get('v');
		else if(urlInstance.host == 'youtu.be')
			canonicalUrl = 'https://www.youtube.com/watch?v='+urlInstance.pathname.replace(/^\//, '');
		return canonicalUrl;		
	}

	getInfo(url, cb) {
		url = this.getCanonicalUrl(url);
		https.get(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36'
			}
		}, (r) => {
			if(r.statusCode !== 200) {
				cb('Could not get YouTube info for '+url+'. Status code: ' + r.statusCode);
			} else {
				var html = '';
				r.on('data', chunk => html += chunk);
				r.on('end', () => {
					let match;
					if(match = html.match(/ytplayer\.config = (\{(.*?)\});/)) {
						var ytPlayerConfig = JSON.parse(match[1]);
						var ytPlayerResponse = JSON.parse(ytPlayerConfig.args.player_response);
						var ret = {
							url: url,
							title: ytPlayerResponse.videoDetails.title,
							thumbnail: ytPlayerResponse.videoDetails.thumbnail && ytPlayerResponse.videoDetails.thumbnail.thumbnails && ytPlayerResponse.videoDetails.thumbnail.thumbnails[0].url || null,
							duration: ytPlayerResponse.videoDetails.lengthSeconds
						};
						cb(null, ret);
					} else {
						cb('Could not parse YouTube data for '+url);
					}
				});
			}
		}).on('error', (e) => {
			cb('Error reading YouTube '+url+'. ')
		});
	}
}

module.exports = YouTube;
