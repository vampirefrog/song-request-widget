function EventEmitter() {
	this.listeners = {};
}

EventEmitter.prototype.on = function(eventName, fn) {
	if(!this.listeners[eventName])
		this.listeners[eventName] = [];
	this.listeners[eventName].push(fn);
};

EventEmitter.prototype.off = function(eventName, fn) {
	if(!this.listeners[eventName])
		return;

	for(let i = 0 ; i < this.listeners[eventName].length; i++) {
		if(this.listeners[eventName][i] == fn) {
			this.listeners[eventName].splice(i, 1);
			i--;
		}
	}
};

EventEmitter.prototype.once = function(eventName, fn) {
	var self = this;
	var f = function() {
		console.log('f getting called', self.listeners[eventName]);
		self.off(eventName, f);
		fn.apply(self, Array.prototype.slice.call(arguments, 0));
	};
	this.on(eventName, f);
};

EventEmitter.prototype.emit = function(eventName) {
	if(!this.listeners[eventName])
		return;

	for(var i in this.listeners[eventName]) {
		this.listeners[eventName][i].apply(this, Array.prototype.slice.call(arguments, 1));
	}
};

EventEmitter.prototype.removeAllListeners = function(eventName) {
	if(!this.listeners[eventName])
		return;

	this.listeners[eventName] = [];
};
