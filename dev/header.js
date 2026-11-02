IMPORT("UiCore");
IMPORT("CoreKit:2");
IMPORT("SaveCore");
IMPORT("TickScheduler:2");

var Config = {
	reload: function () {
		var reload = Config.reload;
		var loaded = FileTools.ReadJSON(__dir__ + 'config.json') || {};
		loaded.reload = reload;
		loaded.requester = loaded.requester || {};
		loaded.requester.interval = loaded.requester.interval || 70;
		loaded.requester.energy = loaded.requester.energy || 10;
		loaded.requester.maxCraftAmount = loaded.requester.maxCraftAmount || 1000;
		loaded.requester.refreshMode = loaded.requester.refreshMode || 'poll';
		loaded.wirelessCraftingGrid = loaded.wirelessCraftingGrid || {};
		loaded.wirelessCraftingGrid.capacity = loaded.wirelessCraftingGrid.capacity || 3200;
		loaded.wirelessCraftingGrid.openUsage = loaded.wirelessCraftingGrid.openUsage || 30;
		loaded.wirelessCraftingGrid.extractUsage = loaded.wirelessCraftingGrid.extractUsage || 5;
		loaded.wirelessCraftingGrid.insertUsage = loaded.wirelessCraftingGrid.insertUsage || 5;
		loaded.wirelessCraftingGrid.craftUsage = loaded.wirelessCraftingGrid.craftUsage || 5;
		loaded.wirelessCraftingGrid.autocraftUsage = loaded.wirelessCraftingGrid.autocraftUsage || 10;
		loaded.wirelessCraftingGrid.clearUsage = loaded.wirelessCraftingGrid.clearUsage || 5;
		loaded.wirelessCraftingGrid.transferUsage = loaded.wirelessCraftingGrid.transferUsage || 5;
		loaded.wirelessCraftingGrid.noTransmitterMsg = loaded.wirelessCraftingGrid.noTransmitterMsg || 'There is no Wireless Transmitter in the network.';
		loaded.wirelessCraftingGrid.transmitterUnloadedMsg = loaded.wirelessCraftingGrid.transmitterUnloadedMsg || 'The Wireless Transmitter is not loaded.';
		loaded.cards = loaded.cards || {};
		loaded.cards.infinityUsage = loaded.cards.infinityUsage || 4000;
		loaded.cards.dimensionUsage = loaded.cards.dimensionUsage || 8000;
		loaded.crafters = loaded.crafters || {};
		loaded.storageBlocks = loaded.storageBlocks || {};
		loaded.detector = loaded.detector || {};
		loaded.detector.refreshMode = loaded.detector.refreshMode || 'poll';
		Config = loaded;
	}
};
Config.reload();

var RS = null;

var RSE_diskPersistenceMode = null;
var RSE_diskPersistenceModeResolved = false;

/* Extra-mode compatibility is on hold until the RS disk identity rework. */
var RSE_DISK_EXTRA_COMPAT_ENABLED = false;

var RSE = {
	log: function (msg) {
		Logger.Log("[RSE] " + msg, "RefinedStorageExtended");
	},
	logDev: function (msg) {
		if (Config.dev) Logger.Log("[RSE-DEV] " + msg, "RefinedStorageDebug");
	},
	requireItem: function (name) {
		if (RSE.itemReady[name] === false) {
			RSE.log("item not ready: " + name);
			return 0;
		}
		var id = ItemID[name];
		if (!id) {
			RSE.log("missing item: " + name);
			return 0;
		}
		return id;
	},
	itemCreated: {},
	itemReady: {},
	hasCoreIds: function (ids) {
		for (var i = 0; i < ids.length; i++) if (!ids[i]) return false;
		return true;
	},
	apiAtLeast: function (api, major, minor) {
		var version = String(api && api.apiVersion || '');
		var parts = version.split('.');
		var currentMajor = parseInt(parts[0], 10);
		var currentMinor = parseInt(parts[1] || '0', 10);
		if (isNaN(currentMajor)) return false;
		if (isNaN(currentMinor)) currentMinor = 0;
		return currentMajor > major || (currentMajor == major && currentMinor >= minor);
	},
	getDiskPersistenceMode: function () { return RSE_diskPersistenceMode; },
	hasRS: function () {
		return RS !== null;
	}
};

function RSE_isApiMajorTwo(api) {
	var version = String(api && api.apiVersion || '');
	var parts = version.split('.');
	return parseInt(parts[0], 10) === 2;
}

function RSE_resolveDiskPersistenceMode(api) {
	if (!RSE_DISK_EXTRA_COMPAT_ENABLED) return 'savecore';
	if (!api || !RSE.apiAtLeast(api, 2, 0)) return null;

	/* API major 2 is the current line: strict fallback until the future major update. */
	if (!RSE_isApiMajorTwo(api) && api.disks &&
		typeof api.disks.getPersistenceMode === 'function') {
		try {
			var mode = api.disks.getPersistenceMode();
			return (mode === 'savecore' || mode === 'extra') ? mode : null;
		} catch (e) {
			return null;
		}
	}

	if (typeof api.requireGlobal === 'function') {
		try {
			var value = api.requireGlobal(
				'typeof RS_DISK_DATA_IN_EXTRA == "undefined" ? null : RS_DISK_DATA_IN_EXTRA'
			);
			if (value === true) return 'extra';
			if (value === false) return 'savecore';
		} catch (e2) {}
	}
	return null;
}

ModAPI.addAPICallback("RefinedStorageAPI", function (api) {
	if (!api || !RSE.apiAtLeast(api, 2, 0)) {
		Logger.Log("[RSE] RefinedStorageAPI 2.0 required; extended features disabled", "RefinedStorageExtended");
		return;
	}
	RS = api;
	if (!RSE_diskPersistenceModeResolved) {
		RSE_diskPersistenceMode = RSE_resolveDiskPersistenceMode(api);
		RSE_diskPersistenceModeResolved = true;
		RSE.log("Disk persistence mode: " + RSE_diskPersistenceMode +
			(RSE_DISK_EXTRA_COMPAT_ENABLED ? "" : " (extra compatibility paused)"));
	}
	if (Config.dev) Logger.Log("[RSE] RefinedStorageAPI attached, apiVersion=" + (api ? api.apiVersion : "null"), "RefinedStorageExtended");
});

var RSE_netRefresh = {};

Callback.addCallback("LevelLeft", function () {
	RSE_netRefresh = {};
});

function RSE_refreshNetItems(api, netId, now) {
	if (netId === undefined || netId === null || netId == 'f') return;
	var last = RSE_netRefresh[netId] || 0;
	if (now < last) last = 0;
	if (now - last < 5) return;
	RSE_netRefresh[netId] = now;
	if (api.networks && typeof api.networks.refreshItems == 'function') {
		api.networks.refreshItems(netId);
		return;
	}
	var nets = api.getNetworks && api.getNetworks();
	var info = nets && nets[netId] && nets[netId].info;
	if (info && typeof info.updateItems == 'function') info.updateItems();
}
