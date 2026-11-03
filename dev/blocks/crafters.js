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
	{ name: "iron", display: "Iron Autocrafter", title: "Iron Crafter", speed: 1, slots: 27, energy: 4, perPattern: 1 },
	{ name: "gold", display: "Gold Autocrafter", title: "Gold Crafter", speed: 5, slots: 45, energy: 4, perPattern: 1 },
	{ name: "diamond", display: "Diamond Autocrafter", title: "Diamond Crafter", speed: 25, slots: 63, energy: 4, perPattern: 1 },
	{ name: "netherite", display: "Netherite Autocrafter", title: "Netherite Crafter", speed: 125, slots: 81, energy: 4, perPattern: 1 }
];

var RSE_ADVANCED_CRAFTER_LAYOUT_VERSION = 3;
// Viewport names are UI-facing and denied server-side; real pattern slots remain slot_pattern0..80.
var RSE_CRAFTER_UNBOUND_SLOT_NAME = "slot_pattern_unbound";
var RSE_CRAFTER_ZERO_SOURCE = { id: 0, count: 0, data: 0 };

for (var ti = 0; ti < RSE_CRAFTER_TIERS.length; ti++) {
	var tpref = "RSE_crafter_" + RSE_CRAFTER_TIERS[ti].name + "_";
	RSE_CRAFTER_TIERS[ti].on = [
		[tpref + "bot_on", 0], [tpref + "top_on", 0], ["RSE_crafter_bottom", 0],
		[tpref + "front_on", 0], [tpref + "side_left_on", 0], [tpref + "side_on", 0]
	];
}

function getAdvancedCrafterMaxPatternSlots() {
	var maxPatternSlots = RSE_CRAFTERS_PER_PAGE;
	for (var crafterTierIndex = 0; crafterTierIndex < RSE_CRAFTER_TIERS.length; crafterTierIndex++) {
		var crafterTier = RSE_CRAFTER_TIERS[crafterTierIndex];
		var crafterConfig = (Config.crafters && Config.crafters[crafterTier.name]) || {};
		var configuredSlots = Math.floor(Number(crafterConfig.slots || crafterTier.slots));
		if (isFinite(configuredSlots) && configuredSlots > maxPatternSlots) maxPatternSlots = configuredSlots;
	}
	return maxPatternSlots;
}

var RSE_CRAFTER_MAX_PATTERN_SLOTS = getAdvancedCrafterMaxPatternSlots();

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

function getAdvancedCrafterPageCount(slotsCount) {
	var totalSlots = Math.floor(Number(slotsCount));
	if (!isFinite(totalSlots) || totalSlots < 0) totalSlots = 0;
	return Math.max(1, Math.ceil(totalSlots / RSE_CRAFTERS_PER_PAGE));
}

function resolveAdvancedCrafterContainer(container) {
	if (!container) return null;
	if (container.slots) return container;
	if (typeof container.getParent == "function") {
		var parentContainer = null;
		try {
			parentContainer = container.getParent();
		} catch (error) {
			parentContainer = null;
		}
		if (parentContainer && parentContainer.slots) return parentContainer;
	}
	return container;
}

function getAdvancedCrafterMainWindow(itemContainer) {
	if (!itemContainer) return null;
	var windowGroup = null;
	if (typeof itemContainer.getWindow == "function") {
		try {
			windowGroup = itemContainer.getWindow();
		} catch (error) {
			windowGroup = null;
		}
	}
	if (!windowGroup && typeof itemContainer.getUiAdapter == "function") {
		var uiAdapter = null;
		try {
			uiAdapter = itemContainer.getUiAdapter();
		} catch (error) {
			uiAdapter = null;
		}
		windowGroup = uiAdapter ? uiAdapter.getWindow() : null;
	}
	if (!windowGroup) return null;
	if (typeof windowGroup.getWindow == "function") return windowGroup.getWindow('main');
	return windowGroup;
}

function resolveAdvancedCrafterUiContainer(itemContainer, mainWindow) {
	if (mainWindow && typeof mainWindow.getContainer == "function") {
		var mainWindowContainer = null;
		try {
			mainWindowContainer = mainWindow.getContainer();
		} catch (error) {
			mainWindowContainer = null;
		}
		if (mainWindowContainer && typeof mainWindowContainer.getSlotVisualImpl == "function") return mainWindowContainer;
	}
	if (itemContainer && typeof itemContainer.getSlotVisualImpl == "function") return itemContainer;
	if (itemContainer && typeof itemContainer.getUiAdapter == "function") {
		var uiAdapter = null;
		try {
			uiAdapter = itemContainer.getUiAdapter();
		} catch (error) {
			uiAdapter = null;
		}
		if (uiAdapter && typeof uiAdapter.getSlotVisualImpl == "function") return uiAdapter;
	}
	return null;
}

function getAdvancedCrafterLiveElement(liveElements, elementName) {
	if (!liveElements) return null;
	if (typeof liveElements.get == "function") return liveElements.get(elementName) || null;
	return liveElements[elementName] || null;
}

function getAdvancedCrafterLiveElements(mainWindow) {
	if (!mainWindow || typeof mainWindow.getElements != "function") return null;
	try {
		return mainWindow.getElements();
	} catch (error) {
		return null;
	}
}

function getAdvancedCrafterSlotItem(itemContainer, slotName) {
	if (!itemContainer) return null;
	if (typeof itemContainer.getSlot == "function") {
		try {
			var slotItem = itemContainer.getSlot(slotName);
			if (slotItem) return slotItem;
		} catch (error) {
			// Fall through to the plain slots map when getSlot is unavailable.
		}
	}
	if (itemContainer.slots) return itemContainer.slots[slotName] || null;
	return null;
}

function getAdvancedCrafterPatternResult(patternItem) {
	if (!patternItem || patternItem.id != ItemID.RSpattern || !patternItem.extra) return null;
	var resultString = patternItem.extra.getString('result0');
	if (!resultString) return null;
	var resultParts = resultString.split(',');
	if (resultParts.length < 3) return null;
	var resultId = parseInt(resultParts[0], 10);
	if (resultId == 0 || isNaN(resultId)) return null;
	return {
		id: resultId,
		count: parseInt(resultParts[1] || 1, 10),
		data: parseInt(resultParts[2] || 0, 10)
	};
}

function getAdvancedCrafterViewportPatternName(viewportIndex) {
	return "slot_pattern_view" + viewportIndex;
}

function getAdvancedCrafterViewportOutputName(viewportIndex) {
	return "output_pattern_view" + viewportIndex;
}

function getAdvancedCrafterPageText(page, pages) {
	return Translation.translate("Page") + ": " + (page + 1) + " / " + pages;
}

function getAdvancedCrafterGridTop() {
	var mainHeight = UI.getScreenHeight() - 60;
	var gridHeight = RSE_CRAFTER_ROWS * RSE_CRAFTER_ROW_HEIGHT;
	return Math.max(88, Math.floor((mainHeight - gridHeight) / 2));
}

function getAdvancedCrafterLivePosition(viewportIndex) {
	var gridTop = getAdvancedCrafterGridTop();
	var columnIndex = viewportIndex % RSE_CRAFTER_COLUMNS;
	var rowIndex = Math.floor(viewportIndex / RSE_CRAFTER_COLUMNS);
	var patternX = RSE_CRAFTER_GRID_X + columnIndex * RSE_CRAFTER_PATTERN_SIZE;
	var outputY = gridTop + rowIndex * RSE_CRAFTER_ROW_HEIGHT;
	return {
		patternX: patternX,
		patternY: outputY + RSE_CRAFTER_OUTPUT_SIZE + RSE_CRAFTER_OUTPUT_GAP,
		outputX: patternX + (RSE_CRAFTER_PATTERN_SIZE - RSE_CRAFTER_OUTPUT_SIZE) / 2,
		outputY: outputY
	};
}

function getAdvancedCrafterHiddenViewportMask(content) {
	if (!content) return 0;
	var hiddenMask = content.rseViewportHiddenMask;
	if (typeof hiddenMask != "number" || !isFinite(hiddenMask) || hiddenMask < 0) hiddenMask = 0;
	return hiddenMask;
}

function isAdvancedCrafterViewportHidden(content, viewportIndex) {
	var viewportFlag = Math.pow(2, viewportIndex);
	return Math.floor(getAdvancedCrafterHiddenViewportMask(content) / viewportFlag) % 2 === 1;
}

function setAdvancedCrafterViewportHidden(content, viewportIndex, hidden) {
	if (!content) return;
	var hiddenMask = getAdvancedCrafterHiddenViewportMask(content);
	var viewportFlag = Math.pow(2, viewportIndex);
	var wasHidden = Math.floor(hiddenMask / viewportFlag) % 2 === 1;
	if (wasHidden === hidden) return;
	content.rseViewportHiddenMask = hidden ? hiddenMask + viewportFlag : hiddenMask - viewportFlag;
}

function getAdvancedCrafterOutputSource(content, viewportIndex) {
	var outputSources = content.rseViewportOutputSources;
	if (!outputSources || typeof outputSources.length != "number") {
		outputSources = [];
		content.rseViewportOutputSources = outputSources;
	}
	var outputSource = outputSources[viewportIndex];
	if (!outputSource) {
		outputSource = { id: 0, count: 0, data: 0 };
		outputSources[viewportIndex] = outputSource;
	}
	return outputSource;
}

function applyAdvancedCrafterOutputSource(outputSource, patternItem) {
	var patternResult = getAdvancedCrafterPatternResult(patternItem);
	if (patternResult) {
		outputSource.id = patternResult.id;
		outputSource.count = patternResult.count;
		outputSource.data = patternResult.data;
		return;
	}
	outputSource.id = 0;
	outputSource.count = 0;
	outputSource.data = 0;
}

function bindAdvancedCrafterViewportPatternSlot(uiContainer, livePatternElement, patternSlotName) {
	if (!livePatternElement) return;
	if (uiContainer && typeof livePatternElement.setupInitialBindings == "function") {
		livePatternElement.setupInitialBindings(uiContainer, patternSlotName);
		return;
	}
	if (!uiContainer || typeof uiContainer.getSlotVisualImpl != "function") {
		RSE.log("advanced crafter viewport: no UI container for " + patternSlotName);
		try {
			livePatternElement.slotName = null;
		} catch (error) {}
		if (typeof livePatternElement.setBinding == "function") livePatternElement.setBinding("source", RSE_CRAFTER_ZERO_SOURCE);
		return;
	}
	RSE.log("advanced crafter viewport: setupInitialBindings unavailable, fallback for " + patternSlotName);
	try {
		livePatternElement.slotName = patternSlotName;
	} catch (error) {}
	if (typeof livePatternElement.setBinding == "function") {
		livePatternElement.setBinding("source", uiContainer.getSlotVisualImpl(patternSlotName));
	}
}

function bindAdvancedCrafterViewportUnboundSlot(uiContainer, livePatternElement) {
	if (!livePatternElement) return;
	if (uiContainer && typeof livePatternElement.setupInitialBindings == "function") {
		livePatternElement.setupInitialBindings(uiContainer, RSE_CRAFTER_UNBOUND_SLOT_NAME);
	}
	try {
		livePatternElement.slotName = null;
	} catch (error) {}
	if (typeof livePatternElement.setBinding == "function") livePatternElement.setBinding("source", RSE_CRAFTER_ZERO_SOURCE);
}

function updateAdvancedCrafterViewportOutput(container, viewportIndex) {
	var mainWindow = getAdvancedCrafterMainWindow(container);
	if (!mainWindow || typeof mainWindow.getContent != "function") return;
	if (typeof mainWindow.isOpened == "function" && !mainWindow.isOpened()) return;
	var content = mainWindow.getContent();
	if (!content || !content.elements) return;
	if (content.rseCrafterLayoutVersion !== RSE_ADVANCED_CRAFTER_LAYOUT_VERSION) return;
	var slotCount = Math.floor(Number(content.rsePatternSlotCount));
	if (!isFinite(slotCount) || slotCount < 0) slotCount = 0;
	var pageCount = getAdvancedCrafterPageCount(slotCount);
	var pageIndex = clampAdvancedCrafterPage(content.rseCurrentPatternPage || 0, pageCount);
	var patternSlotIndex = pageIndex * RSE_CRAFTERS_PER_PAGE + viewportIndex;
	var itemContainer = resolveAdvancedCrafterContainer(container);
	var patternItem = patternSlotIndex < slotCount ? getAdvancedCrafterSlotItem(itemContainer, "slot_pattern" + patternSlotIndex) : null;
	var outputSource = getAdvancedCrafterOutputSource(content, viewportIndex);
	applyAdvancedCrafterOutputSource(outputSource, patternItem);
	var liveOutputElement = getAdvancedCrafterLiveElement(getAdvancedCrafterLiveElements(mainWindow), getAdvancedCrafterViewportOutputName(viewportIndex));
	if (liveOutputElement && typeof liveOutputElement.setBinding == "function") {
		liveOutputElement.setBinding("source", outputSource);
	}
}

function createAdvancedCrafterPatternChangeHandler(viewportIndex) {
	return function (container) {
		updateAdvancedCrafterViewportOutput(container, viewportIndex);
	};
}

function applyAdvancedCrafterLivePositions(mainWindow, content) {
	var liveElements = getAdvancedCrafterLiveElements(mainWindow);
	if (!liveElements) return;
	for (var viewportIndex = 0; viewportIndex < RSE_CRAFTERS_PER_PAGE; viewportIndex++) {
		var livePosition = getAdvancedCrafterLivePosition(viewportIndex);
		var livePatternElement = getAdvancedCrafterLiveElement(liveElements, getAdvancedCrafterViewportPatternName(viewportIndex));
		if (livePatternElement && typeof livePatternElement.setPosition == "function") {
			livePatternElement.setPosition(livePosition.patternX, livePosition.patternY);
		}
		var liveOutputElement = getAdvancedCrafterLiveElement(liveElements, getAdvancedCrafterViewportOutputName(viewportIndex));
		if (liveOutputElement && typeof liveOutputElement.setPosition == "function") {
			liveOutputElement.setPosition(livePosition.outputX, livePosition.outputY);
		}
	}
	if (content) content.rseViewportHiddenMask = 0;
}

function applyAdvancedCrafterViewportVisibility(mainWindow, content, page, slotsCount) {
	if (!content) return;
	var totalSlots = Math.floor(Number(slotsCount));
	if (!isFinite(totalSlots) || totalSlots < 0) totalSlots = 0;
	var totalPages = getAdvancedCrafterPageCount(totalSlots);
	var pageIndex = clampAdvancedCrafterPage(page, totalPages);
	var visibleCount = getAdvancedCrafterVisibleCount(pageIndex, totalSlots);
	var liveElements = getAdvancedCrafterLiveElements(mainWindow);
	if (!liveElements) return;
	for (var viewportIndex = 0; viewportIndex < RSE_CRAFTERS_PER_PAGE; viewportIndex++) {
		var shouldHide = viewportIndex >= visibleCount;
		if (isAdvancedCrafterViewportHidden(content, viewportIndex) === shouldHide) continue;
		var livePatternElement = getAdvancedCrafterLiveElement(liveElements, getAdvancedCrafterViewportPatternName(viewportIndex));
		var liveOutputElement = getAdvancedCrafterLiveElement(liveElements, getAdvancedCrafterViewportOutputName(viewportIndex));
		if (shouldHide) {
			if (livePatternElement && typeof livePatternElement.setPosition == "function") livePatternElement.setPosition(-1000, -1000);
			if (liveOutputElement && typeof liveOutputElement.setPosition == "function") liveOutputElement.setPosition(-1000, -1000);
		} else {
			var livePosition = getAdvancedCrafterLivePosition(viewportIndex);
			if (livePatternElement && typeof livePatternElement.setPosition == "function") {
				livePatternElement.setPosition(livePosition.patternX, livePosition.patternY);
			}
			if (liveOutputElement && typeof liveOutputElement.setPosition == "function") {
				liveOutputElement.setPosition(livePosition.outputX, livePosition.outputY);
			}
		}
		setAdvancedCrafterViewportHidden(content, viewportIndex, shouldHide);
	}
}

function applyAdvancedCrafterViewportPage(itemContainer, mainWindow, content, page, slotsCount) {
	if (!content || !content.elements) return false;
	var totalSlots = Math.floor(Number(slotsCount));
	if (!isFinite(totalSlots) || totalSlots < 0) totalSlots = 0;
	var totalPages = getAdvancedCrafterPageCount(totalSlots);
	var pageIndex = clampAdvancedCrafterPage(page, totalPages);
	content.rseCurrentPatternPage = pageIndex;

	var uiContainer = resolveAdvancedCrafterUiContainer(itemContainer, mainWindow);
	var resolvedItemContainer = resolveAdvancedCrafterContainer(itemContainer);
	if (!resolvedItemContainer && uiContainer) resolvedItemContainer = resolveAdvancedCrafterContainer(uiContainer);
	var liveElements = getAdvancedCrafterLiveElements(mainWindow);

	for (var viewportIndex = 0; viewportIndex < RSE_CRAFTERS_PER_PAGE; viewportIndex++) {
		var patternSlotIndex = pageIndex * RSE_CRAFTERS_PER_PAGE + viewportIndex;
		var patternSlotName = "slot_pattern" + patternSlotIndex;
		var livePatternElement = getAdvancedCrafterLiveElement(liveElements, getAdvancedCrafterViewportPatternName(viewportIndex));
		if (livePatternElement) {
			if (patternSlotIndex < totalSlots) {
				bindAdvancedCrafterViewportPatternSlot(uiContainer, livePatternElement, patternSlotName);
			} else {
				bindAdvancedCrafterViewportUnboundSlot(uiContainer, livePatternElement);
			}
		}
		var liveOutputElement = getAdvancedCrafterLiveElement(liveElements, getAdvancedCrafterViewportOutputName(viewportIndex));
		if (liveOutputElement) {
			var patternItem = patternSlotIndex < totalSlots ? getAdvancedCrafterSlotItem(resolvedItemContainer, patternSlotName) : null;
			var outputSource = getAdvancedCrafterOutputSource(content, viewportIndex);
			applyAdvancedCrafterOutputSource(outputSource, patternItem);
			if (typeof liveOutputElement.setBinding == "function") liveOutputElement.setBinding("source", outputSource);
		}
	}

	var livePageTextElement = getAdvancedCrafterLiveElement(liveElements, "page_text");
	if (livePageTextElement && typeof livePageTextElement.setBinding == "function") {
		livePageTextElement.setBinding("text", getAdvancedCrafterPageText(pageIndex, totalPages));
	}
	applyAdvancedCrafterViewportVisibility(mainWindow, content, pageIndex, totalSlots);
	return true;
}

function hasAdvancedCrafterStaticLayout(content) {
	if (!content || !content.elements) return false;
	for (var viewportIndex = 0; viewportIndex < RSE_CRAFTERS_PER_PAGE; viewportIndex++) {
		var patternElementName = getAdvancedCrafterViewportPatternName(viewportIndex);
		var outputElementName = getAdvancedCrafterViewportOutputName(viewportIndex);
		var patternElement = content.elements[patternElementName];
		if (!patternElement || patternElement.type != "slot" || patternElement.name != patternElementName) return false;
		if (typeof patternElement.onItemChanged != "function") return false;
		var outputElement = content.elements[outputElementName];
		if (!outputElement || outputElement.type != "slot" || outputElement.name != outputElementName) return false;
	}
	var pageTextElement = content.elements["page_text"];
	return !!pageTextElement && pageTextElement.type == "text";
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

function switchAdvancedCrafterPage(itemContainer, direction) {
	if (!itemContainer) return false;
	if (typeof direction != "number" || !isFinite(direction) || direction == 0) return false;

	var mainWindow = getAdvancedCrafterMainWindow(itemContainer);
	if (!mainWindow || typeof mainWindow.isOpened != "function" || !mainWindow.isOpened()) return false;
	var content = typeof mainWindow.getContent == "function" ? mainWindow.getContent() : null;
	if (!content || !content.elements) return false;
	if (content.rseCrafterLayoutVersion !== RSE_ADVANCED_CRAFTER_LAYOUT_VERSION) return false;

	var slotCount = Math.floor(Number(content.rsePatternSlotCount));
	if (!isFinite(slotCount) || slotCount < 0) slotCount = 0;
	var pageCount = getAdvancedCrafterPageCount(slotCount);
	var currentPage = clampAdvancedCrafterPage(content.rseCurrentPatternPage || 0, pageCount);
	var pageStep = direction > 0 ? 1 : -1;
	var targetPage = clampAdvancedCrafterPage(currentPage + pageStep, pageCount);

	if (content.rsePageSwitchBusy) {
		content.rsePendingPage = targetPage;
		return targetPage !== currentPage;
	}
	if (targetPage === currentPage) return false;

	content.rsePageSwitchBusy = true;
	content.rsePendingPage = targetPage;
	try {
		var pendingPage = content.rsePendingPage;
		while (pendingPage !== null && pendingPage !== undefined) {
			content.rsePendingPage = null;
			applyAdvancedCrafterViewportPage(itemContainer, mainWindow, content, pendingPage, slotCount);
			pendingPage = content.rsePendingPage;
		}
	} finally {
		content.rsePageSwitchBusy = false;
		content.rsePendingPage = null;
	}
	return true;
}

function layoutAdvancedCrafterElements(content, page, slotsCount) {
	if (!content) return;
	if (!content.elements) content = { elements: content };
	var currentPage = Math.floor(Number(page));
	if (!isFinite(currentPage) || currentPage < 0) currentPage = 0;
	var totalSlots = Math.floor(Number(slotsCount));
	if (!isFinite(totalSlots) || totalSlots < 0) totalSlots = 0;
	var totalPages = getAdvancedCrafterPageCount(totalSlots);
	if (currentPage > totalPages - 1) currentPage = totalPages - 1;
	var gridTop = getAdvancedCrafterGridTop();
	for (var viewportIndex = 0; viewportIndex < RSE_CRAFTERS_PER_PAGE; viewportIndex++) {
		var columnIndex = viewportIndex % RSE_CRAFTER_COLUMNS;
		var rowIndex = Math.floor(viewportIndex / RSE_CRAFTER_COLUMNS);
		var patternElement = getAdvancedCrafterElement(content, getAdvancedCrafterViewportPatternName(viewportIndex));
		patternElement.type = "slot";
		patternElement.num = viewportIndex;
		patternElement.name = getAdvancedCrafterViewportPatternName(viewportIndex);
		patternElement.size = RSE_CRAFTER_PATTERN_SIZE;
		patternElement.maxStackSize = 1;
		patternElement.x = RSE_CRAFTER_GRID_X + columnIndex * RSE_CRAFTER_PATTERN_SIZE;
		patternElement.y = gridTop + rowIndex * RSE_CRAFTER_ROW_HEIGHT + RSE_CRAFTER_OUTPUT_SIZE + RSE_CRAFTER_OUTPUT_GAP;
		patternElement.onItemChanged = createAdvancedCrafterPatternChangeHandler(viewportIndex);
		var outputElement = getAdvancedCrafterElement(content, getAdvancedCrafterViewportOutputName(viewportIndex));
		outputElement.type = "slot";
		outputElement.num = viewportIndex;
		outputElement.name = getAdvancedCrafterViewportOutputName(viewportIndex);
		outputElement.size = RSE_CRAFTER_OUTPUT_SIZE;
		outputElement.visual = true;
		outputElement.bitmap = "empty";
		outputElement.x = patternElement.x + (RSE_CRAFTER_PATTERN_SIZE - RSE_CRAFTER_OUTPUT_SIZE) / 2;
		outputElement.y = gridTop + rowIndex * RSE_CRAFTER_ROW_HEIGHT;
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
	pageTextElement.text = getAdvancedCrafterPageText(currentPage, totalPages);
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
				switchAdvancedCrafterPage(itemContainer, -1);
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
				switchAdvancedCrafterPage(itemContainer, 1);
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

function RSE_migrateAdvancedCrafterLayout(tile, slotsCount, pages) {
	if (!tile || !tile.data || !tile.container) return false;

	var data = tile.data;
	if (data.layoutVersion === RSE_ADVANCED_CRAFTER_LAYOUT_VERSION) return true;
	if (data.layoutVersion !== 1 && data.layoutVersion !== 2) {
		RSE.log("advanced crafter migration blocked: unsupported layout version " + data.layoutVersion);
		return false;
	}

	var container = tile.container;
	var validSlotCount = Math.floor(Number(slotsCount));
	if (!isFinite(validSlotCount) || validSlotCount < 0) validSlotCount = 0;
	var isVersionOne = data.layoutVersion === 1;
	var oldPageSize = isVersionOne ? 9 : RSE_CRAFTERS_PER_PAGE;
	var oldPageCount = Math.max(1, Math.ceil(validSlotCount / oldPageSize));
	var migrationPage = isVersionOne
		? clampAdvancedCrafterPage(data.page, oldPageCount)
		: clampAdvancedCrafterPage(data.page, pages);
	var patternIndex;
	var targetPatternIndex;
	var sourcePatternName;

	for (patternIndex = 0; patternIndex < oldPageSize; patternIndex++) {
		targetPatternIndex = migrationPage * oldPageSize + patternIndex;
		if (targetPatternIndex < validSlotCount) continue;
		sourcePatternName = "slot_pattern" + patternIndex;
		if (container.slots) {
			if (!container.slots[sourcePatternName]) continue;
			var outOfRangePatternItem = container.getSlot(sourcePatternName);
			if (outOfRangePatternItem && outOfRangePatternItem.id) {
				RSE.log("advanced crafter migration blocked: " + sourcePatternName + " targets an out-of-range slot");
				return false;
			}
		} else {
			var fallbackPatternItem = container.getSlot(sourcePatternName);
			if (fallbackPatternItem && fallbackPatternItem.id) {
				RSE.log("advanced crafter migration blocked: " + sourcePatternName + " targets an out-of-range slot");
				return false;
			}
		}
	}

	if (container.slots) {
		for (var existingSlotName in container.slots) {
			if (!Object.prototype.hasOwnProperty.call(container.slots, existingSlotName)) continue;
			var existingStoreMatch = /^slot_store(\d+)$/.exec(existingSlotName);
			if (!existingStoreMatch) continue;
			var existingStoreIndex = parseInt(existingStoreMatch[1], 10);
			if (isNaN(existingStoreIndex) || existingStoreIndex < validSlotCount) continue;
			var outOfRangeStoreItem = container.getSlot(existingSlotName);
			if (outOfRangeStoreItem && outOfRangeStoreItem.id) {
				RSE.log("advanced crafter migration blocked: " + existingSlotName + " is outside the valid slot range");
				return false;
			}
		}
	} else {
		for (var fallbackStoreIndex = validSlotCount; fallbackStoreIndex < RSE_CRAFTER_MAX_PATTERN_SLOTS; fallbackStoreIndex++) {
			var fallbackStoreName = "slot_store" + fallbackStoreIndex;
			var fallbackStoreItem = container.getSlot(fallbackStoreName);
			if (fallbackStoreItem && fallbackStoreItem.id) {
				RSE.log("advanced crafter migration blocked: " + fallbackStoreName + " is outside the valid slot range");
				return false;
			}
		}
	}

	var moveSpecs = [];
	for (patternIndex = 0; patternIndex < oldPageSize; patternIndex++) {
		targetPatternIndex = migrationPage * oldPageSize + patternIndex;
		if (targetPatternIndex >= validSlotCount || targetPatternIndex === patternIndex) continue;
		moveSpecs.push({
			source: "slot_pattern" + patternIndex,
			target: "slot_pattern" + targetPatternIndex
		});
	}
	for (var storeIndex = 0; storeIndex < validSlotCount; storeIndex++) {
		moveSpecs.push({
			source: "slot_store" + storeIndex,
			target: "slot_pattern" + storeIndex
		});
	}

	var moves = [];
	var sourceSlots = {};
	for (var moveSpecIndex = 0; moveSpecIndex < moveSpecs.length; moveSpecIndex++) {
		var moveSpec = moveSpecs[moveSpecIndex];
		if (container.slots && !container.slots[moveSpec.source]) continue;
		var sourceItem = container.getSlot(moveSpec.source);
		if (!sourceItem || !sourceItem.id) continue;
		moves.push({
			source: moveSpec.source,
			target: moveSpec.target,
			id: sourceItem.id,
			count: sourceItem.count,
			data: sourceItem.data,
			extra: sourceItem.extra
		});
		sourceSlots[moveSpec.source] = true;
	}

	var targetSources = {};
	for (var targetCheckIndex = 0; targetCheckIndex < moves.length; targetCheckIndex++) {
		var targetCheckMove = moves[targetCheckIndex];
		if (Object.prototype.hasOwnProperty.call(targetSources, targetCheckMove.target)) {
			RSE.log("advanced crafter migration blocked: both " + targetSources[targetCheckMove.target] +
				" and " + targetCheckMove.source + " target " + targetCheckMove.target);
			return false;
		}
		targetSources[targetCheckMove.target] = targetCheckMove.source;
	}

	for (var occupancyCheckIndex = 0; occupancyCheckIndex < moves.length; occupancyCheckIndex++) {
		var occupancyCheckMove = moves[occupancyCheckIndex];
		var targetItem = null;
		if (!container.slots || container.slots[occupancyCheckMove.target]) {
			targetItem = container.getSlot(occupancyCheckMove.target);
		}
		if (targetItem && targetItem.id && !Object.prototype.hasOwnProperty.call(sourceSlots, occupancyCheckMove.target)) {
			RSE.log("advanced crafter migration blocked: target " + occupancyCheckMove.target +
				" is occupied by an item outside the migration sources");
			return false;
		}
	}

	var oldCrafts = isValidCraftsMap(data.crafts) ? data.crafts : {};
	var newCrafts = {};
	for (var oldSlotName in oldCrafts) {
		if (!Object.prototype.hasOwnProperty.call(oldCrafts, oldSlotName)) continue;
		var newSlotName = oldSlotName;
		var visibleSlotMatch = /^slot_pattern(\d+)$/.exec(oldSlotName);
		if (visibleSlotMatch) {
			var visibleSlotIndex = parseInt(visibleSlotMatch[1], 10);
			if (!isNaN(visibleSlotIndex) && visibleSlotIndex >= 0 && visibleSlotIndex < oldPageSize) {
				newSlotName = "slot_pattern" + (migrationPage * oldPageSize + visibleSlotIndex);
			}
		}
		var storeSlotMatch = /^slot_store(\d+)$/.exec(oldSlotName);
		if (storeSlotMatch) {
			var storedSlotIndex = parseInt(storeSlotMatch[1], 10);
			if (!isNaN(storedSlotIndex) && storedSlotIndex >= 0) newSlotName = "slot_pattern" + storedSlotIndex;
		}
		var newSlotIndexMatch = /^slot_pattern(\d+)$/.exec(newSlotName);
		if (newSlotIndexMatch) {
			var newSlotIndex = parseInt(newSlotIndexMatch[1], 10);
			if (isNaN(newSlotIndex) || newSlotIndex < 0 || newSlotIndex >= validSlotCount) {
				RSE.log("advanced crafter migration blocked: craft target " + newSlotName + " is outside the valid slot range");
				return false;
			}
		}
		if (Object.prototype.hasOwnProperty.call(newCrafts, newSlotName)) {
			RSE.log("advanced crafter migration blocked: craft target " + newSlotName + " already exists");
			return false;
		}
		newCrafts[newSlotName] = oldCrafts[oldSlotName];
	}

	for (var clearIndex = 0; clearIndex < moves.length; clearIndex++) {
		container.clearSlot(moves[clearIndex].source);
	}
	for (var writeIndex = 0; writeIndex < moves.length; writeIndex++) {
		var writeMove = moves[writeIndex];
		container.setSlot(writeMove.target, writeMove.id, writeMove.count, writeMove.data, writeMove.extra);
	}

	data.crafts = newCrafts;
	data.patternsCount = Object.keys(newCrafts).length;
	data.layoutVersion = RSE_ADVANCED_CRAFTER_LAYOUT_VERSION;
	data.crafterLayoutNeedsMigration = false;
	delete data.page;
	if (typeof container.sendChanges == "function") container.sendChanges();
	return true;
}

var elementsGUI_advancedCrafter = {};
layoutAdvancedCrafterElements({ elements: elementsGUI_advancedCrafter }, 0, RSE_CRAFTERS_PER_PAGE);

function createAdvancedCrafterGui(tier) {
	return new UI.StandartWindow({
		standart: {
			header: { text: { text: Translation.translate(tier.title) } },
			inventory: { padding: 20, width: 300 / 4 * 3 },
			background: { standart: true }
		},
		drawing: [],
		elements: elementsGUI_advancedCrafter
	});
}

var advancedCrafterGUIs = {};
for (var crafterGuiTierIndex = 0; crafterGuiTierIndex < RSE_CRAFTER_TIERS.length; crafterGuiTierIndex++) {
	var crafterGuiTier = RSE_CRAFTER_TIERS[crafterGuiTierIndex];
	advancedCrafterGUIs[crafterGuiTier.name] = createAdvancedCrafterGui(crafterGuiTier);
}

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
			block_data: 0
		},
		click: function (id, count, data, coords, player, extra) {
			if (Entity.getSneaking(player)) return false;
			var layoutVersion = Number(this.data.layoutVersion);
			if (!isFinite(layoutVersion) || layoutVersion !== RSE_ADVANCED_CRAFTER_LAYOUT_VERSION) {
				RSE.log("advanced crafter click blocked: layout version " + this.data.layoutVersion + " requires " + RSE_ADVANCED_CRAFTER_LAYOUT_VERSION);
				return true;
			}
			var client = Network.getClientForPlayer(player);
			if (!client || this.container.getNetworkEntity().getClients().contains(client)) return true;
			this.container.openFor(client, "main");
			this.refreshGui(true, client);
			return true;
		},
		getScreenByName: function (screenName) {
			return advancedCrafterGUIs[tier.name];
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
				if (tile.data.createdCalled === true) {
					tile.data.layoutVersion = RSE_ADVANCED_CRAFTER_LAYOUT_VERSION;
					tile.data.crafterLayoutNeedsMigration = false;
				} else {
					tile.data.layoutVersion = 1;
					tile.data.crafterLayoutNeedsMigration = true;
				}
			} else if (storedLayoutVersion === RSE_ADVANCED_CRAFTER_LAYOUT_VERSION) {
				if (tile.data.createdCalled !== true && Object.prototype.hasOwnProperty.call(tile.data, "page")) {
					tile.data.layoutVersion = 2;
					tile.data.crafterLayoutNeedsMigration = true;
				} else {
					tile.data.crafterLayoutNeedsMigration = false;
				}
			} else {
				tile.data.crafterLayoutNeedsMigration = true;
			}
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
			var storeGetDenyPolicy = {
				transfer: function (itemContainer, slot, id, count, data, extra, player) {
					return 0;
				}
			};
			for (var storeSlotIndex = 0; storeSlotIndex < RSE_CRAFTER_MAX_PATTERN_SLOTS; storeSlotIndex++) {
				tile.container.setSlotGetTransferPolicy("slot_store" + storeSlotIndex, storeGetDenyPolicy);
			}
			for (var patternSlotIndex = 0; patternSlotIndex < RSE_CRAFTER_MAX_PATTERN_SLOTS; patternSlotIndex++) {
				(function (slotIndex) {
					var slotName = "slot_pattern" + slotIndex;
					if (slotIndex >= slotsCount) {
						var rejectTransferPolicy = {
							transfer: function (itemContainer, slot, id, count, data, extra, player) {
								return 0;
							}
						};
						tile.container.setSlotAddTransferPolicy(slotName, rejectTransferPolicy);
						tile.container.setSlotGetTransferPolicy(slotName, rejectTransferPolicy);
						return;
					}
					tile.container.setSlotAddTransferPolicy(slotName, {
						transfer: function (itemContainer, slot, id, count, data, extra, player) {
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
							if (id == ItemID.RSpattern && tile.data.crafts[slotName]) tile.removeCraft(slotName);
							return count;
						}
					});
				})(patternSlotIndex);
			}
			var viewportTransferDenyPolicy = {
				transfer: function (itemContainer, slot, id, count, data, extra, player) {
					return 0;
				}
			};
			for (var viewportIndex = 0; viewportIndex < RSE_CRAFTERS_PER_PAGE; viewportIndex++) {
				var viewportSlotName = getAdvancedCrafterViewportPatternName(viewportIndex);
				tile.container.setSlotAddTransferPolicy(viewportSlotName, viewportTransferDenyPolicy);
				tile.container.setSlotGetTransferPolicy(viewportSlotName, viewportTransferDenyPolicy);
			}
			tile.container.setSlotAddTransferPolicy(RSE_CRAFTER_UNBOUND_SLOT_NAME, viewportTransferDenyPolicy);
			tile.container.setSlotGetTransferPolicy(RSE_CRAFTER_UNBOUND_SLOT_NAME, viewportTransferDenyPolicy);
		},
		post_init: function () {
			if (this.data.crafterLayoutNeedsMigration) {
				RSE_migrateAdvancedCrafterLayout(this, slotsCount, pages);
			}
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
				slots: slotsCount,
				layoutVersion: this.data.layoutVersion,
				pages: pages,
				first: !!first
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
		containerEvents: {},
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
					var layoutVersion = Number(eventData.layoutVersion);
					if (!isFinite(layoutVersion) || layoutVersion !== RSE_ADVANCED_CRAFTER_LAYOUT_VERSION) {
						RSE.log("advanced crafter GUI blocked: layout version " + eventData.layoutVersion + " requires " + RSE_ADVANCED_CRAFTER_LAYOUT_VERSION);
						return;
					}
					if (!hasAdvancedCrafterStaticLayout(content)) {
						RSE.log("advanced crafter GUI blocked: static viewport layout is incomplete");
						return;
					}
					var patternSlotCount = Math.floor(Number(eventData.slots));
					if (!isFinite(patternSlotCount) || patternSlotCount < 0) patternSlotCount = slotsCount;
					if (patternSlotCount > RSE_CRAFTER_MAX_PATTERN_SLOTS) patternSlotCount = RSE_CRAFTER_MAX_PATTERN_SLOTS;
					var totalPages = getAdvancedCrafterPageCount(patternSlotCount);
					var currentPage = 0;
					if (!eventData.first) {
						var storedPage = Math.floor(Number(content.rseCurrentPatternPage));
						if (isFinite(storedPage)) currentPage = clampAdvancedCrafterPage(storedPage, totalPages);
					}
					content.rseCrafterLayoutVersion = layoutVersion;
					content.rsePatternSlotCount = patternSlotCount;
					content.rsePatternPageCount = totalPages;
					content.rseCurrentPatternPage = currentPage;

					var mainWindow = typeof window.getWindow == "function" ? window.getWindow('main') : window;
					if (!mainWindow) return;

					// Descriptors are shared; each window gets positions for the current height.
					applyAdvancedCrafterLivePositions(mainWindow, content);
					applyAdvancedCrafterViewportVisibility(mainWindow, content, currentPage, patternSlotCount);

					var redstoneModes = ["Ignore", "With signal", "Without signal"];
					var redstoneMode = parseInt(eventData.redstone_mode, 10);
					if (isNaN(redstoneMode)) redstoneMode = 0;
					redstoneMode = Math.max(0, Math.min(2, redstoneMode));
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

					applyAdvancedCrafterViewportPage(container, mainWindow, content, currentPage, patternSlotCount);
					if (mainWindow && typeof mainWindow.invalidateElements == "function") mainWindow.invalidateElements(false);
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
