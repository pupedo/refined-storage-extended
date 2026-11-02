ModAPI.registerAPI("RefinedStorageExtendedAPI", {
	apiVersion: "2.0",
	items: RSE_ITEMS,
	hasRefinedStorage: function () {
		return RSE.hasRS();
	},
	config: function () {
		return Config;
	},
	log: function (msg) {
		return RSE.log(msg);
	},
	on: function (event, callback) {
		return _RSE.on(event, callback);
	}
});

var _RSE = {
	_listeners: {},
	on: function (event, callback) {
		if (!this._listeners[event]) this._listeners[event] = [];
		this._listeners[event].push(callback);
		return function () {
			var list = _RSE._listeners[event];
			if (list) _RSE._listeners[event] = list.filter(function (h) { return h !== callback; });
		};
	},
	_emit: function (event, data) {
		var list = this._listeners[event];
		if (list) for (var i in list) list[i](data);
	}
};

Logger.Log("RefinedStorageExtendedAPI Loaded", "API");
