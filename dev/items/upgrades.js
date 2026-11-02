for (var i = 0; i < RSE_ITEMS.cards.length; i++) {
	var cardDefinition = RSE_ITEMS.cards[i];
	IDRegistry.genItemID(cardDefinition.id);
	var itemCreationResult = Item.createItem(cardDefinition.id, cardDefinition.name, { name: cardDefinition.texture }, { stack: 64, isTech: true });
	RSE.itemCreated[cardDefinition.id] = !!itemCreationResult;
	RSE.itemReady[cardDefinition.id] = false;
	if (!itemCreationResult) RSE.log("item creation failed: " + cardDefinition.id);
}

ModAPI.addAPICallback("RefinedStorageAPI", function (api) {
	if (!api || !api.upgrades) {
		RSE.log("upgrade cards skipped: RefinedStorageAPI unavailable");
		return;
	}
	if (!RSE.apiAtLeast(api, 2, 0)) {
		RSE.log("upgrade cards skipped: RefinedStorageAPI 2.0 required");
		return;
	}
	var cardsConfiguration = Config.cards || { infinityUsage: 4000, dimensionUsage: 8000 };
	for (var i = 0; i < RSE_ITEMS.cards.length; i++) {
		var cardDefinition = RSE_ITEMS.cards[i];
		var usage = (typeof cardsConfiguration[cardDefinition.usageKey] === 'number') ? cardsConfiguration[cardDefinition.usageKey] : cardDefinition.defaultUsage;
		var flags = { maxStack: 1, infiniteRange: true };
		if (cardDefinition.crossDimension) flags.crossDimension = true;
		var registrationResult = api.upgrades.register(cardDefinition.name, cardDefinition.id, cardDefinition.texture, flags, usage, cardDefinition.id);
		RSE.itemReady[cardDefinition.id] = !!RSE.itemCreated[cardDefinition.id] && !!registrationResult;
		if (RSE.itemReady[cardDefinition.id]) Item.addToCreative(ItemID[cardDefinition.id], 1, 0);
	}
	RSE.logDev("upgrade cards registered");
});
