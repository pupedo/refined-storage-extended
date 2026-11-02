IDRegistry.genBlockID("RSE_detector");
IDRegistry.genBlockID("RSE_detector_on");

Block.createBlock("RSE_detector", [
	{ name: "Detector", texture: [["bottom", 0], ["top_off", 0], ["side_off", 0], ["side_off", 0], ["side_off", 0], ["side_off", 0]], inCreative: true }
], { name: "rse_detector", base: 1, material: 3, solid: true });

Block.createBlock("RSE_detector_on", [
	{ name: "Detector", texture: [["bottom", 0], ["top_on", 0], ["side_on", 0], ["side_on", 0], ["side_on", 0], ["side_on", 0]] }
], { name: "rse_detector_on", base: 1, material: 3, solid: true });

Block.setupAsRedstoneEmitter("RSE_detector_on", true);

Block.registerDropFunction("RSE_detector", function () {
	return [[BlockID.RSE_detector, 1, 0]];
});
Block.registerDropFunction("RSE_detector_on", function () {
	return [[BlockID.RSE_detector, 1, 0]];
});

function getDetectorModel(active) {
	var side = active ? "side_on" : "side_off";
	var top = active ? "top_on" : "top_off";
	var model = BlockRenderer.createModel();
	model.addBox(0, 0, 0, 1, 5 / 16, 1, [["bottom", 0], [top, 0], [side, 0], [side, 0], [side, 0], [side, 0]]);
	model.addBox(7 / 16, 5 / 16, 7 / 16, 9 / 16, 11 / 16, 9 / 16, [[side, 0], [top, 0], [side, 0], [side, 0], [side, 0], [side, 0]]);
	return model;
}

BlockRenderer.enableCoordMapping(BlockID.RSE_detector, -1, new ICRender.Model(getDetectorModel(false)));
BlockRenderer.enableCoordMapping(BlockID.RSE_detector_on, -1, new ICRender.Model(getDetectorModel(true)));

var detectorCollision = new ICRender.CollisionShape();
detectorCollision.addEntry().addBox(0, 0, 0, 1, 1, 1);
BlockRenderer.setCustomCollisionAndRaycastShape(BlockID.RSE_detector, -1, detectorCollision);
BlockRenderer.setCustomCollisionAndRaycastShape(BlockID.RSE_detector_on, -1, detectorCollision);

var DETECTOR_MODE_UNDER = 0;
var DETECTOR_MODE_EQUAL = 1;
var DETECTOR_MODE_ABOVE = 2;

var RSE_DETECTOR_MAX_AMOUNT = 2147483647;
var RSE_detectorGuiAmount = 0;

function RSE_detectorNowTicks() {
	if (typeof TickScheduler !== "undefined" && TickScheduler.global && typeof TickScheduler.global.ticks === "number") {
		return TickScheduler.global.ticks;
	}
	return World.getThreadTime();
}

function RSE_detectorHasClients(tile) {
	try {
		if (!tile || !tile.container || typeof tile.container.getNetworkEntity != 'function') return false;
		var clients = tile.container.getNetworkEntity().getClients();
		return !!(clients && clients.iterator().hasNext());
	} catch (e) {
		return false;
	}
}

function detectorIsPowered(count, mode, amount) {
	if (mode == DETECTOR_MODE_UNDER) return count < amount;
	if (mode == DETECTOR_MODE_EQUAL) return count == amount;
	if (mode == DETECTOR_MODE_ABOVE) return count > amount;
	return false;
}

function RSE_normalizeDetectorMode(mode) {
	var numericMode = Number(mode);
	if (!isFinite(numericMode)) return DETECTOR_MODE_UNDER;
	numericMode = Math.floor(numericMode);
	if (numericMode < DETECTOR_MODE_UNDER) return DETECTOR_MODE_UNDER;
	if (numericMode > DETECTOR_MODE_ABOVE) return DETECTOR_MODE_ABOVE;
	return numericMode;
}

function RSE_normalizeDetectorAmount(amount) {
	var numericAmount = Number(amount);
	if (!isFinite(numericAmount) || numericAmount < 0) return 0;
	numericAmount = Math.floor(numericAmount);
	if (numericAmount > RSE_DETECTOR_MAX_AMOUNT) return RSE_DETECTOR_MAX_AMOUNT;
	return numericAmount;
}

var RSE_detectorSwap = {};
var RSE_detectorSwapQueue = {};
var RSE_detectorSwapLock = {};
var RSE_detectorTouchQueue = [];

Callback.addCallback("LevelLeft", function () {
	RSE_detectorSwapQueue = {};
	RSE_detectorSwap = {};
	RSE_detectorSwapLock = {};
	RSE_detectorTouchQueue = [];
});

function detectorKey(tile) {
	return (tile.dimension !== undefined ? tile.dimension : 0) + ":" + cts(tile);
}

function RSE_detectorChunkLoaded(region, x, y, z) {
	if (region && typeof region.isChunkLoadedAt == 'function') {
		try {
			return !!region.isChunkLoadedAt(x, z);
		} catch (e) {
			RSE.log("[detector] chunk check error at " + x + "," + y + "," + z + ": " + e);
			return false;
		}
	}
	if (typeof isChunkLoadedAtSafe == 'function') {
		try {
			return !!isChunkLoadedAtSafe(region, x, y, z);
		} catch (e) {
			RSE.log("[detector] chunk check error at " + x + "," + y + "," + z + ": " + e);
			return false;
		}
	}
	if (typeof World != 'undefined' && World && typeof World.isChunkLoadedAt == 'function') {
		try {
			return !!World.isChunkLoadedAt(x, y, z);
		} catch (e) {
			RSE.log("[detector] chunk check error at " + x + "," + y + "," + z + ": " + e);
			return false;
		}
	}
	return true;
}

var RSE_REDSTONE_TOUCHABLE = {};
RSE_REDSTONE_TOUCHABLE[55] = 1;
RSE_REDSTONE_TOUCHABLE[75] = 1;
RSE_REDSTONE_TOUCHABLE[76] = 1;
RSE_REDSTONE_TOUCHABLE[93] = 1;
RSE_REDSTONE_TOUCHABLE[94] = 1;
RSE_REDSTONE_TOUCHABLE[149] = 1;
RSE_REDSTONE_TOUCHABLE[150] = 1;
RSE_REDSTONE_TOUCHABLE[123] = 1;
RSE_REDSTONE_TOUCHABLE[124] = 1;

function RSE_touchRedstoneNeighbors(region, x, y, z) {
	if (!RSE_detectorChunkLoaded(region, x, y, z)) return;
	var neighborOffsets = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
	for (var i = 0; i < neighborOffsets.length; i++) {
		var neighborX = x + neighborOffsets[i][0], neighborY = y + neighborOffsets[i][1], neighborZ = z + neighborOffsets[i][2];
		try {
			var neighborBlockId = region.getBlockId(neighborX, neighborY, neighborZ);
			if (RSE_REDSTONE_TOUCHABLE[neighborBlockId]) {
				var neighborBlockData = region.getBlockData(neighborX, neighborY, neighborZ);
				region.setDestroyParticlesEnabled(false);
				try {
					region.destroyBlock(neighborX, neighborY, neighborZ, false);
					try {
						region.setBlock(neighborX, neighborY, neighborZ, neighborBlockId, neighborBlockData);
					} catch (setBlockError) {
						RSE.log("[detector] touch setBlock error at " + neighborX + "," + neighborY + "," + neighborZ + ": " + setBlockError);
						try {
							region.setBlock(neighborX, neighborY, neighborZ, neighborBlockId, neighborBlockData);
						} catch (restoreError) {
							RSE.log("[detector] touch restore failed at " + neighborX + "," + neighborY + "," + neighborZ + ": " + restoreError);
						}
					}
				} finally {
					region.setDestroyParticlesEnabled(true);
				}
			}
		} catch (e) {
			RSE.log("[detector] touch error at " + neighborX + "," + neighborY + "," + neighborZ + ": " + e);
		}
	}
	try {
		region.addToTickingQueue(x, y, z, 1);
	} catch (e) {
		RSE.log("[detector] touch ticking queue error at " + x + "," + y + "," + z + ": " + e);
	}
}

function RSE_detectorBlockIdAt(entry, region) {
	try {
		if (!region || typeof region.getBlockId != 'function') return null;
		return region.getBlockId(entry.x, entry.y, entry.z);
	} catch (e) {
		RSE.log("[detector] swap rollback verify error at " + entry.x + "," + entry.y + "," + entry.z + ": " + e);
		return null;
	}
}

function RSE_detectorRestoreBlockToOldId(entry, region) {
	var blockWritten = false;
	try {
		region.setBlock(entry.x, entry.y, entry.z, entry.oldId, 0);
		blockWritten = true;
	} catch (e) {
		RSE.log("[detector] swap rollback failed at " + entry.x + "," + entry.y + "," + entry.z + ": " + e);
	}
	var currentBlockId = RSE_detectorBlockIdAt(entry, region);
	if (currentBlockId !== null) {
		if (currentBlockId == entry.oldId) return true;
	} else if (blockWritten) {
		return true;
	}
	try {
		region.setBlock(entry.x, entry.y, entry.z, entry.oldId, 0);
		blockWritten = true;
	} catch (retryError) {
		RSE.log("[detector] swap rollback retry failed at " + entry.x + "," + entry.y + "," + entry.z + ": " + retryError);
	}
	currentBlockId = RSE_detectorBlockIdAt(entry, region);
	if (currentBlockId !== null) return currentBlockId == entry.oldId;
	return blockWritten;
}

function RSE_detectorRollbackSwap(key, entry, region) {
	var blockRestoredToOldId = RSE_detectorRestoreBlockToOldId(entry, region);
	var restoredTile = null;
	if (blockRestoredToOldId) {
		try {
			restoredTile = World.addTileEntity(entry.x, entry.y, entry.z, region);
			if (!restoredTile) restoredTile = World.getTileEntity(entry.x, entry.y, entry.z, region);
		} catch (e) {
			RSE.log("[detector] swap rollback tile error at " + entry.x + "," + entry.y + "," + entry.z + ": " + e);
			try {
				restoredTile = World.getTileEntity(entry.x, entry.y, entry.z, region);
			} catch (getError) {
				RSE.log("[detector] swap rollback tile get error at " + entry.x + "," + entry.y + "," + entry.z + ": " + getError);
			}
		}
	}
	if (!restoredTile) RSE.log("[detector] swap rollback failed at " + entry.x + "," + entry.y + "," + entry.z + ": no tile");
	if (blockRestoredToOldId && restoredTile) {
		if (entry.saved) RSE.logDev("[detector] swap rollback restored old block; saved state kept for pre_init");
	} else {
		delete RSE_detectorSwap[key];
	}
	delete RSE_detectorSwapQueue[key];
	delete RSE_detectorSwapLock[key];
}

function RSE_executeDetectorSwap(key, entry) {
	var region = BlockSource.getDefaultForDimension(entry.dimension);
	if (!region) {
		RSE.log("[detector] swap dropped: no region at " + entry.x + "," + entry.y + "," + entry.z + " (dim " + entry.dimension + ")");
		delete RSE_detectorSwapQueue[key];
		delete RSE_detectorSwap[key];
		delete RSE_detectorSwapLock[key];
		return;
	}
	if (!RSE_detectorChunkLoaded(region, entry.x, entry.y, entry.z)) return;

	var currentBlockId = null;
	try {
		currentBlockId = region.getBlockId(entry.x, entry.y, entry.z);
	} catch (e) {
		RSE.log("[detector] swap error at " + entry.x + "," + entry.y + "," + entry.z + " (dim " + entry.dimension + "): " + e);
		delete RSE_detectorSwapQueue[key];
		delete RSE_detectorSwap[key];
		delete RSE_detectorSwapLock[key];
		return;
	}

	if (currentBlockId == entry.newId) {
		RSE_detectorSwap[key] = entry.saved;
		var presentTile = null;
		try {
			presentTile = World.getTileEntity(entry.x, entry.y, entry.z, region);
			if (!presentTile) presentTile = World.addTileEntity(entry.x, entry.y, entry.z, region);
		} catch (e) {
			RSE.log("[detector] swap tile check error at " + entry.x + "," + entry.y + "," + entry.z + ": " + e);
			try {
				presentTile = World.getTileEntity(entry.x, entry.y, entry.z, region);
			} catch (getError) {
				RSE.log("[detector] swap tile get error at " + entry.x + "," + entry.y + "," + entry.z + ": " + getError);
			}
		}
		if (!presentTile) {
			RSE.log("[detector] swap tile missing after block already changed at " + entry.x + "," + entry.y + "," + entry.z);
			RSE_detectorRollbackSwap(key, entry, region);
			return;
		}
		delete RSE_detectorSwapQueue[key];
		delete RSE_detectorSwap[key];
		delete RSE_detectorSwapLock[key];
		return;
	}

	if (currentBlockId != entry.oldId) {
		delete RSE_detectorSwapQueue[key];
		delete RSE_detectorSwap[key];
		delete RSE_detectorSwapLock[key];
		return;
	}

	RSE_detectorSwap[key] = entry.saved;
	RSE_detectorSwapLock[key] = true;
	var swapSucceeded = false;
	try {
		var oldTile = World.getTileEntity(entry.x, entry.y, entry.z, region);
		if (oldTile) TileEntity.destroyTileEntity(oldTile, false, false);
		region.setBlock(entry.x, entry.y, entry.z, entry.newId, 0);
		var newTile = World.addTileEntity(entry.x, entry.y, entry.z, region);
		if (!newTile) newTile = World.getTileEntity(entry.x, entry.y, entry.z, region);
		if (!newTile) throw new Error("no tile after setBlock");
		swapSucceeded = true;
	} catch (e) {
		RSE.log("[detector] swap error at " + entry.x + "," + entry.y + "," + entry.z + " (dim " + entry.dimension + "): " + e);
		RSE_detectorRollbackSwap(key, entry, region);
	} finally {
		delete RSE_detectorSwapLock[key];
	}
	if (!swapSucceeded) {
		delete RSE_detectorSwapQueue[key];
		return;
	}
	delete RSE_detectorSwapQueue[key];
	RSE.log("[detector] swap executed -> block " + entry.newId + " (dim " + entry.dimension + ")");
	RSE_detectorTouchQueue.push({ x: entry.x, y: entry.y, z: entry.z, dimension: entry.dimension });
}

Callback.addCallback("tick", function () {
	var touches = RSE_detectorTouchQueue;
	RSE_detectorTouchQueue = [];
	for (var touchIndex = 0; touchIndex < touches.length; touchIndex++) {
		var touchEntry = touches[touchIndex];
		try {
			var touchRegion = BlockSource.getDefaultForDimension(touchEntry.dimension);
			if (!touchRegion) continue;
			if (!RSE_detectorChunkLoaded(touchRegion, touchEntry.x, touchEntry.y, touchEntry.z)) {
				RSE_detectorTouchQueue.push(touchEntry);
				continue;
			}
			RSE_touchRedstoneNeighbors(touchRegion, touchEntry.x, touchEntry.y, touchEntry.z);
		} catch (e) {
			RSE.log("[detector] touch error at " + touchEntry.x + "," + touchEntry.y + "," + touchEntry.z + " (dim " + touchEntry.dimension + "): " + e);
		}
	}
	for (var key in RSE_detectorSwapQueue) {
		try {
			RSE_executeDetectorSwap(key, RSE_detectorSwapQueue[key]);
		} catch (e) {
			RSE.log("[detector] swap error at " + key + ": " + e);
			delete RSE_detectorSwapQueue[key];
			delete RSE_detectorSwapLock[key];
			delete RSE_detectorSwap[key];
		}
	}
});

var elementsGUI_detector = {};

function RSE_detectorContentElement(content, elementName) {
	var element = content.elements[elementName];
	if (!element) {
		element = {};
		content.elements[elementName] = element;
	}
	return element;
}

function RSE_detectorTextElement(content, elementName, x, y, text, fontSize, color, alignment, z) {
	var element = RSE_detectorContentElement(content, elementName);
	element.type = "text";
	element.x = x;
	element.y = y;
	element.text = text;
	element.font = element.font || {};
	element.font.size = fontSize;
	element.font.color = color;
	if (alignment !== undefined) element.font.alignment = alignment;
	if (z !== undefined) element.z = z;
	return element;
}

function RSE_detectorImageElement(content, elementName, x, y, bitmap, scale, z) {
	var element = RSE_detectorContentElement(content, elementName);
	element.type = "image";
	element.x = x;
	element.y = y;
	element.bitmap = bitmap;
	element.scale = scale;
	if (z !== undefined) element.z = z;
	return element;
}

function RSE_detectorButtonElement(content, elementName, x, y, onClickHandler) {
	var element = RSE_detectorContentElement(content, elementName);
	element.type = "button";
	element.x = x;
	element.y = y;
	element.width = 120;
	element.height = 64;
	element.scale = 1;
	element.bitmap = "frame[name=UIC_empty_button size=120,64]";
	element.bitmap2 = "frame[name=UIC_empty_button_pressed size=120,64]";
	element.clicker = {
		onClick: onClickHandler,
		onLongClick: function (itemContainerUiHandler, itemContainer, element) {}
	};
	return element;
}

function RSE_detectorAmountButtonElement(content, elementName, x, y, delta) {
	var element = RSE_detectorContentElement(content, elementName);
	element.type = "button";
	element.x = x;
	element.y = y;
	element.width = 80;
	element.height = 40;
	element.scale = 1;
	element.bitmap = "frame[name=UIC_empty_button size=80,40]";
	element.bitmap2 = "frame[name=UIC_empty_button_pressed size=80,40]";
	element.clicker = {
		onClick: function (itemContainerUiHandler, itemContainer, clickedElement) {
			itemContainer.sendEvent("adjustAmount", { delta: delta });
		},
		onLongClick: function (itemContainerUiHandler, itemContainer, element) {}
	};
	return element;
}

function RSE_openDetectorAmountDialog(itemContainerUiHandler, itemContainer) {
	UI.getContext().runOnUiThread(new java.lang.Runnable({
		run: function () {
			var editText = new android.widget.EditText(UI.getContext());
			editText.setText(String(RSE_detectorGuiAmount));
			editText.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
			new android.app.AlertDialog.Builder(UI.getContext())
				.setTitle(Translation.translate("Item amount"))
				.setView(editText)
				.setPositiveButton(Translation.translate("OK"), {
					onClick: function () {
						var dialogWindow = itemContainerUiHandler.getWindow();
						if (!dialogWindow || !dialogWindow.isOpened()) return;
						var amountValue = parseInt(editText.getText() + "", 10);
						if (!isFinite(amountValue)) return;
						if (amountValue < 0) amountValue = 0;
						if (amountValue > RSE_DETECTOR_MAX_AMOUNT) amountValue = RSE_DETECTOR_MAX_AMOUNT;
						itemContainer.sendEvent("setAmount", { amount: amountValue });
					}
				})
				.setNegativeButton(Translation.translate("Cancel"), null)
				.show();
		}
	}));
}

function layoutDetectorElements(content) {
	if (!content) return;
	var detectorElements = content.elements;
	if (!detectorElements) {
		detectorElements = content;
		content = { elements: detectorElements };
	}
	var baseY = Math.round((UI.getScreenHeight() - 80) / 2) - 88;
	RSE_detectorTextElement(content, "filter_label", 290, baseY, Translation.translate("Filter"), 16, android.graphics.Color.DKGRAY);
	var filterSlotElement = RSE_detectorContentElement(content, "slot_filter");
	filterSlotElement.type = "slot";
	filterSlotElement.num = 0;
	filterSlotElement.name = "slot_filter";
	filterSlotElement.x = 290;
	filterSlotElement.y = baseY + 22;
	filterSlotElement.size = 64;
	RSE_detectorTextElement(content, "count_text", 290, baseY + 106, Translation.translate("Count") + ": 0", 16, android.graphics.Color.DKGRAY);
	RSE_detectorTextElement(content, "mode_label", 400, baseY, Translation.translate("Mode"), 16, android.graphics.Color.DKGRAY);
	RSE_detectorButtonElement(content, "mode_button", 400, baseY + 22, function (itemContainerUiHandler, itemContainer, element) {
		itemContainer.sendEvent("cycleMode", {});
	});
	RSE_detectorTextElement(content, "mode_text", 460, baseY + 42, "", 20, android.graphics.Color.DKGRAY, 1, 100);
	RSE_detectorTextElement(content, "active_text", 840, baseY - 20, "", 16, android.graphics.Color.DKGRAY, 1);
	RSE_detectorTextElement(content, "powered_text", 460, baseY + 100, "", 16, android.graphics.Color.DKGRAY, 1);
	RSE_detectorImageElement(content, "powered_icon", 436, baseY + 126, "UIC_redstone_gui_2", 3, 100);
	RSE_detectorTextElement(content, "amount_label", 560, baseY, Translation.translate("Amount"), 16, android.graphics.Color.DKGRAY);
	var amountFrameElement = RSE_detectorContentElement(content, "amount_frame");
	amountFrameElement.type = "frame";
	amountFrameElement.x = 560;
	amountFrameElement.y = baseY + 22;
	amountFrameElement.width = 260;
	amountFrameElement.height = 70;
	amountFrameElement.z = 1;
	amountFrameElement.bitmap = "UIC_slider4";
	amountFrameElement.scale = 1;
	amountFrameElement.clicker = {
		onClick: function (itemContainerUiHandler, itemContainer, element) {
			RSE_openDetectorAmountDialog(itemContainerUiHandler, itemContainer);
		}
	};
	RSE_detectorTextElement(content, "amount_text", 690, baseY + 24, "", 40, android.graphics.Color.WHITE, 1, 100);
	var detectorAmountButtons = [
		{ buttonName: "amount_plus_1", textName: "amount_plus_1_text", x: 560, yOffset: 102, label: "+1", delta: 1 },
		{ buttonName: "amount_plus_10", textName: "amount_plus_10_text", x: 650, yOffset: 102, label: "+10", delta: 10 },
		{ buttonName: "amount_plus_64", textName: "amount_plus_64_text", x: 740, yOffset: 102, label: "+64", delta: 64 },
		{ buttonName: "amount_minus_1", textName: "amount_minus_1_text", x: 560, yOffset: 150, label: "-1", delta: -1 },
		{ buttonName: "amount_minus_10", textName: "amount_minus_10_text", x: 650, yOffset: 150, label: "-10", delta: -10 },
		{ buttonName: "amount_minus_64", textName: "amount_minus_64_text", x: 740, yOffset: 150, label: "-64", delta: -64 }
	];
	for (var amountButtonIndex = 0; amountButtonIndex < detectorAmountButtons.length; amountButtonIndex++) {
		var amountButtonConfig = detectorAmountButtons[amountButtonIndex];
		RSE_detectorAmountButtonElement(content, amountButtonConfig.buttonName, amountButtonConfig.x, baseY + amountButtonConfig.yOffset, amountButtonConfig.delta);
		RSE_detectorTextElement(content, amountButtonConfig.textName, amountButtonConfig.x + 40, baseY + amountButtonConfig.yOffset - 3, amountButtonConfig.label, 24, android.graphics.Color.WHITE, 1, 100);
	}
}

layoutDetectorElements({ elements: elementsGUI_detector });

var detectorGUI = new UI.StandartWindow({
	standart: {
		header: { text: { text: Translation.translate("Detector") } },
		inventory: { padding: 20, width: 300 / 4 * 3 },
		background: { standart: true }
	},
	drawing: [],
	elements: elementsGUI_detector
});

function RSE_evaluateDetector(tile, api) {
	tile.data.mode = RSE_normalizeDetectorMode(tile.data.mode);
	tile.data.amount = RSE_normalizeDetectorAmount(tile.data.amount);
	var detectorRefreshMode = (Config.detector && Config.detector.refreshMode) || 'poll';
	var isOnBlock = tile.blockSource.getBlockId(tile.x, tile.y, tile.z) == BlockID.RSE_detector_on;
	var detectorHasClients = RSE_detectorHasClients(tile);
	var powered = false;
	var count = 0;
	var items = null;
	if (tile.isWorkAllowed()) {
		try {
			if (detectorRefreshMode !== 'event') {
				RSE_refreshNetItems(api, tile.data.NETWORK_ID, RSE_detectorNowTicks());
			}
		} catch (e) {
			RSE.log("[detector] refresh error: " + e);
		}
		var filter = tile.container.getSlot('slot_filter');
		items = api.networks.getItems(tile.data.NETWORK_ID) || [];
		if (detectorRefreshMode === 'event' && items.length === 0 && api.networks.getStored && api.networks.getStored(tile.data.NETWORK_ID) > 0) {
			try {
				RSE_refreshNetItems(api, tile.data.NETWORK_ID, RSE_detectorNowTicks());
			} catch (e) {
				RSE.log("[detector] refresh error: " + e);
			}
			items = api.networks.getItems(tile.data.NETWORK_ID) || [];
		}
		if (!filter || filter.id == 0) {
			for (var i = 0; i < items.length; i++) {
				if (items[i]) count += items[i].count || 0;
			}
		} else {
			for (var i = 0; i < items.length; i++) {
				var entry = items[i];
				if (entry && entry.id == filter.id && (entry.data || 0) == (filter.data || 0)) count += entry.count || 0;
			}
		}
		powered = detectorIsPowered(count, tile.data.mode, tile.data.amount || 0);
		tile.data.noWorkTicks = 0;
	} else {
		tile.data.noWorkTicks = (tile.data.noWorkTicks || 0) + 5;
		if (isOnBlock && tile.data.swapGraceUntil && RSE_detectorNowTicks() < tile.data.swapGraceUntil) powered = true;
	}
	var poweredChanged = powered != tile.data.powered;
	if (poweredChanged) {
		tile.data.powered = powered;
		tile.networkData.putBoolean('powered', powered);
		RSE.logDev("[detector] powered changed -> " + powered);
	}
	if (powered != isOnBlock) {
		var key = detectorKey(tile);
		if (!RSE_detectorSwapQueue[key]) {
			var filterSlot = tile.container.getSlot('slot_filter');
			RSE_detectorSwapQueue[key] = {
				x: tile.x,
				y: tile.y,
				z: tile.z,
				dimension: tile.dimension,
				oldId: isOnBlock ? BlockID.RSE_detector_on : BlockID.RSE_detector,
				newId: powered ? BlockID.RSE_detector_on : BlockID.RSE_detector,
				saved: {
					mode: tile.data.mode,
					amount: tile.data.amount || 0,
					filter: { id: filterSlot.id, count: filterSlot.count, data: filterSlot.data, extra: filterSlot.extra }
				}
			};
			RSE.log("[detector] swap queued " + (isOnBlock ? "ON->OFF" : "OFF->ON") + " (filter=" + filterSlot.id + ")");
		}
	}
	var detectorLogDue = ((tile.data.logTick || 0) + 5) % 200 == 0;
	var detectorStoredValue = null;
	var detectorStoredAvailable = !!(api.networks && typeof api.networks.getStored == 'function');
	if (detectorHasClients || detectorLogDue) {
		detectorStoredValue = detectorStoredAvailable ? (api.networks.getStored(tile.data.NETWORK_ID) || 0) : -1;
	}
	tile.data.detectorCount = count;
	tile.data.detectorStored = detectorHasClients && detectorStoredAvailable ? (detectorStoredValue || 0) : 0;
	if (detectorHasClients) {
		var detectorNow = RSE_detectorNowTicks();
		if (poweredChanged && detectorNow >= (tile.data.detectorGuiRefreshAt || 0)) {
			tile.data.detectorGuiRefreshAt = detectorNow + 10;
			if (typeof tile.refreshGui == 'function') tile.refreshGui();
		} else if (detectorNow >= (tile.data.detectorGuiRefreshAt || 0)) {
			tile.data.detectorGuiRefreshAt = detectorNow + 20;
			if (typeof tile.refreshGui == 'function') tile.refreshGui();
		}
	}
	tile.data.logTick = (tile.data.logTick || 0) + 5;
	if (tile.data.logTick % 200 == 0) {
		var logFilter = tile.container.getSlot('slot_filter');
		var loggedStored = detectorStoredValue !== null ? (detectorHasClients && detectorStoredAvailable ? tile.data.detectorStored : detectorStoredValue) : -1;
		RSE.logDev("[detector] powered=" + powered + " count=" + count + " mode=" + tile.data.mode + " amount=" + (tile.data.amount || 0) + " noWorkTicks=" + (tile.data.noWorkTicks || 0) + " active=" + !!tile.data.isActive + " net=" + tile.data.NETWORK_ID + " onBlock=" + isOnBlock + " filter=" + (logFilter ? logFilter.id : 0) + " stored=" + loggedStored + " itemsLen=" + (items ? items.length : -1));
	}
}

function buildDetectorParams(api) {
	return {
		useNetworkItemContainer: true,
		defaultValues: {
			NETWORK_ID: 'f',
			LAST_NETWORK_ID: 'f',
			redstone_mode: 0,
			redstone_power: false,
			mode: DETECTOR_MODE_UNDER,
			amount: 0,
			powered: false,
			noWorkTicks: 0,
			swapGraceUntil: 0,
			detectorCount: 0,
			detectorStored: 0,
			detectorGuiRefreshAt: 0,
			detectorEventDirty: false
		},
		click: function (id, count, data, coords, player, extra) {
			if (Entity.getSneaking(player)) return false;
			var client = Network.getClientForPlayer(player);
			if (!client || this.container.getNetworkEntity().getClients().contains(client)) return true;
			this.container.openFor(client, "main");
			this.refreshGui(true, client);
			return true;
		},
		getScreenByName: function (screenName) {
			return detectorGUI;
		},
		pre_init: function () {
			var key = detectorKey(this);
			var saved = RSE_detectorSwap[key];
			var restoreSucceeded = !saved;
			if (saved) {
				var restoredMode = saved.mode != undefined ? RSE_normalizeDetectorMode(saved.mode) : RSE_normalizeDetectorMode(this.data.mode);
				var restoredAmount = saved.amount != undefined ? RSE_normalizeDetectorAmount(saved.amount) : RSE_normalizeDetectorAmount(this.data.amount);
				try {
					if (saved.filter && saved.filter.id) {
						this.container.setSlot('slot_filter', saved.filter.id, 1, saved.filter.data, saved.filter.extra);
					}
					this.data.mode = restoredMode;
					this.data.amount = restoredAmount;
					if (saved.filter && saved.filter.id) {
						this.data.filterId = saved.filter.id;
						this.data.filterData = saved.filter.data;
						if (saved.filter.extra !== undefined) this.data.filterExtra = saved.filter.extra;
						else delete this.data.filterExtra;
					}
					restoreSucceeded = true;
					delete RSE_detectorSwap[key];
					this.data.swapGraceUntil = RSE_detectorNowTicks() + 40;
					RSE.logDev("[detector] state restored after swap (mode=" + this.data.mode + " amount=" + this.data.amount + ")");
				} catch (e) {
					RSE.log("[detector] state restore error: " + e);
				}
			} else {
				var isOnDetectorBlock = false;
				try {
					if (this.blockSource && typeof this.blockSource.getBlockId == 'function') {
						isOnDetectorBlock = this.blockSource.getBlockId(this.x, this.y, this.z) == BlockID.RSE_detector_on;
					}
				} catch (e) {
					RSE.log("[detector] pre_init block check error: " + e);
				}
				this.data.swapGraceUntil = isOnDetectorBlock ? RSE_detectorNowTicks() + 40 : 0;
			}
			this.data.mode = RSE_normalizeDetectorMode(this.data.mode);
			this.data.amount = RSE_normalizeDetectorAmount(this.data.amount);
			this.data.detectorGuiRefreshAt = 0;
			var tile = this;
			if (typeof api.on === 'function' && !this.detectorEventUnsubscribers) {
				var markDetectorEventDirty = function (event) {
					if (event && event.netId === tile.data.NETWORK_ID) {
						tile.data.detectorEventDirty = true;
						tile.data.checkTick = 0;
					}
				};
				this.detectorEventUnsubscribers = [
					api.on("storageUpdated", markDetectorEventDirty),
					api.on("itemInserted", markDetectorEventDirty),
					api.on("itemExtracted", markDetectorEventDirty)
				];
			}
			try {
				this.container.setSlotAddTransferPolicy('slot_filter', {
					transfer: function (itemContainer, slot, id, count, data, extra, player) {
						itemContainer.setSlot(slot, id, 1, data, extra);
						tile.data.filterId = id;
						tile.data.filterData = data;
						tile.data.filterExtra = extra;
						return 0;
					}
				});
				this.container.setSlotGetTransferPolicy('slot_filter', {
					transfer: function (itemContainer, slot, id, count, data, extra, player) {
						itemContainer.clearSlot(slot);
						delete tile.data.filterId;
						delete tile.data.filterData;
						delete tile.data.filterExtra;
						return 0;
					}
				});
			} catch (e) {
				RSE.log("[detector] filter policy install error: " + e);
			}
			try {
				if ((!saved || restoreSucceeded) && this.container.getSlot('slot_filter').id == 0 && this.data.filterId) {
					this.container.setSlot('slot_filter', this.data.filterId, 1, this.data.filterData || 0, this.data.filterExtra != undefined ? this.data.filterExtra : null);
					RSE.logDev("[detector] filter self-healed from data (id=" + this.data.filterId + ")");
				}
			} catch (e) {
				RSE.log("[detector] filter self-heal error: " + e);
			}
		},
		pre_destroy: function () {
			var detectorEventUnsubscribers = this.detectorEventUnsubscribers;
			if (detectorEventUnsubscribers) {
				for (var detectorUnsubscribeIndex = 0; detectorUnsubscribeIndex < detectorEventUnsubscribers.length; detectorUnsubscribeIndex++) {
					if (typeof detectorEventUnsubscribers[detectorUnsubscribeIndex] === 'function') {
						try {
							detectorEventUnsubscribers[detectorUnsubscribeIndex]();
						} catch (e) {
							RSE.log("[detector] event unsubscribe error: " + e);
						}
					}
				}
				this.detectorEventUnsubscribers = null;
			}
			var key = detectorKey(this);
			try {
				var filterSlot = this.container.getSlot('slot_filter');
				if (filterSlot && filterSlot.id) {
					this.data.filterId = filterSlot.id;
					this.data.filterData = filterSlot.data;
					this.data.filterExtra = filterSlot.extra;
				} else {
					delete this.data.filterId;
					delete this.data.filterData;
					delete this.data.filterExtra;
				}
			} catch (e) {
				RSE.log("[detector] filter mirror save error: " + e);
			}
			try {
				this.container.clearSlot('slot_filter');
			} catch (e) {
				RSE.log("[detector] filter slot clear error: " + e);
			} finally {
				delete RSE_detectorSwapQueue[key];
				if (!RSE_detectorSwapLock[key]) delete RSE_detectorSwap[key];
				var remainingTouches = [];
				var detectorDimension = this.dimension !== undefined ? this.dimension : 0;
				for (var i = 0; i < RSE_detectorTouchQueue.length; i++) {
					var touchEntry = RSE_detectorTouchQueue[i];
					var touchDimension = touchEntry.dimension !== undefined ? touchEntry.dimension : 0;
					if (!(touchEntry.x == this.x && touchEntry.y == this.y && touchEntry.z == this.z && touchDimension == detectorDimension)) {
						remainingTouches.push(touchEntry);
					}
				}
				RSE_detectorTouchQueue = remainingTouches;
			}
		},
		tick: function () {
			if (this.data.detectorEventDirty) {
				this.data.detectorEventDirty = false;
				this.data.checkTick = 4;
			}
			this.data.checkTick = ((this.data.checkTick || 0) + 1) % 5;
			if (this.data.checkTick != 0) return;
			try {
				RSE_evaluateDetector(this, api);
			} catch (e) {
				RSE.log("[detector] tick error: " + e);
			}
		},
		refreshGui: function (first, client) {
			var _data = {
				name: this.networkData.getName() + '',
				mode: RSE_normalizeDetectorMode(this.data.mode),
				amount: RSE_normalizeDetectorAmount(this.data.amount),
				powered: !!this.data.powered,
				isActive: !!this.data.isActive,
				NETWORK_ID: this.data.NETWORK_ID,
				count: this.data.detectorCount || 0
			};
			if (client) this.container.sendEvent(client, "openGui", _data);
			else this.container.sendEvent("openGui", _data);
		},
		// Core calls refreshModel from setActive; adding post_setActive would duplicate the packet.
		refreshModel: function () {
			if (!this.networkEntity) return;
			this.sendPacket("refreshModel", {
				isActive: !!this.data.isActive,
				coords: { x: this.x, y: this.y, z: this.z }
			});
		},
		containerEvents: {
			cycleMode: function (eventData, connectedClient) {
				this.data.mode = RSE_normalizeDetectorMode(this.data.mode);
				this.data.mode = this.data.mode >= DETECTOR_MODE_ABOVE ? DETECTOR_MODE_UNDER : this.data.mode + 1;
				RSE.logDev("[detector] cycleMode -> " + this.data.mode);
				this.refreshGui();
			},
			setAmount: function (eventData, connectedClient) {
				if (!eventData) return;
				var amount = parseInt(eventData.amount, 10);
				if (!isFinite(amount)) return;
				if (amount < 0) amount = 0;
				if (amount > RSE_DETECTOR_MAX_AMOUNT) amount = RSE_DETECTOR_MAX_AMOUNT;
				this.data.amount = amount;
				RSE.logDev("[detector] setAmount -> " + amount);
				this.refreshGui();
			},
			adjustAmount: function (eventData) {
				var delta = parseInt(eventData && eventData.delta, 10);
				if (!isFinite(delta)) return;
				var amount = (parseInt(this.data.amount, 10) || 0) + delta;
				if (amount < 0) amount = 0;
				if (amount > RSE_DETECTOR_MAX_AMOUNT) amount = RSE_DETECTOR_MAX_AMOUNT;
				this.data.amount = amount;
				this.refreshGui();
			}
		},
		client: {
			refreshModel: function () {
				var render = new ICRender.Model(getDetectorModel(this.networkData.getBoolean('isActive')));
				BlockRenderer.mapAtCoords(this.x, this.y, this.z, render);
			},
			events: {
				refreshModel: function (eventData) {
					var render = new ICRender.Model(getDetectorModel(!!eventData.isActive));
					BlockRenderer.mapAtCoords(eventData.coords.x, eventData.coords.y, eventData.coords.z, render);
				}
			},
			containerEvents: {
				openGui: function (container, window, content, eventData) {
					if (!content || !window || !window.isOpened()) return;
					if (!eventData) return;
					layoutDetectorElements(content);
					var detectorModes = ["Under", "Equal", "Above"];
					var detectorMode = RSE_normalizeDetectorMode(eventData.mode);
					var detectorAmount = RSE_normalizeDetectorAmount(eventData.amount);
					var detectorCount = RSE_normalizeDetectorAmount(eventData.count);
					var detectorPowered = !!eventData.powered;
					var detectorIsActive = !!eventData.isActive;
					var modeTextElement = content.elements["mode_text"];
					if (modeTextElement) {
						modeTextElement.text = Translation.translate(detectorModes[detectorMode]);
					}
					var amountTextElement = content.elements["amount_text"];
					if (amountTextElement) {
						amountTextElement.text = String(detectorAmount);
					}
					var countTextElement = content.elements["count_text"];
					if (countTextElement) {
						countTextElement.text = Translation.translate("Count") + ": " + detectorCount;
					}
					var activeTextElement = content.elements["active_text"];
					if (activeTextElement) {
						activeTextElement.text = Translation.translate(detectorIsActive ? "Active" : "Offline");
						activeTextElement.font.color = detectorIsActive ? android.graphics.Color.DKGRAY : android.graphics.Color.RED;
					}
					var poweredTextElement = content.elements["powered_text"];
					if (poweredTextElement) {
						poweredTextElement.text = Translation.translate(detectorPowered ? "Powered" : "Idle");
						poweredTextElement.font.color = detectorPowered ? android.graphics.Color.DKGRAY : android.graphics.Color.GRAY;
					}
					var poweredIconElement = content.elements["powered_icon"];
					if (poweredIconElement) {
						poweredIconElement.bitmap = detectorPowered ? "UIC_redstone_gui_1" : "UIC_redstone_gui_2";
					}
					RSE_detectorGuiAmount = detectorAmount;
					window.getWindow('main').forceRefresh();
				}
			}
		}
	};
}

Callback.addCallback("PostLoaded", function () {
	ModAPI.addAPICallback("RefinedStorageAPI", function (api) {
		if (!api || !api.blocks || !api.networks) {
			RSE.log("detector skipped: RefinedStorageAPI unavailable");
			return;
		}
		if (!RSE.apiAtLeast(api, 2, 0)) {
			RSE.log("detector skipped: RefinedStorageAPI 2.0 required");
			return;
		}
		if (!api.energy || typeof api.energy.set !== 'function') {
			RSE.log("detector skipped: RefinedStorageAPI energy API unavailable");
			return;
		}
		api.energy.set(BlockID.RSE_detector, 2);
		api.energy.set(BlockID.RSE_detector_on, 2);
		api.blocks.create(BlockID.RSE_detector, buildDetectorParams(api));
		api.blocks.create(BlockID.RSE_detector_on, buildDetectorParams(api));
		RSE.logDev("detector tile registered");
	});
});
