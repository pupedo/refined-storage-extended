var RSE_CRAFTERS_PER_PAGE = 36;
var RSE_CRAFTER_COLUMNS = 12;
var RSE_CRAFTER_ROWS = 3;
var RSE_CRAFTER_PATTERN_SIZE = 48;
var RSE_CRAFTER_OUTPUT_SIZE = 40;
var RSE_CRAFTER_OUTPUT_GAP = 4;
var RSE_CRAFTER_ROW_HEIGHT = 92;
var RSE_CRAFTER_GRID_X = 350;

var RSE_CRAFTER_OFF = [
	["RSE_crafter_bot", 0], ["RSE_crafter_top", 0], ["RSE_crafter_bottom", 0],
	["RSE_crafter_front", 0], ["RSE_crafter_side_left", 0], ["RSE_crafter_side", 0]
];

var RSE_CRAFTER_TIERS = [
	{ name: "iron", display: "Iron Autocrafter", speed: 1, slots: 27, energy: 4, perPattern: 1 },
	{ name: "gold", display: "Gold Autocrafter", speed: 5, slots: 45, energy: 4, perPattern: 1 },
	{ name: "diamond", display: "Diamond Autocrafter", speed: 25, slots: 63, energy: 4, perPattern: 1 },
	{ name: "netherite", display: "Netherite Autocrafter", speed: 125, slots: 81, energy: 4, perPattern: 1 }
];

for (var ti = 0; ti < RSE_CRAFTER_TIERS.length; ti++) {
	var tpref = "RSE_crafter_" + RSE_CRAFTER_TIERS[ti].name + "_";
	RSE_CRAFTER_TIERS[ti].on = [
		[tpref + "bot_on", 0], [tpref + "top_on", 0], ["RSE_crafter_bottom", 0],
		[tpref + "front_on", 0], [tpref + "side_left_on", 0], [tpref + "side_on", 0]
	];
}

function getAdvancedCrafterTexture(variation, _active, onArr) {
	var base = _active ? onArr : RSE_CRAFTER_OFF;
	variation = variation || 0;
	if (variation == 4) {
		return [base[3], base[2], [base[1][0], 4], [base[0][0], 4], [base[4][0], 4], [base[5][0], 4]];
	}
	if (variation == 5) {
		return [base[2], base[3], [base[0][0], 5], [base[1][0], 5], [base[4][0], 5], [base[5][0], 5]];
	}
	return [[base[0], [base[1][0], variation], base[2], base[3], base[4], base[5]], [base[0], [base[1][0], variation], base[3], base[2], base[5], base[4]], [base[0], [base[1][0], variation], base[5], base[4], base[2], base[3]], [base[0], [base[1][0], variation], base[4], base[5], base[3], base[2]]][variation];
}

function enableAdvancedCrafterCoordMappings(blockName, tier) {
	for (var mappingVariation = 0; mappingVariation < 6; mappingVariation++) {
		var coordRender = new ICRender.Model();
		var coordModel = BlockRenderer.createTexturedBlock(getAdvancedCrafterTexture(mappingVariation, false, tier.on));
		coordRender.addEntry(coordModel);
		BlockRenderer.enableCoordMapping(BlockID[blockName], mappingVariation, coordRender);
	}
}

for (var bti = 0; bti < RSE_CRAFTER_TIERS.length; bti++) {
	var bname = "RSE_crafter_" + RSE_CRAFTER_TIERS[bti].name;
	IDRegistry.genBlockID(bname);
	var btier = RSE_CRAFTER_TIERS[bti];
	var bvariations = [];
	for (var cvi = 0; cvi < 6; cvi++) {
		bvariations.push({
			name: btier.display,
			texture: getAdvancedCrafterTexture(cvi, false, btier.on),
			inCreative: cvi == 0
		});
	}
	Block.createBlock(bname, bvariations);
	enableAdvancedCrafterCoordMappings(bname, btier);
	Block.setupAsRedstoneReceiver(bname, true);
	Block.registerPlaceFunction(bname, function (coords, item, block, player, blockSource) {
		if (!World.canTileBeReplaced(block.id, block.data)) {
			var relBlock = blockSource.getBlock(coords.relative.x, coords.relative.y, coords.relative.z);
			if (World.canTileBeReplaced(relBlock.id, relBlock.data)) {
				coords = coords.relative;
			} else return;
		}
		var ppos = Entity.getPosition(player);
		var dx = ppos.x - (coords.x + 0.5);
		var dy = ppos.y - (coords.y + 0.5);
		var dz = ppos.z - (coords.z + 0.5);
		var ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz);
		var meta;
		if (ay >= ax && ay >= az) meta = dy > 0 ? 5 : 4;
		else if (ax >= az) meta = dx > 0 ? 2 : 3;
		else meta = dz > 0 ? 0 : 1;
		blockSource.setBlock(coords.x, coords.y, coords.z, item.id, meta);
		return coords;
	});
}

function isValidCraftsMap(crafts) {
	return !!crafts && typeof crafts == 'object' && !Array.isArray(crafts);
}

function allocateCraftId(tile) {
	var nextCraftId = tile.data.nextCraftId;
	if (typeof nextCraftId != 'number' || !isFinite(nextCraftId) || Math.floor(nextCraftId) != nextCraftId || nextCraftId < 0) nextCraftId = 0;
	nextCraftId++;
	tile.data.nextCraftId = nextCraftId;
	return 'pattern_' + nextCraftId;
}

function updateAdvancedCrafterOutputSlots(container, content, page) {
	if (!container) return;
	if (!content) {
		var uiAdapter = container.getUiAdapter && container.getUiAdapter();
		var windowGroup = uiAdapter ? uiAdapter.getWindow() : null;
		if (!windowGroup) return;
		var mainWindow = windowGroup.getWindow('main');
		if (!mainWindow || !mainWindow.isOpened()) return;
		content = mainWindow.getContent();
	}
	if (!content || !content.elements) return;
	for (var i = 0; i < RSE_CRAFTERS_PER_PAGE; i++) {
		var outputElement = content.elements["output_pattern" + i];
		if (!outputElement) continue;
		var patternElement = content.elements["slot_pattern" + i];
		if ((patternElement && (patternElement.x < 0 || patternElement.y < 0)) || outputElement.x < 0 || outputElement.y < 0) {
			outputElement.source = null;
			continue;
		}
		var patternItem = container.slots ? container.slots["slot_pattern" + i] : null;
		if (patternItem && patternItem.id == ItemID.RSpattern && patternItem.extra) {
			var resultString = patternItem.extra.getString('result0');
			if (resultString) {
				var resultParts = resultString.split(',');
				if (resultParts.length >= 3) {
					var resultId = parseInt(resultParts[0]);
					if (resultId != 0 && !isNaN(resultId)) {
						outputElement.source = { id: resultId, count: parseInt(resultParts[1] || 1), data: parseInt(resultParts[2] || 0) };
						continue;
					}
				}
			}
		}
		outputElement.source = null;
	}
}

function getAdvancedCrafterElement(content, elementName) {
	var element = content.elements[elementName];
	if (!element) {
		element = {};
		content.elements[elementName] = element;
	}
	return element;
}

function getAdvancedCrafterVisibleCount(page, slotsCount) {
	var pageIndex = Math.floor(Number(page));
	if (!isFinite(pageIndex) || pageIndex < 0) pageIndex = 0;
	var totalSlots = Math.floor(Number(slotsCount));
	if (!isFinite(totalSlots) || totalSlots < 0) totalSlots = 0;
	return Math.min(RSE_CRAFTERS_PER_PAGE, Math.max(0, totalSlots - pageIndex * RSE_CRAFTERS_PER_PAGE));
}

function clampAdvancedCrafterPage(page, pages) {
	var totalPages = Math.floor(Number(pages));
	if (!isFinite(totalPages) || totalPages < 1) totalPages = 1;
	var pageIndex = Math.floor(Number(page));
	if (!isFinite(pageIndex)) pageIndex = 0;
	return Math.max(0, Math.min(pageIndex, totalPages - 1));
}

function layoutAdvancedCrafterElements(content, page, slotsCount) {
	if (!content) return;
	if (!content.elements) content = { elements: content };
	var currentPage = Math.floor(Number(page));
	if (!isFinite(currentPage) || currentPage < 0) currentPage = 0;
	var visibleCount = getAdvancedCrafterVisibleCount(currentPage, slotsCount);
	var mainHeight = UI.getScreenHeight() - 60;
	var gridHeight = RSE_CRAFTER_ROWS * RSE_CRAFTER_ROW_HEIGHT;
	var gridTop = Math.max(88, Math.floor((mainHeight - gridHeight) / 2));
	for (var slotIndex = 0; slotIndex < RSE_CRAFTERS_PER_PAGE; slotIndex++) {
		var columnIndex = slotIndex % RSE_CRAFTER_COLUMNS;
		var rowIndex = Math.floor(slotIndex / RSE_CRAFTER_COLUMNS);
		var patternElement = getAdvancedCrafterElement(content, "slot_pattern" + slotIndex);
		patternElement.type = "slot";
		patternElement.num = slotIndex;
		patternElement.name = "slot_pattern" + slotIndex;
		patternElement.size = RSE_CRAFTER_PATTERN_SIZE;
		patternElement.maxStackSize = 1;
		if (typeof patternElement.onItemChanged != "function") {
			patternElement.onItemChanged = function (container) {
				updateAdvancedCrafterOutputSlots(container);
			};
		}
		var outputElement = getAdvancedCrafterElement(content, "output_pattern" + slotIndex);
		outputElement.type = "slot";
		outputElement.num = slotIndex;
		outputElement.size = RSE_CRAFTER_OUTPUT_SIZE;
		outputElement.visual = true;
		outputElement.bitmap = "empty";
		if (slotIndex < visibleCount) {
			patternElement.x = RSE_CRAFTER_GRID_X + columnIndex * RSE_CRAFTER_PATTERN_SIZE;
			patternElement.y = gridTop + rowIndex * RSE_CRAFTER_ROW_HEIGHT + RSE_CRAFTER_OUTPUT_SIZE + RSE_CRAFTER_OUTPUT_GAP;
			outputElement.x = patternElement.x + (RSE_CRAFTER_PATTERN_SIZE - RSE_CRAFTER_OUTPUT_SIZE) / 2;
			outputElement.y = gridTop + rowIndex * RSE_CRAFTER_ROW_HEIGHT;
		} else {
			patternElement.x = -1000;
			patternElement.y = -1000;
			outputElement.x = -1000;
			outputElement.y = -1000;
		}
	}
	var upgradesLabelElement = getAdvancedCrafterElement(content, "upgrades_label");
	upgradesLabelElement.type = "text";
	upgradesLabelElement.x = 255;
	upgradesLabelElement.y = 82;
	upgradesLabelElement.text = Translation.translate("Upgrades");
	upgradesLabelElement.font = upgradesLabelElement.font || {};
	upgradesLabelElement.font.size = 14;
	upgradesLabelElement.font.color = android.graphics.Color.DKGRAY;
	for (var upgradeSlotIndex = 0; upgradeSlotIndex < 4; upgradeSlotIndex++) {
		var upgradeSlotElement = getAdvancedCrafterElement(content, "slot_upgrades" + upgradeSlotIndex);
		upgradeSlotElement.type = "slot";
		upgradeSlotElement.num = upgradeSlotIndex;
		upgradeSlotElement.name = "slot_upgrades" + upgradeSlotIndex;
		upgradeSlotElement.x = 255;
		upgradeSlotElement.y = 102 + upgradeSlotIndex * 56;
		upgradeSlotElement.size = 50;
	}
	var redstoneButtonElement = getAdvancedCrafterElement(content, "redstone_button");
	redstoneButtonElement.type = "button";
	redstoneButtonElement.x = 255;
	redstoneButtonElement.y = 24;
	redstoneButtonElement.bitmap = "RSE_empty_button";
	redstoneButtonElement.bitmap2 = "RSE_empty_button_pressed";
	redstoneButtonElement.scale = 2.5;
	if (!redstoneButtonElement.clicker) {
		redstoneButtonElement.clicker = {
			onClick: function (itemContainerUiHandler, itemContainer, element) {
				itemContainer.sendEvent("updateRedstoneMode", {});
			},
			onLongClick: function (itemContainerUiHandler, itemContainer, element) {}
		};
	}
	var redstoneImageElement = getAdvancedCrafterElement(content, "image_redstone");
	redstoneImageElement.type = "image";
	redstoneImageElement.x = 256;
	redstoneImageElement.y = 25;
	redstoneImageElement.scale = 3;
	redstoneImageElement.z = 100;
	if (!redstoneImageElement.bitmap) redstoneImageElement.bitmap = "UIC_redstone_gui_0";
	var redstoneTextElement = getAdvancedCrafterElement(content, "redstone_text");
	redstoneTextElement.type = "text";
	redstoneTextElement.x = 315;
	redstoneTextElement.y = 38;
	redstoneTextElement.font = redstoneTextElement.font || {};
	redstoneTextElement.font.size = 14;
	redstoneTextElement.font.color = android.graphics.Color.WHITE;
	if (typeof redstoneTextElement.text != "string") redstoneTextElement.text = "";
	var statusTextElement = getAdvancedCrafterElement(content, "status_text");
	statusTextElement.type = "text";
	statusTextElement.x = 520;
	statusTextElement.y = 38;
	statusTextElement.font = statusTextElement.font || {};
	statusTextElement.font.size = 16;
	if (statusTextElement.font.color === undefined) statusTextElement.font.color = android.graphics.Color.DKGRAY;
	if (typeof statusTextElement.text != "string") statusTextElement.text = "";
	var pageTextElement = getAdvancedCrafterElement(content, "page_text");
	pageTextElement.type = "text";
	pageTextElement.x = 700;
	pageTextElement.y = 38;
	pageTextElement.font = pageTextElement.font || {};
	pageTextElement.font.size = 18;
	pageTextElement.font.color = android.graphics.Color.WHITE;
	if (typeof pageTextElement.text != "string") pageTextElement.text = "";
	var pagePrevElement = getAdvancedCrafterElement(content, "page_prev");
	pagePrevElement.type = "button";
	pagePrevElement.x = 820;
	pagePrevElement.y = 24;
	pagePrevElement.bitmap = "RSE_empty_button";
	pagePrevElement.bitmap2 = "RSE_empty_button_pressed";
	pagePrevElement.scale = 2.5;
	if (!pagePrevElement.clicker) {
		pagePrevElement.clicker = {
			onClick: function (itemContainerUiHandler, itemContainer, element) {
				itemContainer.sendEvent("switchPatternPage", { dir: -1 });
			},
			onLongClick: function (itemContainerUiHandler, itemContainer, element) {}
		};
	}
	var pageNextElement = getAdvancedCrafterElement(content, "page_next");
	pageNextElement.type = "button";
	pageNextElement.x = 876;
	pageNextElement.y = 24;
	pageNextElement.bitmap = "RSE_empty_button";
	pageNextElement.bitmap2 = "RSE_empty_button_pressed";
	pageNextElement.scale = 2.5;
	if (!pageNextElement.clicker) {
		pageNextElement.clicker = {
			onClick: function (itemContainerUiHandler, itemContainer, element) {
				itemContainer.sendEvent("switchPatternPage", { dir: 1 });
			},
			onLongClick: function (itemContainerUiHandler, itemContainer, element) {}
		};
	}
	var pagePrevGlyphElement = getAdvancedCrafterElement(content, "page_prev_glyph");
	pagePrevGlyphElement.type = "text";
	pagePrevGlyphElement.x = 845;
	pagePrevGlyphElement.y = 30;
	pagePrevGlyphElement.text = "<";
	pagePrevGlyphElement.font = { size: 28, color: android.graphics.Color.WHITE, alignment: 1 };
	pagePrevGlyphElement.z = 100;
	var pageNextGlyphElement = getAdvancedCrafterElement(content, "page_next_glyph");
	pageNextGlyphElement.type = "text";
	pageNextGlyphElement.x = 901;
	pageNextGlyphElement.y = 30;
	pageNextGlyphElement.text = ">";
	pageNextGlyphElement.font = { size: 28, color: android.graphics.Color.WHITE, alignment: 1 };
	pageNextGlyphElement.z = 100;
}

var elementsGUI_advancedCrafter = {};
layoutAdvancedCrafterElements({ elements: elementsGUI_advancedCrafter }, 0, RSE_CRAFTERS_PER_PAGE);

var advancedCrafterGUI = new UI.StandartWindow({
	standart: {
		header: { text: { text: Translation.translate("Crafter") } },
		inventory: { padding: 20, width: 300 / 4 * 3 },
		background: { standart: true }
	},
	drawing: [],
	elements: elementsGUI_advancedCrafter
});

function RSE_crafterCraftSignature(craft) {
	var ingredientKey = [];
	for (var i = 0; i < (craft.ingridients || []).length; i++) {
		var ingredient = craft.ingridients[i];
		ingredientKey.push(ingredient.id + ':' + (ingredient.data || 0) + ':' + (ingredient.count || 1));
	}
	var resultKey = [];
	for (var r = 0; r < (craft.result || []).length; r++) {
		resultKey.push(getItemUid(craft.result[r]));
	}
	resultKey.sort();
	return (craft.isProcessed ? '1' : '0') + '|' + ingredientKey.join(',') + '|' + resultKey.join(',');
}

function RSE_crafterHasRegisteredCraft(registeredCrafts, coordsId, craft) {
	var signature = RSE_crafterCraftSignature(craft);
	for (var i = 0; i < registeredCrafts.length; i++) {
		var registered = registeredCrafts[i];
		if (!registered || registered.coordsId !== coordsId) continue;
		if (RSE_crafterCraftSignature(registered) === signature) return true;
	}
	return false;
}

function registerAdvancedCrafter(api, tier) {
	var id = BlockID["RSE_crafter_" + tier.name];
	var cfg = (Config.crafters && Config.crafters[tier.name]) || {};
	var slotsCount = cfg.slots || tier.slots;
	var tierSpeed = cfg.speed || tier.speed;
	var perPattern = cfg.perPattern || tier.perPattern;
	var pages = Math.max(1, Math.ceil(slotsCount / RSE_CRAFTERS_PER_PAGE));

	api.energy.set(id, cfg.energy || tier.energy);

	api.blocks.create(id, {
		useNetworkItemContainer: true,
		upgradesSlots: ["slot_upgrades0", "slot_upgrades1", "slot_upgrades2", "slot_upgrades3"],
		defaultValues: {
			NETWORK_ID: 'f',
			LAST_NETWORK_ID: 'f',
			patternsCount: 0,
			nextCraftId: 0,
			speed: 10,
			crafts: null,
			redstone_mode: 0,
			redstone_power: false,
			block_data: 0,
			page: 0,
			layoutVersion: 2
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
			return advancedCrafterGUI;
		},
		parsePatternExtra: function (extra) {
			if (!extra) return null;
			var isProcessed = extra.getBoolean('isProcessed');
			var inputs = [];
			var outputs = [];
			for (var i = 0; i < 9; i++) {
				var str = extra.getString('craft' + i);
				if (!str) continue;
				var parts = str.split(',');
				if (parts.length < 3) continue;
				var ingr = { id: parseInt(parts[0]), count: parseInt(parts[1]), data: parseInt(parts[2]) };
				if (ingr.id == 0 || isNaN(ingr.id)) continue;
				inputs.push(ingr);
			}
			var maxOut = isProcessed ? 9 : 1;
			for (var i = 0; i < maxOut; i++) {
				var str = extra.getString('result' + i);
				if (!str) continue;
				var parts = str.split(',');
				if (parts.length < 3) continue;
				var res = { id: parseInt(parts[0]), count: parseInt(parts[1] || 1), data: parseInt(parts[2] || 0) };
				if (res.id == 0 || isNaN(res.id)) continue;
				outputs.push(res);
			}
			if (outputs.length === 0) return null;
			return { isProcessed: isProcessed, inputs: inputs, outputs: outputs };
		},
		addCraft: function (slot, extra) {
			var item = extra ? { extra: extra } : this.container.getSlot(slot);
			if (!item || !item.extra) return false;
			var pattern = this.parsePatternExtra(item.extra);
			if (!pattern || pattern.inputs.length === 0) return false;
			var craftCount = Object.keys(this.data.crafts).length;
			if (Object.prototype.hasOwnProperty.call(this.data.crafts, slot)) craftCount--;
			if (craftCount >= slotsCount) return false;
			var craft = {
				id: allocateCraftId(this),
				isProcessed: pattern.isProcessed,
				oredictEnabled: item.extra.getBoolean('oredictEnabled'),
				ingridients: pattern.inputs,
				result: pattern.outputs
			};
			var netId = this.data.NETWORK_ID;
			var registered = netId == 'f' ? null : api.crafters.registerPattern(netId, cts(this), craft);
			this.data.crafts[slot] = registered || craft;
			this.data.patternsCount = Object.keys(this.data.crafts).length;
			return netId != 'f';
		},
		removeCraft: function (slot) {
			var craft = this.data.crafts[slot];
			if (!craft) return;
			delete this.data.crafts[slot];
			this.data.patternsCount = Object.keys(this.data.crafts).length;
			var netId = this.data.NETWORK_ID;
			if (netId == 'f') return;
			api.crafters.unregisterPattern(netId, cts(this), craft);
		},
		moveCraftBetweenSlots: function (fromSlot, toSlot) {
			if (fromSlot == toSlot) return;
			var craft = this.data.crafts[fromSlot];
			if (!craft) return;
			delete this.data.crafts[fromSlot];
			this.data.crafts[toSlot] = craft;
		},
		switchPageTo: function (newPage, pages) {
			if (this.data.layoutVersion !== 2) {
				RSE.log("advanced crafter page switch blocked: layoutVersion=" + this.data.layoutVersion + " requires migration");
				return;
			}
			var oldPage = clampAdvancedCrafterPage(this.data.page, pages);
			var targetPage = clampAdvancedCrafterPage(newPage, pages);
			if (targetPage == oldPage) {
				this.data.page = oldPage;
				return;
			}
			var i, visibleSlotName, storeSlotName, storeSlotIndex, item;
			for (i = 0; i < RSE_CRAFTERS_PER_PAGE; i++) {
				storeSlotIndex = oldPage * RSE_CRAFTERS_PER_PAGE + i;
				if (storeSlotIndex >= slotsCount) continue;
				storeSlotName = 'slot_store' + storeSlotIndex;
				item = this.container.getSlot(storeSlotName);
				if (item && item.id != 0) {
					RSE.log("advanced crafter page switch blocked: target slot " + storeSlotName + " is occupied");
					return;
				}
			}
			for (i = 0; i < RSE_CRAFTERS_PER_PAGE; i++) {
				visibleSlotName = 'slot_pattern' + i;
				storeSlotIndex = oldPage * RSE_CRAFTERS_PER_PAGE + i;
				if (storeSlotIndex >= slotsCount) continue;
				storeSlotName = 'slot_store' + storeSlotIndex;
				item = this.container.getSlot(visibleSlotName);
				if (item && item.id != 0) {
					this.container.setSlot(storeSlotName, item.id, item.count, item.data, item.extra);
					this.container.clearSlot(visibleSlotName);
					this.moveCraftBetweenSlots(visibleSlotName, storeSlotName);
				}
			}
			for (i = 0; i < RSE_CRAFTERS_PER_PAGE; i++) {
				visibleSlotName = 'slot_pattern' + i;
				storeSlotIndex = targetPage * RSE_CRAFTERS_PER_PAGE + i;
				if (storeSlotIndex >= slotsCount) continue;
				storeSlotName = 'slot_store' + storeSlotIndex;
				item = this.container.getSlot(storeSlotName);
				if (item && item.id != 0) {
					this.container.setSlot(visibleSlotName, item.id, item.count, item.data, item.extra);
					this.container.clearSlot(storeSlotName);
					this.moveCraftBetweenSlots(storeSlotName, visibleSlotName);
				}
			}
			this.data.page = targetPage;
			this.container.sendChanges();
			this.refreshGui();
		},
		post_update_network: function (net_id) {
			var tile = this;
			if (net_id == 'f') {
				for (var s in this.data.crafts) {
					var craft = this.data.crafts[s];
					var lastNet = this.data.LAST_NETWORK_ID;
					if (lastNet != 'f') api.crafters.unregisterPattern(lastNet, cts(this), craft);
				}
				api.crafters.unregisterContainer(this);
				return;
			}
			var registeredCrafts = null;
			if (api.networks && typeof api.networks.getCrafts === 'function') {
				registeredCrafts = api.networks.getCrafts(net_id) || [];
			}
			for (var s in this.data.crafts) {
				var craft = this.data.crafts[s];
				var slotItem = this.container.getSlot(s);
				if (!slotItem || slotItem.id != ItemID.RSpattern || !slotItem.extra) continue;
				if (registeredCrafts && RSE_crafterHasRegisteredCraft(registeredCrafts, cts(this), craft)) continue;
				var registered = api.crafters.registerPattern(net_id, cts(this), craft);
				if (registered) this.data.crafts[s] = registered;
			}
			api.crafters.registerContainer(this, {
				containerId: 'advanced_crafter_' + tier.name,
				coordsId: cts(this),
				getPatterns: function () {
					var out = [];
					for (var cs in tile.data.crafts) {
						var slotItem = tile.container.getSlot(cs);
						if (slotItem && slotItem.id == ItemID.RSpattern && slotItem.extra) out.push(tile.data.crafts[cs]);
					}
					return out;
				},
				getFrontSide: function (crafterTile) { return api.crafters.getFrontSide(crafterTile); },
				getSpeed: function (crafterTile) { return crafterTile.data.speed || 10; },
				getUpdateInterval: function (crafterTile) { return Math.max(1, crafterTile.data.speed || 10); },
				// Java ExtraStorage speed upgrades increase both update rate and steps;
				// Iron is 1+U, other tiers tierSpeed+U*(tierSpeed/5).
				getMaximumSuccessfulCraftingUpdates: function (crafterTile) {
					var speed = Math.max(1, crafterTile.data.speed || 10);
					var speedUpgrades = Math.max(0, Math.min(4, Math.round((10 - speed) / 2)));
					if (tierSpeed <= 1) return 1 + speedUpgrades;
					return tierSpeed + speedUpgrades * Math.floor(tierSpeed / 5);
				},
				getUsage: function (crafterTile) { return (perPattern || 0) * (crafterTile.data.patternsCount || 0); }
			});
		},
		pre_init: function () {
			var tile = this;
			var storedLayoutVersion = tile.data.layoutVersion;
			if (storedLayoutVersion === undefined) {
				tile.data.layoutVersion = 1;
				tile.data.crafterLayoutNeedsMigration = true;
			} else if (storedLayoutVersion === 2) {
				tile.data.crafterLayoutNeedsMigration = false;
			}
			tile.data.page = clampAdvancedCrafterPage(tile.data.page, pages);
			if (!isValidCraftsMap(tile.data.crafts)) tile.data.crafts = {};
			var nextCraftId = tile.data.nextCraftId;
			if (typeof nextCraftId != 'number' || !isFinite(nextCraftId) || Math.floor(nextCraftId) != nextCraftId || nextCraftId < 0) nextCraftId = 0;
			for (var craftSlot in tile.data.crafts) {
				if (!Object.prototype.hasOwnProperty.call(tile.data.crafts, craftSlot)) continue;
				var existingCraft = tile.data.crafts[craftSlot];
				if (!existingCraft || typeof existingCraft.id != 'string') continue;
				var craftIdMatch = /^pattern_(\d+)$/.exec(existingCraft.id);
				if (!craftIdMatch) continue;
				var existingCraftId = parseInt(craftIdMatch[1], 10);
				if (!isNaN(existingCraftId) && existingCraftId > nextCraftId) nextCraftId = existingCraftId;
			}
			tile.data.nextCraftId = nextCraftId;
			tile.data.patternsCount = Object.keys(tile.data.crafts).length;
			tile.container.setGlobalAddTransferPolicy({
				transfer: function (itemContainer, slot, id, count, data, extra, player) {
					return 0;
				}
			});
			var storeGetTransferPolicy = {
				transfer: function (itemContainer, slot, id, count, data, extra, player) {
					return 0;
				}
			};
			var storeSlotCount = slotsCount;
			for (var storeSlotIndex = 0; storeSlotIndex < storeSlotCount; storeSlotIndex++) {
				tile.container.setSlotGetTransferPolicy("slot_store" + storeSlotIndex, storeGetTransferPolicy);
			}
			var getVisiblePatternCount = function () {
				return getAdvancedCrafterVisibleCount(tile.data.page, slotsCount);
			};
			for (var i = 0; i < RSE_CRAFTERS_PER_PAGE; i++) {
				(function (slotIndex) {
					var slotName = "slot_pattern" + slotIndex;
					tile.container.setSlotAddTransferPolicy(slotName, {
						transfer: function (itemContainer, slot, id, count, data, extra, player) {
							if (slotIndex >= getVisiblePatternCount()) return 0;
							if (id != ItemID.RSpattern || !extra) return 0;
							var pattern = tile.parsePatternExtra(extra);
							if (!pattern || pattern.inputs.length === 0 || pattern.outputs.length === 0) return 0;
							if (!tile.data.crafts[slotName] && Object.keys(tile.data.crafts).length >= slotsCount) return 0;
							var previousCraft = tile.data.crafts[slotName] || null;
							if (previousCraft) tile.removeCraft(slotName);
							var added = tile.addCraft(slotName, extra);
							// addCraft also returns false when offline even though it stores the craft locally.
							if (!added && !tile.data.crafts[slotName]) {
								if (previousCraft) {
									tile.data.crafts[slotName] = previousCraft;
									tile.data.patternsCount = Object.keys(tile.data.crafts).length;
								}
								return 0;
							}
							return count;
						}
					});
					tile.container.setSlotGetTransferPolicy(slotName, {
						transfer: function (itemContainer, slot, id, count, data, extra, player) {
							if (slotIndex >= getVisiblePatternCount()) return 0;
							if (id == ItemID.RSpattern && tile.data.crafts[slotName]) tile.removeCraft(slotName);
							return count;
						}
					});
				})(i);
			}
		},
		post_init: function () {
			if (typeof recountUpgrades === "function") recountUpgrades(this);
		},
		pre_destroy: function () {
			if (isValidCraftsMap(this.data.crafts)) {
				for (var s in this.data.crafts) this.removeCraft(s);
			}
			api.crafters.unregisterContainer(this);
		},
		refreshGui: function (first, client) {
			var _data = {
				name: this.networkData.getName() + '',
				isActive: this.data.isActive,
				NETWORK_ID: this.data.NETWORK_ID,
				redstone_mode: this.data.redstone_mode,
				page: this.data.page || 0,
				pages: pages
			};
			if (client) this.container.sendEvent(client, "openGui", _data);
			else this.container.sendEvent("openGui", _data);
		},
		refreshModel: function () {
			if (!this.networkEntity) return;
			this.sendPacket("refreshModel", {
				block_data: this.data.block_data,
				isActive: this.data.isActive,
				tier: tier.name,
				coords: { x: this.x, y: this.y, z: this.z }
			});
		},
		containerEvents: {
			switchPatternPage: function (eventData, connectedClient) {
				if (this.data.layoutVersion !== 2) {
					RSE.log("advanced crafter page switch blocked: layoutVersion=" + this.data.layoutVersion + " requires migration");
					return;
				}
				var direction = eventData ? eventData.dir : null;
				if (typeof direction != 'number' || isNaN(direction) || Math.floor(direction) != direction || direction == 0) return;
				direction = direction > 0 ? 1 : -1;
				var currentPage = clampAdvancedCrafterPage(this.data.page, pages);
				var newPage = clampAdvancedCrafterPage(currentPage + direction, pages);
				this.switchPageTo(newPage, pages);
			}
		},
		client: {
			load: function () {
				this.refreshModel();
			},
			refreshModel: function () {
				var render = new ICRender.Model();
				var model = BlockRenderer.createTexturedBlock(getAdvancedCrafterTexture(this.networkData.getInt('block_data'), this.networkData.getBoolean('isActive'), tier.on));
				render.addEntry(model);
				BlockRenderer.mapAtCoords(this.x, this.y, this.z, render);
			},
			events: {
				refreshModel: function (eventData) {
					var render = new ICRender.Model();
					var model = BlockRenderer.createTexturedBlock(getAdvancedCrafterTexture(eventData.block_data, eventData.isActive, tier.on));
					render.addEntry(model);
					BlockRenderer.mapAtCoords(eventData.coords.x, eventData.coords.y, eventData.coords.z, render);
				}
			},
			containerEvents: {
				openGui: function (container, window, content, eventData) {
					if (!content || !window || !window.isOpened()) return;
					if (!eventData) return;
					var totalPages = Math.floor(Number(eventData.pages));
					if (!isFinite(totalPages) || totalPages < 1) totalPages = pages;
					var currentPage = clampAdvancedCrafterPage(eventData.page, totalPages);
					layoutAdvancedCrafterElements(content, currentPage, slotsCount);
					var redstoneModes = ["Ignore", "With signal", "Without signal"];
					var redstoneMode = parseInt(eventData.redstone_mode, 10);
					if (isNaN(redstoneMode)) redstoneMode = 0;
					redstoneMode = Math.max(0, Math.min(2, redstoneMode));
					if (content.elements["page_text"]) {
						content.elements["page_text"].text = Translation.translate("Page") + ": " + (currentPage + 1) + " / " + totalPages;
					}
					if (content.elements["redstone_text"]) {
						content.elements["redstone_text"].text = Translation.translate(redstoneModes[redstoneMode]);
					}
					if (content.elements["image_redstone"]) {
						content.elements["image_redstone"].bitmap = "UIC_redstone_gui_" + redstoneMode;
					}
					if (content.elements["status_text"]) {
						content.elements["status_text"].text = Translation.translate(eventData.isActive ? "Active" : "Offline");
						content.elements["status_text"].font.color = eventData.isActive ? android.graphics.Color.DKGRAY : android.graphics.Color.RED;
					}
					updateAdvancedCrafterOutputSlots(container, content, currentPage);
					window.getWindow('main').forceRefresh();
				}
			}
		}
	});
}

Callback.addCallback("PostLoaded", function () {
	ModAPI.addAPICallback("RefinedStorageAPI", function (api) {
		if (!api || !api.blocks || !api.crafters) {
			RSE.log("advanced crafters skipped: RefinedStorageAPI unavailable");
			return;
		}
		if (!RSE.apiAtLeast(api, 2, 0)) {
			RSE.log("advanced crafters skipped: RefinedStorageAPI 2.0 required");
			return;
		}
		for (var ri = 0; ri < RSE_CRAFTER_TIERS.length; ri++) {
			registerAdvancedCrafter(api, RSE_CRAFTER_TIERS[ri]);
		}
		RSE.logDev("advanced crafters registered");
	});
});
