var RSE_STORAGE_SCOPE_NAME = "RSEStorageBlocksV2";
var RSE_STORAGE_MAX_ID = 2147483647;
var RSE_ITEM_ID_MIN = -2147483648;
var RSE_ITEM_ID_MAX = 2147483647;

/* Runtime ownership mirrors. They are rebuilt on load and never persisted. */
var RSE_storageOwners = {};
var RSE_storageByCoords = {};
var RSE_storageDrops = {};
var RSE_storageExtraDropPayloads = {};
var RSE_storagePopHandled = {};
var RSE_storageWarned = {};

var RSE_storagePendingRefresh = {};
var RSE_storageRefreshScheduled = false;
var RSE_storageOpenTiles = {};
var RSE_storageLoadedTiles = {};
var RSE_storageDirtyTiles = {};

var RSE_storageScope = null;

var RSE_STORAGE_KIND_SCOPE = "scope";
var RSE_STORAGE_KIND_EXTRA = "extra";
var RSE_STORAGE_PAYLOAD_KEY = "rseStorageData";
var RSE_STORAGE_PAYLOAD_VERSION = 1;

function RSE_storageDefaultData() {
	return { nextStorageId: 1, entries: {} };
}

function RSE_storageWarnOnce(key, message) {
	if (Object.prototype.hasOwnProperty.call(RSE_storageWarned, key)) return;
	RSE_storageWarned[key] = true;
	RSE.log(message);
}

function RSE_storageParseInteger(value) {
	if (typeof value === "string") {
		if (!/^[0-9]+$/.test(value)) return null;
		value = parseInt(value, 10);
	}
	if (typeof value !== "number" || !isFinite(value)) return null;
	if (Math.floor(value) !== value) return null;
	return value;
}

function RSE_storageParseId(value) {
	var id = RSE_storageParseInteger(value);
	if (id === null || id < 1 || id > RSE_STORAGE_MAX_ID) return 0;
	return id;
}

/* Item ids are signed: negative ids are valid items, 0 means empty. */
function RSE_storageParseItemId(value) {
	if (typeof value === "string") {
		if (!/^-?[0-9]+$/.test(value)) return 0;
		value = parseInt(value, 10);
	}
	if (typeof value !== "number" || !isFinite(value)) return 0;
	if (Math.floor(value) !== value) return 0;
	if (value === 0) return 0;
	if (value < RSE_ITEM_ID_MIN || value > RSE_ITEM_ID_MAX) return 0;
	return value;
}

function RSE_storageParsePositiveCount(value) {
	var count = RSE_storageParseInteger(value);
	if (count === null || count < 1) return 0;
	return count;
}

function RSE_storageParseNonNegativeCount(value) {
	var count = RSE_storageParseInteger(value);
	if (count === null || count < 0) return 0;
	return count;
}

function RSE_storageParseCapacity(value) {
	var capacity = RSE_storageParseInteger(value);
	if (capacity === null || capacity < 1) return 0;
	return capacity;
}

function RSE_storageParseData(value) {
	var data = RSE_storageParseInteger(value);
	return data === null ? 0 : data;
}

/* Place contract: a refused placement restores the held stack (b128 mechanism UNRESOLVED). */
function RSE_storageCancelPlacement(item) {
	if (item && typeof item.count === "number") item.count++;
}

function RSE_storageIsCanonicalKey(key, id) {
	return String(id) === String(key);
}

/* Copies the extra so fold() never mutates the live identity/contents. */
function RSE_storageCopyExtra(extra) {
	if (!extra) return null;
	try {
		if (typeof extra.copy === "function") {
			var copiedExtra = extra.copy();
			if (copiedExtra && copiedExtra !== extra) return copiedExtra;
		}
	} catch (copyError) {}
	try {
		if (typeof ItemExtraData !== "undefined" && ItemExtraData &&
			typeof ItemExtraData.cloneExtra === "function") {
			var clonedExtra = ItemExtraData.cloneExtra(extra);
			if (clonedExtra && clonedExtra !== extra) return clonedExtra;
		}
	} catch (cloneError) {}
	return null;
}

/* Item extra <-> plain JSON. Reads a folded copy when available; folds the live entry as a legacy fallback. */
function RSE_storageExtraToPlain(extra) {
	if (!extra) return null;
	var readableExtra = RSE_storageCopyExtra(extra);
	if (!readableExtra) {
		/* Legacy fallback: no safe copy available, fold the live extra in place. */
		RSE_storageWarnOnce("extra-copy-missing", "storage block extra copy is unavailable; folding the live extra");
		readableExtra = extra;
	}
	/* Copy readable compound NBT into $rs.nbt so it survives the plain JSON save. */
	if (typeof CoreKit !== "undefined" && CoreKit.ItemContent && typeof CoreKit.ItemContent.fold === "function") {
		try { CoreKit.ItemContent.fold(readableExtra); } catch (foldError) {}
	}
	var plain = {};
	var hasData = false;
	try {
		var enchants = readableExtra.getEnchants();
		var enchantPairs = [];
		for (var enchantId in enchants) {
			if (!Object.prototype.hasOwnProperty.call(enchants, enchantId)) continue;
			enchantPairs.push([Number(enchantId), Number(enchants[enchantId])]);
		}
		if (enchantPairs.length) {
			plain.e = enchantPairs;
			hasData = true;
		}
	} catch (e) {}
	try {
		var customName = readableExtra.getCustomName();
		if (customName) {
			plain.n = String(customName);
			hasData = true;
		}
	} catch (e2) {}
	try {
		var customData = readableExtra.getAllCustomData();
		if (customData) {
			plain.m = String(customData);
			hasData = true;
		}
	} catch (e3) {}
	return hasData ? plain : null;
}

function RSE_storageExtraFromPlain(plain) {
	if (!plain || typeof plain !== "object") return null;
	if (typeof plain.getEnchants === "function" || typeof plain.getAllCustomData === "function") {
		try {
			if (typeof plain.isEmpty === "function" && plain.isEmpty()) return null;
		} catch (e) {}
		return plain;
	}
	var extra = null;
	try { extra = new ItemExtraData(); } catch (e2) { return null; }
	try {
		var enchantPairs = Array.isArray(plain.e) ? plain.e : [];
		for (var enchantIndex = 0; enchantIndex < enchantPairs.length; enchantIndex++) {
			var pair = enchantPairs[enchantIndex];
			if (!pair || pair.length < 2) continue;
			extra.addEnchant(pair[0], pair[1]);
		}
	} catch (e3) {}
	try { if (plain.n) extra.setCustomName(String(plain.n)); } catch (e4) {}
	try { if (plain.m) extra.setAllCustomData(String(plain.m)); } catch (e5) {}
	try {
		if (typeof extra.isEmpty === "function" && extra.isEmpty()) return null;
	} catch (e6) {}
	return extra;
}

function RSE_storageExtraIdentityKey(extra) {
	if (!extra) return "";
	if (typeof CoreKit !== "undefined" && CoreKit && CoreKit.ItemContent &&
		typeof CoreKit.ItemContent.content === "function") {
		var content = CoreKit.ItemContent.content(extra);
		return content === null ? null : content;
	}
	if (typeof fullExtraToString === "function") {
		try {
			var asString = fullExtraToString(extra);
			if (asString) return asString;
		} catch (e) {}
	}
	if (typeof extra.asJson === "function") {
		try {
			var asJson = extra.asJson();
			if (asJson) return String(asJson);
		} catch (e2) {}
	}
	if (typeof extra.getValue === "function") {
		try {
			var value = extra.getValue();
			if (value !== undefined && value !== null && value !== "") return String(value);
		} catch (e3) {}
	}
	return null;
}

function RSE_storageStackIdentity(stack) {
	if (typeof CoreKit !== "undefined" && CoreKit && CoreKit.Items &&
		typeof CoreKit.Items.uidOf === "function") {
		if (CoreKit.ItemContent && typeof CoreKit.ItemContent.content === "function") {
			if (CoreKit.ItemContent.content(stack.extra) === null) return null;
		}
		return CoreKit.Items.uidOf({ id: stack.id, data: stack.data, extra: stack.extra });
	}
	var extraKey = RSE_storageExtraIdentityKey(stack.extra);
	if (extraKey === null) return null;
	return stack.id + ":" + stack.data + ":" + extraKey;
}

function RSE_storageSameStack(left, right) {
	if (!left || !right) return false;
	if (left.id !== right.id || left.data !== right.data) return false;
	if (typeof CoreKit !== "undefined" && CoreKit && CoreKit.ItemContent &&
		typeof CoreKit.ItemContent.sameExtra === "function") {
		return CoreKit.ItemContent.sameExtra(left.extra, right.extra);
	}
	var leftKey = RSE_storageExtraIdentityKey(left.extra);
	var rightKey = RSE_storageExtraIdentityKey(right.extra);
	return leftKey !== null && rightKey !== null && leftKey === rightKey;
}

function RSE_storageNormalizeStacks(rawStacks) {
	var stacks = [];
	if (!Array.isArray(rawStacks)) return stacks;
	var positionByUid = {};
	for (var i = 0; i < rawStacks.length; i++) {
		var rawStack = rawStacks[i];
		if (!rawStack || typeof rawStack !== "object") {
			RSE_storageWarnOnce("stack-shape", "storage block save contains a malformed stack");
			continue;
		}
		var stackId = RSE_storageParseItemId(rawStack.id);
		var count = RSE_storageParsePositiveCount(rawStack.count);
		if (!stackId || !count) {
			RSE_storageWarnOnce("stack-content", "storage block save contains an invalid stack id or count");
			continue;
		}
		var stack = {
			id: stackId,
			data: RSE_storageParseData(rawStack.data),
			count: count,
			extra: RSE_storageExtraFromPlain(rawStack.extra)
		};
		var uid = RSE_storageStackIdentity(stack);
		if (uid !== null && Object.prototype.hasOwnProperty.call(positionByUid, uid)) {
			var existing = stacks[positionByUid[uid]];
			if (existing && RSE_storageSameStack(existing, stack)) {
				existing.count += stack.count;
				continue;
			}
		}
		if (uid !== null) positionByUid[uid] = stacks.length;
		stacks.push(stack);
	}
	/* Input order is preserved; sorting is intentionally removed. */
	return stacks;
}

function RSE_storageCountStored(stacks) {
	var stored = 0;
	for (var i = 0; i < stacks.length; i++) stored += stacks[i].count;
	return stored;
}

function RSE_storageIsExtraMode() {
	return !!(RSE && RSE.getDiskPersistenceMode && RSE.getDiskPersistenceMode() === 'extra');
}

function RSE_storageKindOf(tile) {
	if (!tile || !tile.data) return "";
	var kind = tile.data.rseStorageKind;
	if (kind === RSE_STORAGE_KIND_SCOPE || kind === RSE_STORAGE_KIND_EXTRA) return kind;
	return "";
}

function RSE_storageTileHasExtraPayload(tile) {
	if (!tile || !tile.data) return false;
	if (RSE_storageKindOf(tile) === RSE_STORAGE_KIND_EXTRA) return true;
	if (Array.isArray(tile.data.stacks)) return true;
	return tile.data.storage !== undefined && tile.data.storage !== null && tile.data.storage !== "";
}

/* Runtime stacks -> plain mirror. Runtime metadata (for example _scMetaId) never leaks. */
function RSE_storagePlainStacks(stacks) {
	var plainStacks = [];
	if (!Array.isArray(stacks)) return plainStacks;
	for (var i = 0; i < stacks.length; i++) {
		var stack = stacks[i];
		if (!stack || typeof stack !== "object") continue;
		var stackId = RSE_storageParseItemId(stack.id);
		var count = RSE_storageParsePositiveCount(stack.count);
		if (!stackId || !count) continue;
		plainStacks.push({
			id: stackId,
			data: RSE_storageParseData(stack.data),
			count: count,
			extra: RSE_storageExtraToPlain(stack.extra)
		});
	}
	return plainStacks;
}

function RSE_storageBuildPayload(storage, stacks) {
	var payload = {
		v: RSE_STORAGE_PAYLOAD_VERSION,
		storage: storage,
		items_stored: RSE_storageCountStored(stacks),
		stacks: stacks
	};
	try {
		return JSON.stringify(payload);
	} catch (e) {
		RSE.log("storage block payload serialization failed: " + e);
		return null;
	}
}

function RSE_storagePayloadStacksValid(stacks) {
	if (!Array.isArray(stacks)) return false;
	for (var i = 0; i < stacks.length; i++) {
		var stack = stacks[i];
		if (!stack || typeof stack !== "object" || Array.isArray(stack)) return false;
		if (!RSE_storageParseItemId(stack.id)) return false;
		if (RSE_storageParseInteger(stack.data) === null) return false;
		if (!RSE_storageParsePositiveCount(stack.count)) return false;
		if (stack.extra !== null && stack.extra !== undefined &&
			(typeof stack.extra !== "object" || Array.isArray(stack.extra))) return false;
	}
	return true;
}

/* Returns undefined when the item has no payload, null when the payload is invalid. */
function RSE_storageReadItemPayload(item) {
	if (!item || !item.extra || typeof item.extra.getString !== "function") return undefined;
	var raw = null;
	try { raw = item.extra.getString(RSE_STORAGE_PAYLOAD_KEY, null); } catch (e) { return undefined; }
	if (raw === null || raw === undefined || raw === "" || raw === "null") return undefined;
	var payload = null;
	try { payload = JSON.parse(raw); } catch (e2) { return null; }
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
	if (payload.v !== RSE_STORAGE_PAYLOAD_VERSION) return null;
	var capacity = RSE_storageParseCapacity(payload.storage);
	if (!capacity) return null;
	if (!RSE_storagePayloadStacksValid(payload.stacks)) return null;
	return { storage: capacity, stacks: RSE_storageNormalizeStacks(payload.stacks) };
}

function RSE_storageSyncRuntimeToPlain(tile, entry) {
	if (!RSE_storageIsExtraMode()) return false;
	if (!tile || !tile.data || !entry) return false;
	var storage = RSE_storageParseCapacity(entry.storage);
	if (!storage) return false;
	if (!Array.isArray(entry.stacks)) entry.stacks = [];
	var stacks = RSE_storagePlainStacks(entry.stacks);
	var stored = RSE_storageCountStored(stacks);
	entry.items_stored = stored;
	tile.data.storage = storage;
	tile.data.items_stored = stored;
	tile.data.stacks = stacks;
	tile.data.storageId = -1;
	tile.data.rseStorageKind = RSE_STORAGE_KIND_EXTRA;
	tile.data.rseStorageVersion = RSE_STORAGE_PAYLOAD_VERSION;
	return true;
}

function RSE_storageEmptyEntry(tier) {
	return { storage: tier.capacity, items_stored: 0, stacks: [] };
}

function RSE_storageRememberTile(tile) {
	if (!tile || tile.remove) return;
	RSE_storageLoadedTiles[RSE_storageTileKey(tile)] = tile;
}

function RSE_storageHydrateExtraTile(tile, tier) {
	if (!tile) return null;
	if (!tile.data) tile.data = {};
	RSE_storageRememberTile(tile);
	var hasCapacity = tile.data.storage !== undefined && tile.data.storage !== null && tile.data.storage !== "";
	var capacity = hasCapacity ? RSE_storageParseCapacity(tile.data.storage) : tier.capacity;
	var stacks = RSE_storageNormalizeStacks(tile.data.stacks);
	var stored = RSE_storageCountStored(stacks);
	if (!capacity || capacity !== tier.capacity || stored > capacity) {
		RSE.log("storage block offline: invalid capacity or contents at " + RSE_storageTileKey(tile));
		var offlineEntry = RSE_storageEmptyEntry(tier);
		tile._rseStorageEntry = offlineEntry;
		tile._rseStorageInvalid = true;
		return offlineEntry;
	}
	var entry = { storage: capacity, items_stored: stored, stacks: stacks };
	tile._rseStorageEntry = entry;
	tile._rseStorageInvalid = false;
	RSE_storageSyncRuntimeToPlain(tile, entry);
	tile.data.storageId = -1;
	return entry;
}

function RSE_storageDeserializeScope(raw) {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return RSE_storageDefaultData();
	var entries = {};
	var maxId = 0;
	var legacyShape = Object.prototype.hasOwnProperty.call(raw, "items");
	var rawEntries = raw.entries;
	if (Array.isArray(rawEntries)) {
		for (var listIndex = 0; listIndex < rawEntries.length; listIndex++) {
			var listEntry = rawEntries[listIndex];
			if (!listEntry || typeof listEntry !== "object" || Array.isArray(listEntry)) continue;
			var listEntryId = RSE_storageParseId(listEntry.id);
			if (!listEntryId) continue;
			var listCapacity = RSE_storageParseCapacity(listEntry.storage);
			if (!listCapacity) continue;
			var listStacks = RSE_storageNormalizeStacks(listEntry.stacks);
			var listStored = RSE_storageCountStored(listStacks);
			entries[String(listEntryId)] = {
				storage: listCapacity,
				items_stored: listStored,
				stacks: listStacks
			};
			if (listEntryId > maxId) maxId = listEntryId;
		}
		RSE.log("storage scope deserialize: rawArray=true count=" + rawEntries.length +
			" resultKeys=" + Object.keys(entries).join(","));
	} else if (rawEntries && typeof rawEntries === "object") {
		var rawEntryKeys = [];
		if (typeof rawEntries.getIds === "function") {
			var rawIds = rawEntries.getIds();
			var rawIdCount = rawIds && typeof rawIds.length === "number" ? rawIds.length : 0;
			for (var rawIdIndex = 0; rawIdIndex < rawIdCount; rawIdIndex++) {
				rawEntryKeys.push(String(rawIds[rawIdIndex]));
			}
		} else {
			for (var rawKey in rawEntries) {
				rawEntryKeys.push(rawKey);
			}
		}
		RSE.log("storage scope deserialize: rawKeys=" + rawEntryKeys.join(",") +
			" rawIds=" + (typeof rawEntries.getIds === "function" ? "yes" : "no") +
			" next=" + raw.nextStorageId);
		if (rawEntryKeys.length) {
			RSE.log("storage scope deserialize firstKey=" + rawEntryKeys[0] +
				" valueType=" + (typeof rawEntries[RSE_storageParseId(rawEntryKeys[0])]));
		}
		for (var rawKeyIndex = 0; rawKeyIndex < rawEntryKeys.length; rawKeyIndex++) {
			var key = rawEntryKeys[rawKeyIndex];
			var entryId = RSE_storageParseId(key);
			if (!entryId || !RSE_storageIsCanonicalKey(key, entryId)) {
				RSE_storageWarnOnce("entry-key:" + key, "storage block save contains an invalid entry key: " + key);
				continue;
			}
			var rawEntry = rawEntries[entryId];
			if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
				RSE_storageWarnOnce("entry-shape:" + key, "storage block save contains a malformed entry: " + key);
				continue;
			}
			if (Object.prototype.hasOwnProperty.call(rawEntry, "items")) legacyShape = true;
			var capacity = RSE_storageParseCapacity(rawEntry.storage);
			if (!capacity) {
				RSE_storageWarnOnce("entry-capacity:" + key, "storage block entry has an invalid capacity: " + key);
				continue;
			}
			if (!Array.isArray(rawEntry.stacks)) {
				RSE_storageWarnOnce("entry-stacks:" + key, "storage block entry stacks missing; normalized to empty: " + key);
			}
			var stacks = RSE_storageNormalizeStacks(rawEntry.stacks);
			var stored = RSE_storageCountStored(stacks);
			if (Object.prototype.hasOwnProperty.call(rawEntry, "items_stored") &&
				RSE_storageParseNonNegativeCount(rawEntry.items_stored) !== stored) {
				RSE_storageWarnOnce("entry-stored:" + key, "storage block entry items_stored was recomputed: " + key);
			}
			entries[String(entryId)] = {
				storage: capacity,
				items_stored: stored,
				stacks: stacks
			};
			if (entryId > maxId) maxId = entryId;
		}
	}
	RSE.log("storage scope deserialize: rawType=" + (typeof rawEntries) +
		" rawArray=" + Array.isArray(rawEntries) +
		" resultKeys=" + Object.keys(entries).join(",") +
		" next=" + raw.nextStorageId);
	var nextStorageId = RSE_storageParseId(raw.nextStorageId) || 1;
	if (nextStorageId < maxId + 1) {
		nextStorageId = maxId >= RSE_STORAGE_MAX_ID ? RSE_STORAGE_MAX_ID : maxId + 1;
	}
	var data = { nextStorageId: nextStorageId, entries: entries };
	if (legacyShape) data._legacyItems = true;
	return data;
}

function RSE_storageSerializeScope(source) {
	var sourceData = source && typeof source === "object" && !Array.isArray(source) ? source : RSE_storageDefaultData();
	var sourceEntries = sourceData.entries;
	RSE.log("storage scope serialize: entriesType=" + (typeof sourceEntries) +
		" array=" + Array.isArray(sourceEntries) +
		" keys=" + (sourceEntries ? Object.keys(sourceEntries).join(",") : "null") +
		" next=" + sourceData.nextStorageId);
	if (!sourceEntries || typeof sourceEntries !== "object" || Array.isArray(sourceEntries)) sourceEntries = {};
	var serializedEntries = [];
	var maxId = 0;
	for (var key in sourceEntries) {
		if (!Object.prototype.hasOwnProperty.call(sourceEntries, key)) continue;
		var entryId = RSE_storageParseId(key);
		if (!entryId || !RSE_storageIsCanonicalKey(key, entryId)) continue;
		var entry = sourceEntries[key];
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
		var capacity = RSE_storageParseCapacity(entry.storage);
		if (!capacity) continue;
		var stacks = [];
		var stored = 0;
		var sourceStacks = Array.isArray(entry.stacks) ? entry.stacks : [];
		for (var i = 0; i < sourceStacks.length; i++) {
			var sourceStack = sourceStacks[i];
			if (!sourceStack || typeof sourceStack !== "object") continue;
			var stackId = RSE_storageParseItemId(sourceStack.id);
			var count = RSE_storageParsePositiveCount(sourceStack.count);
			if (!stackId || !count) continue;
			stacks.push({
				id: stackId,
				data: RSE_storageParseData(sourceStack.data),
				count: count,
				extra: RSE_storageExtraToPlain(sourceStack.extra)
			});
			stored += count;
		}
		serializedEntries.push({
			id: entryId,
			storage: capacity,
			items_stored: stored,
			stacks: stacks
		});
		if (entryId > maxId) maxId = entryId;
	}
	var nextStorageId = RSE_storageParseId(sourceData.nextStorageId) || 1;
	if (nextStorageId < maxId + 1) {
		nextStorageId = maxId >= RSE_STORAGE_MAX_ID ? RSE_STORAGE_MAX_ID : maxId + 1;
	}
	return { nextStorageId: nextStorageId, entries: serializedEntries };
}

function RSE_storageValidateScope(data) {
	if (!data || typeof data !== "object" || Array.isArray(data)) return false;
	if (data._legacyItems) return false;
	if (Object.prototype.hasOwnProperty.call(data, "items")) return false;
	if (!RSE_storageParseId(data.nextStorageId)) return false;
	var entries = data.entries;
	if (!entries || typeof entries !== "object" || Array.isArray(entries)) return false;
	for (var key in entries) {
		if (!Object.prototype.hasOwnProperty.call(entries, key)) continue;
		var entryId = RSE_storageParseId(key);
		if (!entryId || !RSE_storageIsCanonicalKey(key, entryId)) return false;
		var entry = entries[key];
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
		if (Object.prototype.hasOwnProperty.call(entry, "items")) return false;
		if (!RSE_storageParseCapacity(entry.storage)) return false;
		var stored = RSE_storageParseInteger(entry.items_stored);
		if (stored === null || stored < 0) return false;
		if (!Array.isArray(entry.stacks)) return false;
		for (var i = 0; i < entry.stacks.length; i++) {
			var stack = entry.stacks[i];
			if (!stack || typeof stack !== "object" || Array.isArray(stack)) return false;
			if (!RSE_storageParseItemId(stack.id)) return false;
			if (RSE_storageParseInteger(stack.data) === null) return false;
			if (!RSE_storageParsePositiveCount(stack.count)) return false;
			if (stack.extra !== null && stack.extra !== undefined && typeof stack.extra !== "object") return false;
		}
	}
	return true;
}

RSE_storageScope = SaveCore.scope(RSE_STORAGE_SCOPE_NAME, {
	version: 1,
	defaults: function () { return RSE_storageDefaultData(); },
	validate: RSE_storageValidateScope,
	serialize: RSE_storageSerializeScope,
	deserialize: RSE_storageDeserializeScope,
	onLevelLeft: function () {
		RSE_storageOwners = {};
		RSE_storageByCoords = {};
		RSE_storageDrops = {};
		RSE_storageExtraDropPayloads = {};
		RSE_storagePopHandled = {};
		RSE_storageWarned = {};
		RSE_storagePendingRefresh = {};
		RSE_storageOpenTiles = {};
		RSE_storageLoadedTiles = {};
		RSE_storageDirtyTiles = {};
	}
});

function RSE_storageData() {
	if (!RSE_storageScope) return RSE_storageDefaultData();
	if (!RSE_storageScope.data || typeof RSE_storageScope.data !== "object" ||
		Array.isArray(RSE_storageScope.data)) {
		RSE_storageScope.data = RSE_storageDefaultData();
	}
	var data = RSE_storageScope.data;
	if (!data.entries || typeof data.entries !== "object" || Array.isArray(data.entries)) {
		RSE.log("storage scope data reset: entriesType=" + (typeof data.entries) +
			" array=" + Array.isArray(data.entries) +
			" next=" + data.nextStorageId);
		data.entries = {};
	}
	var nextStorageId = RSE_storageParseId(data.nextStorageId);
	data.nextStorageId = nextStorageId ? nextStorageId : 1;
	return data;
}

function RSE_storageEntryOfId(storageId) {
	var id = RSE_storageParseId(storageId);
	if (!id) return null;
	var data = RSE_storageData();
	var key = String(id);
	if (!Object.prototype.hasOwnProperty.call(data.entries, key)) return null;
	var entry = data.entries[key];
	if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
	return entry;
}

function RSE_allocStorageId() {
	var data = RSE_storageData();
	var storageId = RSE_storageParseId(data.nextStorageId) || 1;
	while (Object.prototype.hasOwnProperty.call(data.entries, String(storageId))) {
		storageId++;
		if (storageId > RSE_STORAGE_MAX_ID) {
			RSE.log("storage id space exhausted");
			return 0;
		}
	}
	data.nextStorageId = storageId >= RSE_STORAGE_MAX_ID ? RSE_STORAGE_MAX_ID : storageId + 1;
	return storageId;
}

function RSE_storageSourceDimension(source) {
	if (source && typeof source.getDimension === "function") {
		try {
			var dimension = source.getDimension();
			if (dimension !== undefined && dimension !== null) return dimension;
		} catch (e) {}
	}
	if (source && source.dimension !== undefined && source.dimension !== null) return source.dimension;
	return 0;
}

function RSE_storageCoordsKey(dimension, coords) {
	return dimension + ":" + cts(coords);
}

function RSE_storageTileKey(tile) {
	var source = tile && tile.blockSource ? tile.blockSource : tile;
	return RSE_storageCoordsKey(RSE_storageSourceDimension(source), tile);
}

function RSE_storageRegionKey(region, coords) {
	return RSE_storageCoordsKey(RSE_storageSourceDimension(region), coords);
}

function RSE_storageCanOwn(storageId, coordsKey) {
	var id = RSE_storageParseId(storageId);
	if (!id) return false;
	var ownerKey = Object.prototype.hasOwnProperty.call(RSE_storageOwners, String(id))
		? RSE_storageOwners[String(id)] : null;
	if (ownerKey !== null && ownerKey !== coordsKey) return false;
	var coordsOwner = Object.prototype.hasOwnProperty.call(RSE_storageByCoords, coordsKey)
		? RSE_storageByCoords[coordsKey] : 0;
	if (coordsOwner && coordsOwner !== id) return false;
	return true;
}

function RSE_storageRegisterOwner(storageId, tileOrCoordsKey) {
	var id = RSE_storageParseId(storageId);
	if (!id) return false;
	var coordsKey = typeof tileOrCoordsKey === "string" ? tileOrCoordsKey : RSE_storageTileKey(tileOrCoordsKey);
	if (!RSE_storageCanOwn(id, coordsKey)) return false;
	RSE_storageOwners[String(id)] = coordsKey;
	RSE_storageByCoords[coordsKey] = id;
	return true;
}

function RSE_storageUnregisterCoords(coordsKey) {
	if (!coordsKey) return;
	var storageId = Object.prototype.hasOwnProperty.call(RSE_storageByCoords, coordsKey)
		? RSE_storageByCoords[coordsKey] : 0;
	if (storageId) delete RSE_storageByCoords[coordsKey];
	for (var ownerId in RSE_storageOwners) {
		if (!Object.prototype.hasOwnProperty.call(RSE_storageOwners, ownerId)) continue;
		if (RSE_storageOwners[ownerId] === coordsKey) delete RSE_storageOwners[ownerId];
	}
}

function RSE_storageTileId(tile) {
	if (!tile || !tile.data) return 0;
	var storageId = RSE_storageParseId(tile.data.storageId);
	if (storageId) return storageId;
	var coordsKey = RSE_storageTileKey(tile);
	if (Object.prototype.hasOwnProperty.call(RSE_storageByCoords, coordsKey)) {
		return RSE_storageParseId(RSE_storageByCoords[coordsKey]);
	}
	return 0;
}

function RSE_storageMappedId(coordsKey) {
	if (Object.prototype.hasOwnProperty.call(RSE_storageDrops, coordsKey)) {
		return RSE_storageParseId(RSE_storageDrops[coordsKey]);
	}
	if (Object.prototype.hasOwnProperty.call(RSE_storageByCoords, coordsKey)) {
		return RSE_storageParseId(RSE_storageByCoords[coordsKey]);
	}
	return 0;
}

function RSE_storageItemStorageId(item) {
	if (!item || !item.extra || typeof item.extra.getInt !== "function") return 0;
	try { return RSE_storageParseId(item.extra.getInt("rseStorageId", -1)); } catch (e) { return 0; }
}

function RSE_storageSyncOwnership(tile) {
	if (!tile || !tile.data) return;
	var storageId = RSE_storageParseId(tile.data.storageId);
	if (!storageId) return;
	var entry = RSE_storageEntryOfId(storageId);
	if (!entry) {
		RSE_storageWarnOnce("sync-missing:" + storageId,
			"storage block ownership skipped: entry " + storageId + " is missing");
		return;
	}
	var coordsKey = RSE_storageTileKey(tile);
	if (!RSE_storageCanOwn(storageId, coordsKey)) {
		RSE.log("storage block ownership conflict at " + coordsKey + " for storage " + storageId);
		return;
	}
	RSE_storageRegisterOwner(storageId, coordsKey);
}

function RSE_storageProviderEntry(tile, capacity) {
	if (!tile || !tile.data) return null;
	var storageId = RSE_storageParseId(tile.data.storageId);
	if (!storageId) {
		RSE_storageWarnOnce("provider-no-id:" + RSE_storageTileKey(tile),
			"storage block provider skipped: tile has no storageId");
		return null;
	}
	var entry = RSE_storageEntryOfId(storageId);
	if (!entry) {
		RSE_storageWarnOnce("provider-missing:" + storageId,
			"storage block provider skipped: entry " + storageId + " is missing");
		return null;
	}
	if (entry.storage !== capacity) {
		RSE_storageWarnOnce("provider-tier:" + storageId,
			"storage block provider skipped: tier/capacity mismatch for storage " + storageId);
		return null;
	}
	if (entry.items_stored > entry.storage) {
		RSE_storageWarnOnce("provider-overflow:" + storageId,
			"storage block provider skipped: stored items exceed capacity for storage " + storageId);
		return null;
	}
	if (!RSE_storageRegisterOwner(storageId, RSE_storageTileKey(tile))) {
		RSE_storageWarnOnce("provider-owner:" + storageId,
			"storage block provider skipped: storage " + storageId + " is owned by another tile");
		return null;
	}
	return entry;
}

function RSE_storageProviderFor(tier) {
	return {
		getEntries: function (tile) {
			if (RSE_storageIsExtraMode()) {
				var runtimeEntry = RSE_storageExtraEntryFor(tile, tier);
				return runtimeEntry ? [runtimeEntry] : [];
			}
			RSE_storageMigrateExtraToScope(tile, tier);
			var entry = RSE_storageProviderEntry(tile, tier.capacity);
			return entry ? [entry] : [];
		}
	};
}

function RSE_storageExtraEntryFor(tile, tier) {
	if (!tile) return null;
	/* Chunk reload drops the tile from RSE_storageLoadedTiles while _rseStorageEntry may
	 * survive; register it again so dirty sync and LevelPreLeft see it. */
	RSE_storageRememberTile(tile);
	if (!tile._rseStorageEntry && !tile._rseStorageInvalid) RSE_storageInitExtraTile(tile, tier);
	if (tile._rseStorageInvalid) {
		RSE_storageWarnOnce("provider-offline:" + RSE_storageTileKey(tile),
			"storage block provider skipped: tile payload is invalid");
		return null;
	}
	var entry = tile._rseStorageEntry;
	if (!entry) return null;
	if (entry.storage !== tier.capacity) {
		RSE_storageWarnOnce("provider-extra-tier:" + RSE_storageTileKey(tile),
			"storage block provider skipped: tier/capacity mismatch");
		return null;
	}
	if (entry.items_stored > entry.storage) {
		RSE_storageWarnOnce("provider-extra-overflow:" + RSE_storageTileKey(tile),
			"storage block provider skipped: stored items exceed capacity");
		return null;
	}
	return entry;
}

/* Extra mode load: runtime entry is authoritative; tile.data is only the mirror. */
function RSE_storageInitExtraTile(tile, tier) {
	if (!RSE_storageIsExtraMode()) return;
	if (!tile) return;
	if (!tile.data) tile.data = {};
	RSE_storageRememberTile(tile);
	var liveEntry = tile._rseStorageEntry;
	if (liveEntry && !tile._rseStorageInvalid) {
		RSE_storageSyncRuntimeToPlain(tile, liveEntry);
		return;
	}
	var hasPayload = RSE_storageTileHasExtraPayload(tile);
	if (!hasPayload) {
		var scopeStorageId = RSE_storageParseId(tile.data.storageId);
		var scopeEntry = scopeStorageId ? RSE_storageEntryOfId(scopeStorageId) : null;
		if (scopeEntry) {
			var scopeCapacity = RSE_storageParseCapacity(scopeEntry.storage);
			var scopeStacks = RSE_storageNormalizeStacks(scopeEntry.stacks);
			var scopeStored = RSE_storageCountStored(scopeStacks);
			if (!scopeCapacity || scopeCapacity !== tier.capacity || scopeStored > scopeCapacity) {
				RSE.log("storage block offline: invalid scope entry at " + RSE_storageTileKey(tile) +
					" (storage " + scopeStorageId + ")");
				tile._rseStorageEntry = RSE_storageEmptyEntry(tier);
				tile._rseStorageInvalid = true;
				return;
			}
			var migratedEntry = {
				storage: scopeCapacity,
				items_stored: scopeStored,
				stacks: scopeStacks
			};
			tile._rseStorageEntry = migratedEntry;
			tile._rseStorageInvalid = false;
			RSE_storageSyncRuntimeToPlain(tile, migratedEntry);
			delete RSE_storageData().entries[String(scopeStorageId)];
			RSE_storageUnregisterCoords(RSE_storageTileKey(tile));
			tile.data.storageId = -1;
			return;
		}
	}
	if (hasPayload) {
		RSE.log("storage block extra load: payload=true key=" + RSE_storageTileKey(tile) +
			" stored=" + tile.data.items_stored +
			" stacks=" + (Array.isArray(tile.data.stacks) ? tile.data.stacks.length : "not-array"));
		RSE_storageHydrateExtraTile(tile, tier);
		return;
	}
	var emptyEntry = RSE_storageEmptyEntry(tier);
	tile._rseStorageEntry = emptyEntry;
	tile._rseStorageInvalid = false;
	RSE_storageSyncRuntimeToPlain(tile, emptyEntry);
	tile.data.storageId = -1;
}

/* Savecore mode load from an extra payload: copy the payload into one scope entry, then clear it. */
function RSE_storageMigrateExtraToScope(tile, tier) {
	if (RSE_storageIsExtraMode()) return false;
	if (!RSE_storageTileHasExtraPayload(tile)) return false;
	var coordsKey = RSE_storageTileKey(tile);
	var hasCapacityField = tile.data.storage !== undefined && tile.data.storage !== null &&
		tile.data.storage !== "";
	var capacity = hasCapacityField ? RSE_storageParseCapacity(tile.data.storage) : tier.capacity;
	if (!capacity || capacity !== tier.capacity) {
		RSE.log("storage block migration skipped: invalid capacity or tier mismatch at " + coordsKey);
		return false;
	}
	var stacks = RSE_storageNormalizeStacks(tile.data.stacks);
	var stored = RSE_storageCountStored(stacks);
	if (stored > capacity) {
		RSE.log("storage block migration skipped: stored items exceed capacity at " + coordsKey);
		return false;
	}
	var storageId = RSE_storageParseId(tile.data.storageId);
	if (storageId) {
		var existingEntry = RSE_storageEntryOfId(storageId);
		if (!existingEntry || !RSE_storageCanOwn(storageId, coordsKey)) storageId = 0;
	}
	if (!storageId) {
		storageId = RSE_allocStorageId();
		if (!storageId) {
			RSE.log("storage block migration skipped: no free storage id at " + coordsKey);
			return false;
		}
		if (!RSE_storageCanOwn(storageId, coordsKey)) {
			RSE.log("storage block migration skipped: storage " + storageId + " is owned by another tile");
			return false;
		}
	}
	RSE_storageData().entries[String(storageId)] = {
		storage: capacity,
		items_stored: stored,
		stacks: stacks
	};
	tile.data.storageId = storageId;
	tile.data.rseStorageKind = RSE_STORAGE_KIND_SCOPE;
	tile.data.storage = null;
	tile.data.items_stored = null;
	tile.data.stacks = null;
	tile.data.rseStorageVersion = null;
	tile._rseStorageEntry = null;
	tile._rseStorageInvalid = false;
	RSE.logDev("storage block migrated extra payload to scope at " + coordsKey + " (storage " + storageId + ")");
	return true;
}

/* Savecore mode load: the scope entry stays authoritative. */
function RSE_storageInitScopeTile(tile, tier) {
	if (!tile) return;
	RSE_storageMigrateExtraToScope(tile, tier);
	RSE_storageSyncOwnership(tile);
}

function RSE_storageExtraPayloadForTile(tile, tier) {
	if (!tile || !tile.data) return null;
	var entry = tile._rseStorageEntry;
	if (!entry && !tile._rseStorageInvalid) {
		RSE_storageInitExtraTile(tile, tier);
		entry = tile._rseStorageEntry;
	}
	var storage = tier.capacity;
	var stacks = [];
	if (entry && !tile._rseStorageInvalid) {
		RSE_storageSyncRuntimeToPlain(tile, entry);
		storage = entry.storage;
		stacks = RSE_storagePlainStacks(entry.stacks);
	} else {
		storage = RSE_storageParseCapacity(tile.data.storage) || tier.capacity;
		stacks = RSE_storagePlainStacks(RSE_storageNormalizeStacks(tile.data.stacks));
	}
	return RSE_storageBuildPayload(storage, stacks);
}

function RSE_storageCacheExtraDropPayload(tile) {
	if (!tile || !tile.data || !RSE_storageIsExtraMode()) return;
	var entry = tile._rseStorageEntry;
	var storage = 0;
	var stacks = [];
	if (entry && !tile._rseStorageInvalid) {
		storage = RSE_storageParseCapacity(entry.storage);
		stacks = RSE_storagePlainStacks(entry.stacks);
	} else {
		storage = RSE_storageParseCapacity(tile.data.storage);
		stacks = RSE_storagePlainStacks(RSE_storageNormalizeStacks(tile.data.stacks));
	}
	if (!storage) return;
	var payload = RSE_storageBuildPayload(storage, stacks);
	if (!payload) return;
	var coordsKey = RSE_storageTileKey(tile);
	RSE_storageExtraDropPayloads[coordsKey] = payload;
	RSE.log("storage block extra drop cache: key=" + coordsKey +
		" entry=" + (entry ? "yes" : "no") +
		" stacks=" + stacks.length +
		" bytes=" + payload.length);
}

function RSE_storageTakeExtraDropPayload(tile, coordsKey, tier) {
	if (Object.prototype.hasOwnProperty.call(RSE_storageExtraDropPayloads, coordsKey)) {
		var payload = RSE_storageExtraDropPayloads[coordsKey];
		delete RSE_storageExtraDropPayloads[coordsKey];
		if (payload) {
			RSE.log("storage block extra drop payload: source=cache key=" + coordsKey +
				" bytes=" + payload.length);
			return payload;
		}
	}
	RSE.log("storage block extra drop payload: source=" + (tile ? "tile" : "none") +
		" key=" + coordsKey);
	return RSE_storageExtraPayloadForTile(tile, tier);
}

/* Extra mode placement: the item payload is authoritative; a scope entry is used only when there is no payload. */
function RSE_storagePlaceExtraTile(tier, coords, item, blockSource) {
	var payload = RSE_storageReadItemPayload(item);
	RSE.log("storage block extra place payload: state=" +
		(payload === null ? "invalid" : (payload ? "valid" : "absent")) +
		(payload ? " storage=" + payload.storage + " stacks=" + payload.stacks.length : ""));
	if (payload === null) {
		RSE.log("storage block place refused: invalid storage payload");
		RSE_storageCancelPlacement(item);
		return;
	}
	if (payload && payload.storage !== tier.capacity) {
		RSE.log("storage block place refused: payload/tier capacity mismatch");
		RSE_storageCancelPlacement(item);
		return;
	}
	if (payload && RSE_storageCountStored(payload.stacks) > tier.capacity) {
		RSE.log("storage block place refused: payload exceeds tier capacity");
		RSE_storageCancelPlacement(item);
		return;
	}
	var stacks = [];
	var scopeStorageId = 0;
	if (payload) {
		stacks = payload.stacks;
	} else {
		var requestedStorageId = RSE_storageItemStorageId(item);
		if (requestedStorageId) {
			var requestedEntry = RSE_storageEntryOfId(requestedStorageId);
			if (requestedEntry) {
				var requestedCapacity = RSE_storageParseCapacity(requestedEntry.storage);
				var requestedStacks = RSE_storageNormalizeStacks(requestedEntry.stacks);
				var requestedStored = RSE_storageCountStored(requestedStacks);
				if (requestedCapacity && requestedCapacity === tier.capacity && requestedStored <= requestedCapacity) {
					stacks = requestedStacks;
					scopeStorageId = requestedStorageId;
				} else {
					RSE.log("storage block place: scope entry " + requestedStorageId +
						" is invalid; placing an empty storage block");
				}
			} else {
				RSE.log("storage block place: scope entry " + requestedStorageId +
					" is missing; placing an empty storage block");
			}
		}
	}
	var previousBlock = null;
	try { previousBlock = blockSource.getBlock(coords.x, coords.y, coords.z); } catch (e) {}
	if (!previousBlock) previousBlock = { id: 0, data: 0 };
	blockSource.setBlock(coords.x, coords.y, coords.z, item.id, 0);
	var tile = null;
	try {
		tile = World.addTileEntity(coords.x, coords.y, coords.z, blockSource) ||
			World.getTileEntity(coords.x, coords.y, coords.z, blockSource);
	} catch (e2) { tile = null; }
	if (!tile) {
		try { blockSource.setBlock(coords.x, coords.y, coords.z, previousBlock.id, previousBlock.data || 0); } catch (e3) {}
		RSE.log("storage block place rolled back: tile entity was not created");
		RSE_storageCancelPlacement(item);
		return;
	}
	var entry = {
		storage: tier.capacity,
		items_stored: RSE_storageCountStored(stacks),
		stacks: stacks
	};
	if (!tile.data) tile.data = {};
	tile._rseStorageEntry = entry;
	tile._rseStorageInvalid = false;
	RSE_storageSyncRuntimeToPlain(tile, entry);
	tile.data.storageId = -1;
	RSE.log("storage block extra place data: stacks=" +
		(Array.isArray(tile.data.stacks) ? tile.data.stacks.length : "not-array") +
		" stored=" + tile.data.items_stored +
		" kind=" + tile.data.rseStorageKind);
	if (scopeStorageId) {
		delete RSE_storageData().entries[String(scopeStorageId)];
		RSE_storageUnregisterCoords(RSE_storageTileKey(tile));
	}
	RSE_storageRememberTile(tile);
	return coords;
}

function RSE_storageRefreshNow(netId) {
	if (!RSE_RS_API || netId === undefined || netId === null || netId == 'f') return;
	try {
		if (RSE_RS_API.networks && typeof RSE_RS_API.networks.refreshItems == 'function') {
			RSE_RS_API.networks.refreshItems(netId);
			return;
		}
		var networks = RSE_RS_API.getNetworks && RSE_RS_API.getNetworks();
		var info = networks && networks[netId] && networks[netId].info;
		if (info && typeof info.updateItems == 'function') info.updateItems();
	} catch (e) {
		RSE.log("network refresh failed: " + e);
	}
}

/* Coalesce refreshes: callers enqueue, the tick driver flushes once per network. */
function RSE_refreshItems(netId) {
	if (!RSE_RS_API || netId === undefined || netId === null || netId == 'f') return;
	RSE_storagePendingRefresh[String(netId)] = true;
}

/* Payload writes may skip the normal update event; mark the network tiles for the tick flush. */
function RSE_storageMarkNetworkDirty(netId) {
	if (!RSE_storageIsExtraMode()) return;
	var markAll = netId === undefined || netId === null || netId == 'f';
	for (var key in RSE_storageLoadedTiles) {
		if (!Object.prototype.hasOwnProperty.call(RSE_storageLoadedTiles, key)) continue;
		var tile = RSE_storageLoadedTiles[key];
		if (!tile || !tile.data) continue;
		if (!markAll && tile.data.NETWORK_ID != netId) continue;
		RSE_storageDirtyTiles[key] = true;
	}
}

/* Writes dirty runtime entries into the plain tile.data mirror; keys are cleared only after a successful sync. */
function RSE_storageFlushDirtyTiles() {
	var dirtyKeys = [];
	for (var key in RSE_storageDirtyTiles) {
		if (Object.prototype.hasOwnProperty.call(RSE_storageDirtyTiles, key)) dirtyKeys.push(key);
	}
	if (!dirtyKeys.length) return;
	for (var i = 0; i < dirtyKeys.length; i++) {
		var dirtyKey = dirtyKeys[i];
		try {
			var tile = RSE_storageLoadedTiles[dirtyKey];
			if (!tile || !tile.data) continue;
			var entry = tile._rseStorageEntry;
			if (!entry || tile._rseStorageInvalid) continue;
			if (RSE_storageSyncRuntimeToPlain(tile, entry)) delete RSE_storageDirtyTiles[dirtyKey];
		} catch (dirtyError) {
			RSE.log("storage block dirty flush failed at " + dirtyKey + ": " + dirtyError);
		}
	}
}

function RSE_storageFlushRefreshQueue() {
	RSE_storageFlushDirtyTiles();
	var pendingKeys = [];
	for (var key in RSE_storagePendingRefresh) {
		if (Object.prototype.hasOwnProperty.call(RSE_storagePendingRefresh, key)) pendingKeys.push(key);
	}
	if (!pendingKeys.length) return;
	RSE_storagePendingRefresh = {};
	for (var i = 0; i < pendingKeys.length; i++) {
		RSE_storageRefreshNow(Number(pendingKeys[i]));
	}
}

if (!RSE_storageRefreshScheduled) {
	RSE_storageRefreshScheduled = true;
	Callback.addCallback("tick", RSE_storageFlushRefreshQueue);
}

Callback.addCallback("LevelPreLeft", function () {
	if (!RSE_storageIsExtraMode()) return;
	for (var key in RSE_storageLoadedTiles) {
		if (!Object.prototype.hasOwnProperty.call(RSE_storageLoadedTiles, key)) continue;
		var tile = RSE_storageLoadedTiles[key];
		if (!tile || !tile.data) continue;
		var entry = tile._rseStorageEntry;
		if (!entry || tile._rseStorageInvalid) continue;
		RSE_storageSyncRuntimeToPlain(tile, entry);
	}
});

Callback.addCallback("ChunkDiscarded", function (dimensionId, chunkX, chunkZ) {
	for (var key in RSE_storageLoadedTiles) {
		if (!Object.prototype.hasOwnProperty.call(RSE_storageLoadedTiles, key)) continue;
		var tile = RSE_storageLoadedTiles[key];
		if (!tile) {
			delete RSE_storageLoadedTiles[key];
			delete RSE_storageDirtyTiles[key];
			continue;
		}
		var tileDimension = tile.dimension !== undefined && tile.dimension !== null
			? tile.dimension
			: RSE_storageSourceDimension(tile.blockSource ? tile.blockSource : tile);
		if (tileDimension != dimensionId) continue;
		if ((tile.x >> 4) != chunkX || (tile.z >> 4) != chunkZ) continue;
		var entry = tile._rseStorageEntry;
		if (tile.data && entry && !tile._rseStorageInvalid) RSE_storageSyncRuntimeToPlain(tile, entry);
		delete RSE_storageOpenTiles[key];
		delete RSE_storageLoadedTiles[key];
		delete RSE_storageDirtyTiles[key];
	}
});

Callback.addCallback("LevelLeft", function () {
	RSE_storageLoadedTiles = {};
	RSE_storageDirtyTiles = {};
	RSE_storageExtraDropPayloads = {};
});

function RSE_storagePreDestroy() {
	var coordsKey = RSE_storageTileKey(this);
	if (RSE_storageIsExtraMode()) {
		var entry = this._rseStorageEntry;
		if (entry && !this._rseStorageInvalid) RSE_storageSyncRuntimeToPlain(this, entry);
		RSE_storageCacheExtraDropPayload(this);
		RSE_storageUnregisterCoords(coordsKey);
		return;
	}
	var storageId = RSE_storageTileId(this);
	if (storageId) RSE_storageDrops[coordsKey] = storageId;
	RSE_storageUnregisterCoords(coordsKey);
}

function RSE_storagePostDestroy() {
	var coordsKey = RSE_storageTileKey(this);
	delete RSE_storageOpenTiles[coordsKey];
	delete RSE_storageLoadedTiles[coordsKey];
	delete RSE_storageDirtyTiles[coordsKey];
	this._rseStorageEntry = null;
	this._rseStorageInvalid = false;
	RSE_storageUnregisterCoords(coordsKey);
	var lastNetworkId = this.data && this.data.LAST_NETWORK_ID;
	if (lastNetworkId !== undefined && lastNetworkId !== null && lastNetworkId != 'f') {
		RSE_refreshItems(lastNetworkId);
	}
}

var RSE_STORAGE_TIERS = [
	{ name: "256k", capacity: 256000, energy: 10 },
	{ name: "1024k", capacity: 1024000, energy: 12 },
	{ name: "4096k", capacity: 4096000, energy: 14 },
	{ name: "16384k", capacity: 16384000, energy: 16 }
];

var RSE_storageScaleFactor = UI.getScreenHeight()*0.576/72;

/* Fresh descriptors per tier: no element object is shared between windows. */
function RSE_createStorageBlockElements() {
	var elements = {};
	elements["scale"] = {
		type: "scale",
		x: 350,
		y: 90,
		direction: 1,
		bitmap: "RSE_storage_scale_full",
		overlay: "RSE_storage_scale_empty",
		value: 0,
		scale: RSE_storageScaleFactor,
		overlayScale: RSE_storageScaleFactor,
		onTouchEvent: function (element, event) {
			if (event.type != 'CLICK') return;
			var description = element.description || element;
			var storedAmount = typeof description.storedAmount === 'number' ? description.storedAmount : 0;
			var storageAmount = typeof description.storageAmount === 'number' ? description.storageAmount : 0;
			alert(cutNumber(storedAmount) + '/' + cutNumber(storageAmount));
		}
	};
	elements["items"] = {
		type: "text",
		x: elements["scale"].x + elements["scale"].scale*18/2 - 20*3/2,
		y: elements["scale"].y - 10 - 20,
		text: "0/0",
		font: {
			color: android.graphics.Color.WHITE,
			shadow: 0.5,
			size: 20
		}
	};
	elements["percents"] = {
		type: "text",
		x: elements["scale"].x + elements["scale"].scale*18/2 - 17,
		y: elements["scale"].y + elements["scale"].scale*72 + 10,
		text: "0%",
		font: {
			color: android.graphics.Color.WHITE,
			shadow: 0.45,
			size: 17
		}
	};
	return elements;
}

function RSE_createStorageBlockGui(tier) {
	return new UI.StandartWindow({
		standart: {
			header: { text: { text: Translation.translate(tier.name + " Storage Block") } },
			inventory: { standart: true },
			background: { standart: true }
		},
		drawing: [],
		elements: RSE_createStorageBlockElements()
	});
}

var storageBlockGUIs = {};
for (var storageGuiTierIndex = 0; storageGuiTierIndex < RSE_STORAGE_TIERS.length; storageGuiTierIndex++) {
	var storageGuiTier = RSE_STORAGE_TIERS[storageGuiTierIndex];
	storageBlockGUIs[storageGuiTier.name] = RSE_createStorageBlockGui(storageGuiTier);
}

for (var storageTierIndex = 0; storageTierIndex < RSE_STORAGE_TIERS.length; storageTierIndex++) {
	(function (tier) {
		var blockName = "RSE_storage_" + tier.name;
		IDRegistry.genBlockID(blockName);
		Block.createBlock(blockName, [
			{ name: tier.name + " Storage Block", texture: [[tier.name + "_storage_block", 0]], inCreative: true }
		]);
		var blockId = BlockID[blockName];
		try { Item.setMaxStackSize(blockId, 1); } catch (e) {}
		try { Item.setFireResistant(blockId, true); } catch (e2) {}
		try { Item.setShouldDespawn(blockId, false); } catch (e3) {}

		var dropRegistered = Block.registerDropFunction(blockName, function (coords, blockID, blockData, diggingLevel, enchant, item, region) {
			var coordsKey = RSE_storageRegionKey(region, coords);
			var tile = null;
			try { tile = World.getTileEntity(coords.x, coords.y, coords.z, region); } catch (e) {}
			var extraMode = RSE_storageIsExtraMode();
			var storageId = 0;
			if (!extraMode) {
				if (tile) RSE_storageMigrateExtraToScope(tile, tier);
				storageId = tile ? RSE_storageTileId(tile) : 0;
				if (!storageId) storageId = RSE_storageMappedId(coordsKey);
			}
			delete RSE_storageDrops[coordsKey];
			RSE_storageUnregisterCoords(coordsKey);
			if (extraMode) {
				var payload = RSE_storageTakeExtraDropPayload(tile, coordsKey, tier);
				if (payload) {
					try {
						var payloadExtra = new ItemExtraData();
						payloadExtra.putString(RSE_STORAGE_PAYLOAD_KEY, payload);
						RSE.log("storage block extra drop item: bytes=" + payload.length);
						return [[blockID, 1, 0, payloadExtra]];
					} catch (payloadError) {
						RSE.log("storage block drop: failed to build storage payload: " + payloadError);
					}
				}
				return [[blockID, 1, 0]];
			}
			if (storageId) {
				try {
					var extra = new ItemExtraData();
					extra.putInt("rseStorageId", storageId);
					return [[blockID, 1, 0, extra]];
				} catch (e2) {
					RSE.log("storage block drop: failed to build ItemExtraData: " + e2);
				}
			}
			return [[blockID, 1, 0]];
		});
		if (dropRegistered === false) RSE.log("storage block drop registration failed: " + blockName);

		if (typeof Block.registerPopResourcesFunction === "function") {
			var popRegistered = Block.registerPopResourcesFunction(blockName, function (coords, block, region, explosionRadius, i) {
				var coordsKey = RSE_storageRegionKey(region, coords);
				if (Object.prototype.hasOwnProperty.call(RSE_storagePopHandled, coordsKey)) return;
				RSE_storagePopHandled[coordsKey] = true;
				var tile = null;
				try { tile = World.getTileEntity(coords.x, coords.y, coords.z, region); } catch (e) {}
				var extraMode = RSE_storageIsExtraMode();
				var storageId = 0;
				if (!extraMode) {
					if (tile) RSE_storageMigrateExtraToScope(tile, tier);
					storageId = tile ? RSE_storageTileId(tile) : 0;
					if (!storageId) storageId = RSE_storageMappedId(coordsKey);
				}
				delete RSE_storageDrops[coordsKey];
				RSE_storageUnregisterCoords(coordsKey);
				var droppedBlockId = block && block.id ? block.id : BlockID[blockName];
				if (!droppedBlockId) return;
				var extra = null;
				if (extraMode) {
					var payload = RSE_storageTakeExtraDropPayload(tile, coordsKey, tier);
					if (payload) {
						try {
							extra = new ItemExtraData();
							extra.putString(RSE_STORAGE_PAYLOAD_KEY, payload);
						} catch (payloadError) {
							extra = null;
							RSE.log("storage block pop resources: failed to build storage payload: " + payloadError);
						}
					}
				} else {
					if (storageId) {
						try {
							extra = new ItemExtraData();
							extra.putInt("rseStorageId", storageId);
						} catch (e2) {
							extra = null;
							RSE.log("storage block pop resources: failed to build ItemExtraData: " + e2);
						}
					}
				}
				try {
					region.spawnDroppedItem(coords.x, coords.y, coords.z, droppedBlockId, 1, 0, extra);
				} catch (e3) {
					RSE.log("storage block pop resources failed: " + e3);
				}
			});
			if (popRegistered === false) RSE.log("storage block pop resources registration failed: " + blockName);
		} else {
			RSE.log("storage block pop resources API unavailable: " + blockName);
		}

		Block.registerPlaceFunction(blockName, function (coords, item, block, player, blockSource) {
			if (!World.canTileBeReplaced(block.id, block.data)) {
				var relativeBlock = blockSource.getBlock(coords.relative.x, coords.relative.y, coords.relative.z);
				if (World.canTileBeReplaced(relativeBlock.id, relativeBlock.data)) {
					coords = coords.relative;
				} else return;
			}
			var coordsKey = RSE_storageRegionKey(blockSource, coords);
			delete RSE_storageDrops[coordsKey];
			delete RSE_storagePopHandled[coordsKey];
			delete RSE_storageExtraDropPayloads[coordsKey];

			if (RSE_storageIsExtraMode()) {
				return RSE_storagePlaceExtraTile(tier, coords, item, blockSource);
			}

			var payload = RSE_storageReadItemPayload(item);
			if (payload === null) {
				RSE.log("storage block place refused: invalid storage payload");
				RSE_storageCancelPlacement(item);
				return;
			}
			if (payload && payload.storage !== tier.capacity) {
				RSE.log("storage block place refused: payload/tier capacity mismatch");
				RSE_storageCancelPlacement(item);
				return;
			}
			var payloadStored = payload ? RSE_storageCountStored(payload.stacks) : 0;
			if (payload && payloadStored > tier.capacity) {
				RSE.log("storage block place refused: payload exceeds tier capacity");
				RSE_storageCancelPlacement(item);
				return;
			}

			var storageId = 0;
			var createdEntry = false;
			if (payload) {
				storageId = RSE_allocStorageId();
				if (!storageId) {
					RSE.log("storage block place refused: no free storage id");
					RSE_storageCancelPlacement(item);
					return;
				}
				RSE_storageData().entries[String(storageId)] = {
					storage: payload.storage,
					items_stored: payloadStored,
					stacks: payload.stacks
				};
				createdEntry = true;
			} else {
				var requestedStorageId = RSE_storageItemStorageId(item);
				var requestedEntry = requestedStorageId ? RSE_storageEntryOfId(requestedStorageId) : null;
				if (requestedStorageId && requestedEntry) {
					if (requestedEntry.storage !== tier.capacity) {
						RSE.log("storage block place refused: tier/capacity mismatch for storage " + requestedStorageId);
						RSE_storageCancelPlacement(item);
						return;
					}
					if (!RSE_storageCanOwn(requestedStorageId, coordsKey)) {
						RSE.log("storage block place refused: storage " + requestedStorageId + " is owned by another tile");
						RSE_storageCancelPlacement(item);
						return;
					}
					storageId = requestedStorageId;
				} else {
					storageId = RSE_allocStorageId();
					if (!storageId) {
						RSE.log("storage block place refused: no free storage id");
						RSE_storageCancelPlacement(item);
						return;
					}
					RSE_storageData().entries[String(storageId)] = {
						storage: tier.capacity,
						items_stored: 0,
						stacks: []
					};
					createdEntry = true;
				}
			}

			var previousBlock = null;
			try { previousBlock = blockSource.getBlock(coords.x, coords.y, coords.z); } catch (e) {}
			if (!previousBlock) previousBlock = { id: 0, data: 0 };
			blockSource.setBlock(coords.x, coords.y, coords.z, item.id, 0);

			var tile = null;
			try {
				tile = World.addTileEntity(coords.x, coords.y, coords.z, blockSource) ||
					World.getTileEntity(coords.x, coords.y, coords.z, blockSource);
			} catch (e2) { tile = null; }

			if (!tile) {
				try { blockSource.setBlock(coords.x, coords.y, coords.z, previousBlock.id, previousBlock.data || 0); } catch (e3) {}
				if (createdEntry) delete RSE_storageData().entries[String(storageId)];
				RSE.log("storage block place rolled back: tile entity was not created");
				RSE_storageCancelPlacement(item);
				return;
			}

			if (!RSE_storageRegisterOwner(storageId, tile)) {
				try { blockSource.setBlock(coords.x, coords.y, coords.z, previousBlock.id, previousBlock.data || 0); } catch (e4) {}
				try {
					if (typeof TileEntity !== "undefined" && TileEntity.destroyTileEntity) {
						TileEntity.destroyTileEntity(tile);
					}
				} catch (e5) {}
				if (createdEntry) delete RSE_storageData().entries[String(storageId)];
				RSE.log("storage block place rolled back: ownership registration failed");
				RSE_storageCancelPlacement(item);
				return;
			}

			if (!tile.data) tile.data = {};
			tile.data.storageId = storageId;
			tile.data.rseStorageKind = RSE_STORAGE_KIND_SCOPE;
			var placedScopeData = RSE_storageData();
			RSE.log("storage block place: id=" + storageId +
				" keys=" + Object.keys(placedScopeData.entries).join(",") +
				" next=" + placedScopeData.nextStorageId);
			return coords;
		});
	})(RSE_STORAGE_TIERS[storageTierIndex]);
}

var RSE_RS_API = null;

function RSE_storageNeutralizeProvider(api, blockId) {
	try {
		api.storage.registerProvider(blockId, {
			getEntries: function () { return []; }
		});
	} catch (e) {}
}

function RSE_storageBlockParams(tier) {
	return {
		useNetworkItemContainer: true,
		defaultValues: {
			NETWORK_ID: 'f',
			LAST_NETWORK_ID: 'f',
			storageId: -1
		},
		click: function (id, count, data, coords, player, extra) {
			if (Entity.getSneaking(player)) return false;
			var client = Network.getClientForPlayer(player);
			if (!client || this.container.getNetworkEntity().getClients().contains(client)) return true;
			this.container.openFor(client, "main");
			this.refreshGui(true, client);
			return true;
		},
		pre_destroy: RSE_storagePreDestroy,
		getScreenByName: function (screenName) {
			return storageBlockGUIs[tier.name];
		},
		refreshGui: function (first, client) {
			var entry = null;
			if (RSE_storageIsExtraMode()) {
				entry = RSE_storageExtraEntryFor(this, tier);
			} else {
				RSE_storageMigrateExtraToScope(this, tier);
				var storageId = RSE_storageParseId(this.data && this.data.storageId);
				entry = storageId ? RSE_storageEntryOfId(storageId) : null;
			}
			var data = {
				name: this.networkData && this.networkData.getName ? this.networkData.getName() + '' : '',
				isActive: this.data ? this.data.isActive : false,
				NETWORK_ID: this.data ? this.data.NETWORK_ID : 'f',
				stored: entry ? entry.items_stored || 0 : 0,
				storage: entry ? entry.storage || tier.capacity : tier.capacity
			};
			if (!this.container || typeof this.container.sendEvent !== 'function') return;
			RSE_storageOpenTiles[RSE_storageTileKey(this)] = this;
			if (client) this.container.sendEvent(client, "openGui", data);
			else this.container.sendEvent("openGui", data);
		},
		post_setActive: function (state) {
			RSE_refreshItems(this.data && this.data.NETWORK_ID);
		},
		post_update_network: function (net_id) {
			var lastNetworkId = this.data && this.data.LAST_NETWORK_ID;
			if (net_id !== undefined && net_id !== null && net_id != 'f') RSE_refreshItems(net_id);
			if (lastNetworkId !== undefined && lastNetworkId !== null && lastNetworkId != 'f' && lastNetworkId != net_id) {
				RSE_refreshItems(lastNetworkId);
			}
		},
		post_destroy: RSE_storagePostDestroy,
		post_init: function () {
			if (RSE_storageIsExtraMode()) {
				RSE_storageInitExtraTile(this, tier);
				return;
			}
			RSE_storageInitScopeTile(this, tier);
		},
		post_load: function () {
			RSE_storageSyncOwnership(this);
		},
		client: {
			containerEvents: {
				openGui: function (container, window, content, eventData) {
					if (!content || !window || !window.isOpened()) return;
					var guiData = eventData || {};
					var storedAmount = typeof guiData.stored === 'number' ? guiData.stored : 0;
					var storageAmount = typeof guiData.storage === 'number' ? guiData.storage : 0;
					var ratio = storageAmount > 0 ? Math.max(0, Math.min(1, storedAmount / storageAmount)) : 0;
					var scaleElement = content.elements["scale"];
					if (scaleElement) {
						scaleElement.value = ratio;
						scaleElement.storedAmount = storedAmount;
						scaleElement.storageAmount = storageAmount;
					}
					var itemsElement = content.elements["items"];
					if (itemsElement) {
						itemsElement.text = cutNumber(storedAmount) + '/' + cutNumber(storageAmount);
					}
					var percentsElement = content.elements["percents"];
					if (percentsElement) {
						percentsElement.text = Math.ceil(ratio * 100) + '%';
					}
					window.getWindow('main').forceRefresh();
				}
			}
		}
	};
}

Callback.addCallback("PostLoaded", function () {
	ModAPI.addAPICallback("RefinedStorageAPI", function (api) {
		if (!api || !RSE.apiAtLeast(api, 2, 0) || !api.blocks || !api.storage || !api.energy ||
			typeof api.blocks.create !== 'function' ||
			typeof api.storage.registerProvider !== 'function' ||
			typeof api.energy.set !== 'function') {
			RSE.log("storage blocks skipped: RefinedStorageAPI 2.0 with blocks/storage/energy required");
			return;
		}
		RSE_RS_API = api;
		if (typeof api.on === 'function') {
			api.on("storageUpdated", function (event) {
				var netId = event && event.netId;
				/* The mirror sync is deferred to the tick flush; only the GUI refresh stays immediate. */
				RSE_storageMarkNetworkDirty(netId);
				for (var key in RSE_storageOpenTiles) {
					var tile = RSE_storageOpenTiles[key];
					if (!tile || !tile.data) continue;
					if (netId !== undefined && netId !== null && tile.data.NETWORK_ID != netId) continue;
					try { tile.refreshGui(); } catch (e) {}
				}
			});
			/* Grid transfers with nonUpdate=true skip storageUpdated; mark their network here. */
			api.on("itemInserted", function (event) {
				RSE_storageMarkNetworkDirty(event && event.netId);
			});
			api.on("itemExtracted", function (event) {
				RSE_storageMarkNetworkDirty(event && event.netId);
			});
		}
		for (var tierIndex = 0; tierIndex < RSE_STORAGE_TIERS.length; tierIndex++) {
			(function (tier) {
				var blockId = BlockID["RSE_storage_" + tier.name];
				if (!blockId) {
					RSE.log("storage block skipped: missing block id for " + tier.name);
					return;
				}
				var energy = (Config.storageBlocks && Config.storageBlocks[tier.name]) || tier.energy;
				try {
					api.energy.set(blockId, energy);
				} catch (e) {
					RSE.log("storage block skipped: energy registration failed for " + tier.name + ": " + e);
					return;
				}

				var providerRegistered = false;
				try {
					providerRegistered = api.storage.registerProvider(blockId, RSE_storageProviderFor(tier)) === true;
				} catch (e2) {
					RSE.log("storage block provider registration failed for " + tier.name + ": " + e2);
				}
				if (!providerRegistered) {
					RSE.log("storage block skipped: provider registration failed for " + tier.name);
					return;
				}

				try {
					var createResult = api.blocks.create(blockId, RSE_storageBlockParams(tier));
					if (createResult === false) {
						RSE.log("storage block tile creation failed for " + tier.name);
						RSE_storageNeutralizeProvider(api, blockId);
					}
				} catch (e3) {
					RSE.log("storage block tile creation failed for " + tier.name + ": " + e3);
					RSE_storageNeutralizeProvider(api, blockId);
				}
			})(RSE_STORAGE_TIERS[tierIndex]);
		}
		RSE.logDev("storage blocks registered");
	});
});
