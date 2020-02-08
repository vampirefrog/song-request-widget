const SongProvider = require('./songprovider');
const https = require('https');

class SoundCloud extends SongProvider {
	constructor() {
		super();
	}

	urlMatches(url) {
		return url.match(/^https?:\/\/(www\.)?soundcloud\.com\/[^/]+\/[^/]+$/);
	}

	getCanonicalUrl(url) {
		var canonicalUrl = url;
		var urlInstance = new URL(url);
		if(urlInstance.host == 'www.soundcloud.com' || urlInstance.host == 'soundcloud.com' || urlInstance.host == 'm.soundcloud.com')
			canonicalUrl = 'https://soundcloud.com/'+urlInstance.pathname.replace(/^\//, '').split('/').slice(0, 2).join('/');
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
				cb('Could not get SoundCloud info for '+url+'. Status code: ' + r.statusCode);
			} else {
				var html = '';
				r.on('data', chunk => html += chunk);
				r.on('end', () => {
					let match;
					if(match = html.match(/catch\(t\)\{\}\}\)\},(\[(.*?)\])\);/)) {
						var scData = JSON.parse(match[1]);
						var found = false;
						for(let i in scData) {
							for(let j in scData[i].data) {
								if(scData[i].data[j].title) {
									var ret = {
										url: url,
										title: scData[i].data[j].title,
										thumbnail: scData[i].data[j].artwork_url,
										duration: scData[i].data[j].duration / 1000.0,
									}
									cb(null, ret);
									found = true;
									break;
								}
							}
							if(found)
								break;
						}
						if(!found)
							cb('Could not read SoundCloud info from '+url);
					} else {
						cb('Could not parse SoundCloud data for '+url);
					}
				});
			}
		}).on('error', (e) => {
			cb('Error reading SoundCloud '+url+'. ');
		});
	}
}

module.exports = SoundCloud;
